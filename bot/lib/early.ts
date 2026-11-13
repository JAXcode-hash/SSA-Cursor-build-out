import { readFileSync } from "node:fs";
import { join } from "node:path";
import { round } from "./numbers.js";
import { dataDir } from "./paths.js";
import { BIG_EXCESS, combineEvaluations, earlyCall, evaluateEarly, rankByMove, type EarlyEvaluation } from "./predict.js";
import { dailyBars } from "./quotes.js";

export type EarlyPick = {
  ticker: string;
  companyName: string;
  price: number;
  asOf: string;
  score: number;
  excess20: number;
  excessLong: number;
  rsi14: number;
  volumeRatio: number | null;
  big: boolean;
  reasons: string[];
};

export type EarlyBook = {
  benchmark: string;
  horizon: number;
  searched: number;
  bigExcess: number;
  picks: EarlyPick[];
  big: EarlyPick[];
  evaluation: EarlyEvaluation;
  edge: boolean;
  bigEdge: boolean;
};

type EarlyUniverse = {
  benchmark: string;
  bigExcess: number;
  tickers: string[];
};

export function loadEarlyUniverse(): EarlyUniverse {
  const raw = JSON.parse(readFileSync(join(dataDir, "early-universe.json"), "utf8")) as EarlyUniverse;
  return {
    benchmark: raw.benchmark.toUpperCase(),
    bigExcess: raw.bigExcess,
    tickers: [...new Set(raw.tickers.map((ticker) => ticker.toUpperCase()))],
  };
}

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function scanEarly(): Promise<EarlyBook> {
  const rules = loadEarlyUniverse();
  const benchmark = await dailyBars(rules.benchmark);
  const rows = await mapLimited(rules.tickers, 5, async (ticker) => {
    try {
      const quote = await dailyBars(ticker);
      const call = earlyCall(quote.bars, benchmark.bars);
      const evaluation = evaluateEarly(quote.bars, benchmark.bars);
      if (!call?.signal) return { evaluation, pick: null };
      const price = quote.profile.price ?? quote.bars.at(-1)?.close;
      if (price === undefined || price === null) return { evaluation, pick: null };
      const pick: EarlyPick = {
        ticker,
        companyName: quote.profile.companyName || ticker,
        price: round(price, 2),
        asOf: call.asOf,
        score: call.score,
        excess20: call.features.excess20,
        excessLong: call.features.excessLong,
        rsi14: call.features.rsi14,
        volumeRatio: call.features.volumeRatio,
        big: call.features.excess20 >= rules.bigExcess,
        reasons: call.reasons,
      };
      return { evaluation, pick };
    } catch {
      return { evaluation: null, pick: null };
    }
  });
  const picks = rows.flatMap((row) => (row.pick ? [row.pick] : []));
  const ranked = rankByMove(picks, rules.bigExcess);
  const evaluation = combineEvaluations(rows.flatMap((row) => (row.evaluation ? [row.evaluation] : [])));
  const edge =
    evaluation.hitRate !== null &&
    evaluation.baseRate !== null &&
    evaluation.signals >= 20 &&
    evaluation.hitRate >= evaluation.baseRate + 0.05 &&
    evaluation.avgExcess !== null &&
    evaluation.avgBaseExcess !== null &&
    evaluation.avgExcess > evaluation.avgBaseExcess;
  const bigEdge =
    evaluation.bigHitRate !== null &&
    evaluation.baseRate !== null &&
    evaluation.bigSignals >= 20 &&
    evaluation.bigHitRate >= evaluation.baseRate + 0.05 &&
    evaluation.bigAvgExcess !== null &&
    evaluation.avgBaseExcess !== null &&
    evaluation.bigAvgExcess > evaluation.avgBaseExcess;
  return {
    benchmark: rules.benchmark,
    horizon: evaluation.horizon,
    searched: rules.tickers.length,
    bigExcess: rules.bigExcess,
    picks: [...ranked.big, ...ranked.other],
    big: ranked.big,
    evaluation,
    edge,
    bigEdge,
  };
}

export { BIG_EXCESS };
