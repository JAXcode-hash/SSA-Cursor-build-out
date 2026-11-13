import { round } from "./numbers.js";
import { dailyBars } from "./quotes.js";
import { combineEvaluations, earlyCall, evaluateEarly, type EarlyEvaluation } from "./predict.js";
import { loadSleeveRules } from "./sleeve.js";

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
  reasons: string[];
};

export type EarlyBook = {
  benchmark: string;
  horizon: number;
  picks: EarlyPick[];
  evaluation: EarlyEvaluation;
  edge: boolean;
};

export async function scanEarly(): Promise<EarlyBook> {
  const rules = loadSleeveRules();
  const benchmark = await dailyBars(rules.benchmark);
  const picks: EarlyPick[] = [];
  const evaluations: EarlyEvaluation[] = [];
  for (const ticker of rules.tickers) {
    try {
      const quote = await dailyBars(ticker);
      const call = earlyCall(quote.bars, benchmark.bars);
      evaluations.push(evaluateEarly(quote.bars, benchmark.bars));
      if (!call?.signal) continue;
      const price = quote.profile.price ?? quote.bars.at(-1)?.close;
      if (price === undefined || price === null) continue;
      picks.push({
        ticker,
        companyName: quote.profile.companyName || ticker,
        price: round(price, 2),
        asOf: call.asOf,
        score: call.score,
        excess20: call.features.excess20,
        excessLong: call.features.excessLong,
        rsi14: call.features.rsi14,
        volumeRatio: call.features.volumeRatio,
        reasons: call.reasons,
      });
    } catch {
      continue;
    }
  }
  const evaluation = combineEvaluations(evaluations);
  const edge =
    evaluation.hitRate !== null &&
    evaluation.baseRate !== null &&
    evaluation.signals >= 20 &&
    evaluation.hitRate >= evaluation.baseRate + 0.05;
  picks.sort((left, right) => right.excess20 - left.excess20);
  return { benchmark: rules.benchmark, horizon: evaluation.horizon, picks, evaluation, edge };
}
