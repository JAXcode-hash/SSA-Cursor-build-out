import assert from "node:assert/strict";
import test from "node:test";
import { alertPayload, earlyPayload, incomePayload, sleevePayload } from "../bot/lib/discord.js";
import { isEarly, rankByMove } from "../bot/lib/predict.js";
import { riskReading } from "../bot/lib/risk.js";
import { chooseSleeve } from "../bot/lib/sleeve.js";
import type { Bar } from "../bot/lib/types.js";
import { combinePrice, figuresFromFacts } from "../bot/lib/sec.js";
import { statedMentions } from "../bot/lib/supply.js";
import { assignTags, normalizeSector } from "../bot/lib/tags.js";
import { closeReason } from "../bot/lib/returns.js";
import { localChatUrl } from "../bot/lib/local-chat.js";
import { routeName } from "../bot/lib/model-route.js";
import { openOpportunity } from "../bot/lib/ledger.js";
import { openIsolatedDb } from "../bot/lib/db.js";
import { validateAlert } from "../bot/lib/validate.js";
import { DISCLAIMER } from "../bot/lib/types.js";
import {
  contractCases,
  longDiscordPayload,
  longFixture,
  missingSectorTags,
  shortFixture,
  smallTechTags,
  staplesTags,
} from "./fixtures.js";
import { longTargetReturn, shortInvalidationReturn, withLedger } from "./returns.js";

test("large staples payer tags", () => {
  const tags = staplesTags();
  assert.equal(tags.size, "Large Cap");
  assert.deepEqual(tags.styles, ["Value Stock", "Dividend Stock"]);
  assert.equal(tags.cycle, "Defensive");
  assert.equal(tags.sector, "Consumer Staples");
});

test("small technology growth tags", () => {
  const tags = smallTechTags();
  assert.equal(tags.size, "Small Cap");
  assert.deepEqual(tags.styles, ["Growth Stock"]);
  assert.equal(tags.cycle, "Cyclical");
  assert.equal(tags.sector, "Information Technology");
});

test("missing sector has no cycle", () => {
  const tags = missingSectorTags();
  assert.equal(tags.sector, "");
  assert.equal(tags.cycle, "");
});

test("quote profile aliases map onto GICS names and unknown labels drop", () => {
  assert.equal(normalizeSector("Technology"), "Information Technology");
  assert.equal(normalizeSector("Healthcare"), "Health Care");
  assert.equal(normalizeSector("Consumer Cyclical"), "Consumer Discretionary");
  assert.equal(normalizeSector("A software company"), "");
});

test("alert contract accepts a long and a short and rejects an invented price or tag", () => {
  const cases = new Map(contractCases().map((entry) => [entry.name, entry]));
  assert.equal(cases.get("valid-long")?.accepted, true);
  assert.equal(cases.get("valid-short")?.accepted, true);
  assert.equal(cases.get("invented-price")?.accepted, false);
  assert.match(cases.get("invented-price")?.reason ?? "", /price/i);
  assert.equal(cases.get("invented-tag")?.accepted, false);
  assert.match(cases.get("invented-tag")?.reason ?? "", /tag/i);
});

test("discord payload is one SSA Desk embed", () => {
  const payload = longDiscordPayload();
  assert.equal(payload.username, "SSA Desk");
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0]?.title, "Long KO");
  assert.equal(payload.embeds[0]?.color, 0x2ecc71);
  assert.equal(payload.embeds[0]?.footer?.text, DISCLAIMER);
  const names = payload.embeds[0]?.fields.map((field) => field.name);
  for (const name of ["Company", "Price", "Market cap", "Trailing P/E", "Size", "Style", "Cycle", "Sector", "Entry", "Target", "Invalidation", "Sentiment", "Supply chain", "Theme"]) {
    assert.ok(names?.includes(name), name);
  }
});

test("a dividend payer gets its own income message", () => {
  const payload = incomePayload({
    ticker: "KO",
    companyName: "The Coca-Cola Company",
    price: 99.13,
    dividendPerShare: 2.04,
    size: "Large Cap",
  });
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0]?.title, "Income KO");
  assert.equal(payload.embeds[0]?.color, 0xf1c40f);
  assert.equal(payload.embeds[0]?.fields.find((field) => field.name === "Company")?.value, "The Coca-Cola Company");
  const longPayload = alertPayload(longFixture().alert, {
    companyName: "The Coca-Cola Company",
    dividendPerShare: 2.04,
  });
  assert.equal(longPayload.embeds[0]?.title, "Long KO");
  assert.notEqual(longPayload.embeds[0]?.color, payload.embeds[0]?.color);
});

test("short embed is red", () => {
  const payload = alertPayload(shortFixture().alert);
  assert.equal(payload.embeds[0]?.color, 0xe74c3c);
  assert.equal(payload.embeds[0]?.title, "Short XOM");
});

