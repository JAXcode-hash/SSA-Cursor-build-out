import { alertPayload } from "../bot/lib/discord.js";
import { assignTags } from "../bot/lib/tags.js";
import { bands } from "../bot/lib/technicals.js";
import {
  DISCLAIMER,
  type Alert,
  type Bar,
  type Snapshot,
  type Tags,
} from "../bot/lib/types.js";
import { validateAlert } from "../bot/lib/validate.js";

function seriesBars(closes: number[]): Bar[] {
  return closes.map((close, index) => ({
    date: `2026-03-${String((index % 27) + 1).padStart(2, "0")}`,
    open: close,
    high: close + 1,
    low: close - 1,
    close,
  }));
}

function requireBands(closes: number[]) {
  const window = bands(seriesBars(closes));
  if (!window) throw new Error("fixture has no bands");
  return window;
}

export function staplesTags(): Tags {
  return assignTags({
    marketCap: 80_000_000_000,
    revenueGrowth: 0.02,
    trailingPe: 15,
    peerTrailingPes: [22, 24, 30],
    dividendPerShare: 1.5,
    sector: "Consumer Staples",
  });
}

export function smallTechTags(): Tags {
  return assignTags({
    marketCap: 500_000_000,
    revenueGrowth: 0.2,
    trailingPe: 40,
    peerTrailingPes: [18, 22],
    dividendPerShare: 0,
    sector: "Information Technology",
  });
}

export function missingSectorTags(): Tags {
  return assignTags({
    marketCap: 12_000_000_000,
    revenueGrowth: null,
    trailingPe: 14,
    peerTrailingPes: [20, 21, 22],
    dividendPerShare: null,
    sector: null,
  });
}

function alertFrom(snapshot: Snapshot, side: "long" | "short"): Alert {
  const band = side === "long" ? snapshot.longBand : snapshot.shortBand;
  const pe = snapshot.trailingPe === null ? "n/a" : snapshot.trailingPe.toFixed(2);
  const growth =
    snapshot.revenueGrowth === null ? "n/a" : (snapshot.revenueGrowth * 100).toFixed(2);
  return {
    ticker: snapshot.ticker,
    side,
    horizon: 30,
    thesis: `Price ${snapshot.price.toFixed(2)}. Trailing P/E ${pe}. Revenue growth ${growth} percent. RSI14 ${snapshot.technicals.rsi14.toFixed(2)}. Sentiment ${snapshot.sentiment.score.toFixed(2)}.`,
    evidenceIds: [
      "fundamentals.price",
      "fundamentals.trailingPe",
      "fundamentals.revenueGrowth",
      "technicals.rsi14",
      "sentiment",
    ],
    fundamentals: {
      price: snapshot.price,
      marketCap: snapshot.marketCap,
      trailingPe: snapshot.trailingPe,
      peVsWatchlistMedian: snapshot.peVsWatchlistMedian,
    },
    technicals: snapshot.technicals,
    entry: { low: band.low, high: band.high },
    exit: { target: band.target, invalidation: band.invalidation },
    sentiment: snapshot.sentiment,
    supplyChain: snapshot.supplyChain,
    themes: snapshot.themes,
    tags: snapshot.tags,
    disclaimer: DISCLAIMER,
  };
}

export function longFixture(): { alert: Alert; snapshot: Snapshot } {
  const closes = Array.from({ length: 60 }, () => 100);
  closes[closes.length - 1] = 99;
  const window = requireBands(closes);
  if (!window.longBand.inBand) throw new Error("long fixture is outside the entry band");
  const tags = staplesTags();
  const snapshot: Snapshot = {
    ticker: "KO",
    companyName: "The Coca-Cola Company",
    price: 99,
    marketCap: 80_000_000_000,
    trailingPe: 15,
    peVsWatchlistMedian: 0.7,
    revenueGrowth: 0.02,
    dividendPerShare: 1.5,
    sector: tags.sector,
    peerTrailingPes: [22, 24, 30],
    technicals: window.technicals,
    longBand: window.longBand,
    shortBand: window.shortBand,
    sentiment: { score: 0.1, source: "headlines", volatilityNote: "mixed headlines" },
    supplyChain: [{ ticker: "TSM", source: "curated", confidence: 0.4 }],
    themes: [],
    tags,
    latestBar: { high: 100, low: 98, close: 99 },
  };
  return { alert: alertFrom(snapshot, "long"), snapshot };
}

export function shortFixture(): { alert: Alert; snapshot: Snapshot } {
  const closes = Array.from({ length: 60 }, () => 100);
  closes[closes.length - 1] = 110;
  const window = requireBands(closes);
  if (!window.shortBand.extended) throw new Error("short fixture is not extended");
  const tags = assignTags({
    marketCap: 40_000_000_000,
    revenueGrowth: -0.05,
    trailingPe: null,
    peerTrailingPes: [],
    dividendPerShare: 0,
    sector: "Energy",
  });
  const snapshot: Snapshot = {
    ticker: "XOM",
    companyName: "Exxon Mobil Corporation",
    price: 110,
    marketCap: 40_000_000_000,
    trailingPe: null,
    peVsWatchlistMedian: null,
    revenueGrowth: -0.05,
    dividendPerShare: 0,
    sector: tags.sector,
    peerTrailingPes: [],
    technicals: window.technicals,
    longBand: window.longBand,
    shortBand: window.shortBand,
    sentiment: { score: -0.5, source: "headlines", volatilityNote: "extreme negative headlines" },
    supplyChain: [],
    themes: [],
    tags,
    latestBar: { high: 111, low: 109, close: 110 },
  };
  return { alert: alertFrom(snapshot, "short"), snapshot };
}

export function longDiscordPayload() {
  return alertPayload(longFixture().alert);
}

export function contractCases(): Array<{ name: string; accepted: boolean; reason?: string }> {
  const long = longFixture();
  const short = shortFixture();
  const invented = longFixture();
  invented.alert.fundamentals.price = 999;
  const tagged = longFixture();
  tagged.alert.tags = {
    ...tagged.alert.tags,
    styles: [...tagged.alert.tags.styles, "Growth Stock"],
  };
  const cases = [
    { name: "valid-long", ...validateAlert(long.alert, long.snapshot) },
    { name: "valid-short", ...validateAlert(short.alert, short.snapshot) },
    { name: "invented-price", ...validateAlert(invented.alert, invented.snapshot) },
    { name: "invented-tag", ...validateAlert(tagged.alert, tagged.snapshot) },
  ];
  return cases.map((entry) =>
    entry.ok
      ? { name: entry.name, accepted: true }
      : { name: entry.name, accepted: false, reason: entry.reason },
  );
}
