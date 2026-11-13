import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths.js";
import { dailyBars } from "./quotes.js";
import { riskReading, type RiskReading } from "./risk.js";
import { combinePrice, companyFacts, entityName, figuresFromFacts } from "./sec.js";
import { round } from "./numbers.js";

export type SleeveRules = {
  benchmark: string;
  size: number;
  minBeta: number;
  minSessions: number;
  marketCapFloor: number;
  tickers: string[];
};

export type SleeveCandidate = RiskReading & {
  ticker: string;
  companyName: string;
  price: number;
  marketCap: number | null;
};

export type SleeveResult = {
  benchmark: string;
  benchmarkReturn: number | null;
  benchmarkVolatility: number | null;
  held: SleeveCandidate[];
  sleeveReturn: number | null;
  excessReturn: number | null;
  rejected: Array<{ ticker: string; reason: string }>;
};

export function loadSleeveRules(): SleeveRules {
  const raw = JSON.parse(readFileSync(join(dataDir, "risk-sleeve.json"), "utf8")) as SleeveRules;
  return {
    ...raw,
    benchmark: raw.benchmark.toUpperCase(),
    tickers: raw.tickers.map((ticker) => ticker.toUpperCase()),
  };
}

export function chooseSleeve(
  rows: SleeveCandidate[],
  rules: Pick<SleeveRules, "size" | "minBeta" | "minSessions" | "marketCapFloor">,
  benchmarkVolatility: number,
): { held: SleeveCandidate[]; rejected: Array<{ ticker: string; reason: string }> } {
  const rejected: Array<{ ticker: string; reason: string }> = [];
  const qualified: SleeveCandidate[] = [];
  for (const row of rows) {
    if (row.sessions < rules.minSessions) {
      rejected.push({ ticker: row.ticker, reason: "not enough paired sessions with the benchmark" });
    } else if (row.beta < rules.minBeta) {
      rejected.push({ ticker: row.ticker, reason: "beta is not above the risk sleeve minimum" });
    } else if (row.volatility <= benchmarkVolatility) {
      rejected.push({ ticker: row.ticker, reason: "volatility is not above the benchmark" });
    } else if (row.excessReturn <= 0) {
      rejected.push({ ticker: row.ticker, reason: "trailing return did not beat the benchmark" });
    } else if (row.marketCap === null || row.marketCap < rules.marketCapFloor) {
      rejected.push({ ticker: row.ticker, reason: "market cap is below the risk sleeve floor" });
    } else {
      qualified.push(row);
    }
  }
  const held = qualified.sort((left, right) => right.excessReturn - left.excessReturn).slice(0, rules.size);
  return { held, rejected };
}

async function marketCapFor(ticker: string, price: number, quoted: number | null): Promise<number | null> {
  if (quoted !== null && quoted > 0) return quoted;
  try {
    const facts = await companyFacts(ticker);
    if (!facts) return null;
    const combined = combinePrice(price, figuresFromFacts(facts), null, null);
    return combined.marketCap;
  } catch {
    return null;
  }
}

export async function buildSleeve(): Promise<SleeveResult> {
  const rules = loadSleeveRules();
  const benchmarkQuote = await dailyBars(rules.benchmark);
  const benchmarkVol = riskReading(benchmarkQuote.bars, benchmarkQuote.bars)?.volatility ?? null;
  const rows: SleeveCandidate[] = [];
  const rejected: Array<{ ticker: string; reason: string }> = [];
  for (const ticker of rules.tickers) {
    try {
      const quote = await dailyBars(ticker);
      const reading = riskReading(quote.bars, benchmarkQuote.bars);
      const price = quote.profile.price ?? quote.bars.at(-1)?.close ?? null;
      if (!reading || price === null || benchmarkVol === null) {
        rejected.push({ ticker, reason: "no comparable price history" });
        continue;
      }
      const passesRisk =
        reading.sessions >= rules.minSessions &&
        reading.beta >= rules.minBeta &&
        reading.volatility > benchmarkVol &&
        reading.excessReturn > 0;
      const marketCap = passesRisk ? await marketCapFor(ticker, price, quote.profile.marketCap) : quote.profile.marketCap;
      let companyName = quote.profile.companyName ?? "";
      if (passesRisk && companyName === "") {
        try {
          const facts = await companyFacts(ticker);
          companyName = facts ? entityName(facts) : "";
        } catch {
          companyName = "";
        }
      }
      rows.push({
        ticker,
        companyName: companyName || ticker,
        price: round(price, 2),
        marketCap,
        ...reading,
      });
    } catch {
      rejected.push({ ticker, reason: "quote request failed" });
    }
  }
  if (benchmarkVol === null) {
    return {
      benchmark: rules.benchmark,
      benchmarkReturn: null,
      benchmarkVolatility: null,
      held: [],
      sleeveReturn: null,
      excessReturn: null,
      rejected,
    };
  }
  const choice = chooseSleeve(rows, rules, benchmarkVol);
  const sleeveReturn =
    choice.held.length === 0
      ? null
      : round(choice.held.reduce((sum, row) => sum + row.stockReturn, 0) / choice.held.length, 4);
  const benchmarkReturn = choice.held[0]?.marketReturn ?? rows[0]?.marketReturn ?? null;
  return {
    benchmark: rules.benchmark,
    benchmarkReturn,
    benchmarkVolatility: benchmarkVol,
    held: choice.held,
    sleeveReturn,
    excessReturn: sleeveReturn === null || benchmarkReturn === null ? null : round(sleeveReturn - benchmarkReturn, 4),
    rejected: [...rejected, ...choice.rejected],
  };
}