test("a dip in a strong compounder is not a short", () => {
  const { alert, snapshot } = longFixture();
  snapshot.revenueGrowth = 0.2;
  snapshot.sentiment = { score: -0.8, source: "headlines", volatilityNote: "extreme negative headlines" };
  snapshot.shortBand.extended = true;
  snapshot.tags = assignTags({
    marketCap: snapshot.marketCap,
    revenueGrowth: 0.2,
    trailingPe: 15,
    peerTrailingPes: [22, 24, 30],
    dividendPerShare: 1.5,
    sector: "Consumer Staples",
  });
  alert.side = "short";
  alert.entry = { low: snapshot.shortBand.low, high: snapshot.shortBand.high };
  alert.exit = { target: snapshot.shortBand.target, invalidation: snapshot.shortBand.invalidation };
  alert.sentiment = snapshot.sentiment;
  alert.tags = snapshot.tags;
  alert.thesis = `Price ${snapshot.price.toFixed(2)}. Revenue growth 20.00 percent. Sentiment -0.80. RSI14 ${snapshot.technicals.rsi14.toFixed(2)}.`;
  const verdict = validateAlert(alert, snapshot);
  assert.equal(verdict.ok, false);
  if (!verdict.ok) assert.match(verdict.reason, /compounder/);
});

test("long target stores a positive return and short invalidation stores a negative return", async () => {
  const longReturn = await longTargetReturn();
  const shortReturn = await shortInvalidationReturn();
  assert.ok(longReturn > 0);
  assert.equal(longReturn, 0.15);
  assert.ok(shortReturn < 0);
  assert.equal(shortReturn, -0.12);
});

test("invalidation wins when the same bar trades through both levels", () => {
  assert.equal(
    closeReason({
      side: "long",
      target: 110,
      invalidation: 90,
      high: 115,
      low: 85,
      horizonOn: "2026-07-01",
      today: "2026-06-15",
    }),
    "invalidation",
  );
  assert.equal(
    closeReason({
      side: "long",
      target: 200,
      invalidation: 50,
      high: 101,
      low: 99,
      horizonOn: "2026-02-01",
      today: "2026-03-01",
    }),
    "horizon",
  );
});

test("a second open for the same ticker and side is rejected", async () => {
  await withLedger(async (db) => {
    const { alert } = longFixture();
    const first = await openOpportunity(db, alert, new Date("2026-06-01T15:00:00Z"));
    const second = await openOpportunity(db, alert, new Date("2026-06-02T15:00:00Z"));
    assert.equal(first.ok, true);
    assert.equal(second.ok, false);
  });
});

test("a negative SEC earnings figure does not borrow a positive quote P/E", () => {
  const combined = combinePrice(40, {
    ttmEps: -1,
    shares: 1000,
    revenueGrowth: null,
    dividendPerShare: null,
  }, 50_000, 12);
  assert.equal(combined.trailingPe, null);
  assert.equal(combined.marketCap, 40_000);
});

test("SEC facts produce trailing earnings, growth, dividend, and shares", () => {
  const figures = figuresFromFacts({
    facts: {
      "us-gaap": {
        Revenues: {
          units: {
            USD: [
              { end: "2023-12-31", val: 100, fp: "FY", form: "10-K" },
              { end: "2024-12-31", val: 112, fp: "FY", form: "10-K" },
            ],
          },
        },
        EarningsPerShareDiluted: {
          units: {
            "USD/shares": [
              { end: "2024-03-31", val: 1, fp: "Q1" },
              { end: "2024-06-30", val: 1, fp: "Q2" },
              { end: "2024-09-30", val: 1, fp: "Q3" },
              { end: "2024-12-31", val: 1.5, fp: "Q4" },
            ],
          },
        },
        CommonStockDividendsPerShareDeclared: {
          units: { "USD/shares": [{ end: "2024-12-31", val: 2, fp: "FY", form: "10-K" }] },
        },
        CommonStockSharesOutstanding: {
          units: { shares: [{ end: "2024-12-31", val: 1000, fp: "FY", form: "10-K" }] },
        },
      },
    },
  });
  assert.equal(figures.revenueGrowth, 0.12);
  assert.equal(figures.ttmEps, 4.5);
  assert.equal(figures.dividendPerShare, 2);
  assert.equal(figures.shares, 1000);
});

test("10-K text tags a known ticker as a stated mention and ignores unknown words", () => {
  const mentions = statedMentions("The company buys capacity from TSM and also says hello.", "NVDA");
  assert.ok(mentions.includes("TSM"));
  assert.equal(mentions.includes("HELLO"), false);
});

test("local route stays commercial unless MODEL_ROUTE=local", () => {
  const previous = process.env.MODEL_ROUTE;
  delete process.env.MODEL_ROUTE;
  assert.equal(routeName(), "commercial");
  process.env.MODEL_ROUTE = "local";
  assert.equal(routeName(), "local");
  if (previous === undefined) delete process.env.MODEL_ROUTE;
  else process.env.MODEL_ROUTE = previous;
  assert.equal(localChatUrl("http://127.0.0.1:8000/v1"), "http://127.0.0.1:8000/v1/chat/completions");
  assert.equal(localChatUrl("http://127.0.0.1:8000"), "http://127.0.0.1:8000/v1/chat/completions");
});

function series(daily: (index: number) => number): Bar[] {
  const bars: Bar[] = [];
  let price = 100;
  const date = new Date(Date.UTC(2026, 0, 1));
  for (let index = 0; index < 80; index += 1) {
    bars.push({ date: date.toISOString().slice(0, 10), open: price, high: price, low: price, close: price });
    price *= 1 + daily(index);
    date.setUTCDate(date.getUTCDate() + 1);
  }
  return bars;
}

test("risk sleeve keeps a high-beta name that beat the benchmark and drops a low-beta name", () => {
  const marketMove = (index: number) => (index % 2 === 0 ? 0.02 : -0.005);
  const market = series(marketMove);
  const leader = series((index) => marketMove(index) * 2);
  const laggard = series((index) => marketMove(index) * 0.4);
  const leaderRisk = riskReading(leader, market);
  const laggardRisk = riskReading(laggard, market);
  assert.ok(leaderRisk);
  assert.ok(laggardRisk);
  assert.ok(leaderRisk.beta > 1.5);
  assert.ok(leaderRisk.excessReturn > 0);
  assert.ok(laggardRisk.beta < 1);
  const marketVol = riskReading(market, market);
  assert.ok(marketVol);
  const choice = chooseSleeve(
    [
      { ticker: "LEAD", companyName: "Leader Inc.", price: 100, marketCap: 5_000_000_000, ...leaderRisk },
      { ticker: "LAG", companyName: "Laggard Inc.", price: 100, marketCap: 5_000_000_000, ...laggardRisk },
    ],
    { size: 12, minBeta: 1.2, minSessions: 60, marketCapFloor: 2_000_000_000 },
    marketVol.volatility,
  );
  assert.deepEqual(choice.held.map((row) => row.ticker), ["LEAD"]);
  assert.equal(choice.rejected.some((row) => row.ticker === "LAG"), true);
  const payload = sleevePayload({
    benchmark: "SPY",
    benchmarkReturn: leaderRisk.marketReturn,
    held: choice.held,
    sleeveReturn: leaderRisk.stockReturn,
    excessReturn: leaderRisk.excessReturn,
  });
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0]?.title, "Risk sleeve");
  assert.equal(payload.embeds[0]?.color, 0x8e44ad);
  assert.match(payload.embeds[0]?.description ?? "", /Leader Inc\. \(LEAD\)/);
});

test("early signal requires leadership that the longer window has not confirmed", () => {
  const early = isEarly({
    excess20: 0.04,
    excessLong: -0.02,
    rsi14: 58,
    aboveSma50: true,
    extended: false,
    volumeRatio: 1.4,
  });
  assert.equal(early.signal, true);
  assert.equal(early.score, 1);
  const alreadyWon = isEarly({
    excess20: 0.04,
    excessLong: 0.1,
    rsi14: 58,
    aboveSma50: true,
    extended: false,
    volumeRatio: 1.4,
  });
  assert.equal(alreadyWon.signal, false);
  const crowded = isEarly({
    excess20: 0.04,
    excessLong: -0.02,
    rsi14: 75,
    aboveSma50: true,
    extended: true,
    volumeRatio: 0.8,
  });
  assert.equal(crowded.signal, false);
  const quietVolume = isEarly({
    excess20: 0.04,
    excessLong: -0.02,
    rsi14: 58,
    aboveSma50: true,
    extended: false,
    volumeRatio: 0.7,
  });
  assert.equal(quietVolume.signal, true);
  const payload = earlyPayload({
    horizon: 20,
    picks: [{ ticker: "NEW", companyName: "New Leader Inc.", excess20: 0.04, excessLong: -0.02 }],
    hitRate: 0.55,
    baseRate: 0.48,
    signals: 22,
    edge: true,
  });
  assert.equal(payload.embeds.length, 1);
  assert.equal(payload.embeds[0]?.title, "Early positions");
  const ranked = rankByMove([
    { ticker: "SMALL", excess20: 0.03 },
    { ticker: "LARGE", excess20: 0.12 },
    { ticker: "MID", excess20: 0.09 },
  ]);
  assert.deepEqual(ranked.big.map((row) => row.ticker), ["LARGE", "MID"]);
  assert.deepEqual(ranked.other.map((row) => row.ticker), ["SMALL"]);
  assert.equal(payload.embeds[0]?.color, 0xe67e22);
  assert.match(payload.embeds[0]?.description ?? "", /New Leader Inc\. \(NEW\)/);
});

test("isolated database closes", async () => {
  const db = await openIsolatedDb();
  await db.close();
});
