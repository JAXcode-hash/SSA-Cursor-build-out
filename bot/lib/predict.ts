import { round } from "./numbers.js";
import { atr, rsi, sma } from "./technicals.js";
import type { Bar } from "./types.js";

export const EARLY_HORIZON = 20;
export const EARLY_MIN_SESSIONS = 60;
export const BIG_EXCESS = 0.08;

export type EarlyFeatures = {
  excess20: number;
  excessLong: number;
  rsi14: number;
  aboveSma50: boolean;
  extended: boolean;
  volumeRatio: number | null;
};

export type EarlyDecision = {
  signal: boolean;
  score: number;
  reasons: string[];
};

export type EarlyCall = EarlyDecision & {
  asOf: string;
  features: EarlyFeatures;
};

type Aligned = { date: string; stock: number; market: number };

function aligned(stock: Bar[], market: Bar[]): Aligned[] {
  const marketClose = new Map(market.map((bar) => [bar.date, bar.close]));
  const rows: Aligned[] = [];
  for (const bar of stock) {
    const close = marketClose.get(bar.date);
    if (close === undefined || bar.close <= 0 || close <= 0) continue;
    rows.push({ date: bar.date, stock: bar.close, market: close });
  }
  return rows;
}

function spanReturn(rows: Aligned[], sessions: number): { stock: number; market: number } | null {
  if (rows.length <= sessions) return null;
  const last = rows.at(-1);
  const first = rows[rows.length - 1 - sessions];
  if (!last || !first || first.stock <= 0 || first.market <= 0) return null;
  return { stock: last.stock / first.stock - 1, market: last.market / first.market - 1 };
}

export function volumeRatio(bars: Bar[]): number | null {
  const volumes = bars.map((bar) => bar.volume).filter((value): value is number => typeof value === "number" && value > 0);
  if (volumes.length < 25) return null;
  const recent = volumes.slice(-5);
  const prior = volumes.slice(-25, -5);
  const average = (values: number[]) => values.reduce((sum, value) => sum + value, 0) / values.length;
  const base = average(prior);
  if (base <= 0) return null;
  return average(recent) / base;
}

export function isEarly(features: EarlyFeatures): EarlyDecision {
  const required: Array<{ ok: boolean; reason: string }> = [
    { ok: features.excess20 >= 0.02, reason: "last 20 sessions beat SPY by at least 2 points" },
    { ok: features.excessLong <= 0, reason: "the longer window still lags SPY" },
  ];
  const confirmations: Array<{ ok: boolean; reason: string }> = [
    { ok: features.rsi14 >= 50 && features.rsi14 <= 68, reason: "momentum is turning up and is not crowded" },
    { ok: features.aboveSma50, reason: "price is above the 50-day average" },
    { ok: !features.extended, reason: "price is not already extended" },
    { ok: features.volumeRatio !== null && features.volumeRatio >= 1.25, reason: "recent volume is above the prior month" },
  ];
  const confirmed = confirmations.filter((check) => check.ok);
  const passed = [...required.filter((check) => check.ok), ...confirmed];
  return {
    signal: required.every((check) => check.ok) && confirmed.length >= 2,
    score: round(passed.length / (required.length + confirmations.length), 4),
    reasons: passed.map((check) => check.reason),
  };
}

export function earlyCall(stock: Bar[], market: Bar[]): EarlyCall | null {
  const rows = aligned(stock, market);
  const last = rows.at(-1);
  const recent = spanReturn(rows, EARLY_HORIZON);
  const longer = spanReturn(rows, rows.length - 1);
  const closes = stock.map((bar) => bar.close);
  const rsi14 = rsi(closes, 14);
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const atr14 = atr(stock, 14);
  const close = closes.at(-1);
  if (!last || !recent || !longer || rsi14 === null || sma20 === null || sma50 === null || atr14 === null || close === undefined) {
    return null;
  }
  if (rows.length < EARLY_MIN_SESSIONS) return null;
  const activity = volumeRatio(stock);
  const features: EarlyFeatures = {
    excess20: round(recent.stock - recent.market, 4),
    excessLong: round(longer.stock - longer.market, 4),
    rsi14: round(rsi14, 2),
    aboveSma50: close > sma50,
    extended: close >= sma20 + atr14,
    volumeRatio: activity === null ? null : round(activity, 4),
  };
  return { asOf: last.date, features, ...isEarly(features) };
}

export type EarlyEvaluation = {
  horizon: number;
  signals: number;
  hits: number;
  hitRate: number | null;
  avgExcess: number | null;
  bigSignals: number;
  bigHits: number;
  bigHitRate: number | null;
  bigAvgExcess: number | null;
  baseSamples: number;
  baseHits: number;
  baseRate: number | null;
  avgBaseExcess: number | null;
};

export function rankByMove<T extends { excess20: number }>(
  picks: T[],
  bigExcess = BIG_EXCESS,
): { big: T[]; other: T[] } {
  const ordered = [...picks].sort((left, right) => right.excess20 - left.excess20);
  return {
    big: ordered.filter((pick) => pick.excess20 >= bigExcess),
    other: ordered.filter((pick) => pick.excess20 < bigExcess),
  };
}

export function evaluateEarly(stock: Bar[], market: Bar[], horizon = EARLY_HORIZON): EarlyEvaluation {
  const rows = aligned(stock, market);
  let signals = 0;
  let hits = 0;
  let signalExcess = 0;
  let bigSignals = 0;
  let bigHits = 0;
  let bigExcess = 0;
  let baseSamples = 0;
  let baseHits = 0;
  let baseExcess = 0;
  for (let index = EARLY_MIN_SESSIONS; index + horizon < rows.length; index += horizon) {
    const asOf = rows[index]?.date;
    const future = rows[index + horizon];
    const now = rows[index];
    if (!asOf || !future || !now || now.stock <= 0 || now.market <= 0) continue;
    const excess = future.stock / now.stock - future.market / now.market;
    baseSamples += 1;
    baseExcess += excess;
    if (excess > 0) baseHits += 1;
    const call = earlyCall(
      stock.filter((bar) => bar.date <= asOf),
      market.filter((bar) => bar.date <= asOf),
    );
    if (!call?.signal) continue;
    signals += 1;
    signalExcess += excess;
    if (excess > 0) hits += 1;
    if (call.features.excess20 >= BIG_EXCESS) {
      bigSignals += 1;
      bigExcess += excess;
      if (excess > 0) bigHits += 1;
    }
  }
  return {
    horizon,
    signals,
    hits,
    hitRate: signals === 0 ? null : round(hits / signals, 4),
    avgExcess: signals === 0 ? null : round(signalExcess / signals, 4),
    bigSignals,
    bigHits,
    bigHitRate: bigSignals === 0 ? null : round(bigHits / bigSignals, 4),
    bigAvgExcess: bigSignals === 0 ? null : round(bigExcess / bigSignals, 4),
    baseSamples,
    baseHits,
    baseRate: baseSamples === 0 ? null : round(baseHits / baseSamples, 4),
    avgBaseExcess: baseSamples === 0 ? null : round(baseExcess / baseSamples, 4),
  };
}

export function combineEvaluations(parts: EarlyEvaluation[]): EarlyEvaluation {
  const signals = parts.reduce((sum, part) => sum + part.signals, 0);
  const hits = parts.reduce((sum, part) => sum + part.hits, 0);
  const bigSignals = parts.reduce((sum, part) => sum + part.bigSignals, 0);
  const bigHits = parts.reduce((sum, part) => sum + part.bigHits, 0);
  const baseSamples = parts.reduce((sum, part) => sum + part.baseSamples, 0);
  const baseHits = parts.reduce((sum, part) => sum + part.baseHits, 0);
  const signalExcess = parts.reduce((sum, part) => sum + (part.avgExcess ?? 0) * part.signals, 0);
  const bigExcess = parts.reduce((sum, part) => sum + (part.bigAvgExcess ?? 0) * part.bigSignals, 0);
  const baseExcess = parts.reduce((sum, part) => sum + (part.avgBaseExcess ?? 0) * part.baseSamples, 0);
  return {
    horizon: EARLY_HORIZON,
    signals,
    hits,
    hitRate: signals === 0 ? null : round(hits / signals, 4),
    avgExcess: signals === 0 ? null : round(signalExcess / signals, 4),
    bigSignals,
    bigHits,
    bigHitRate: bigSignals === 0 ? null : round(bigHits / bigSignals, 4),
    bigAvgExcess: bigSignals === 0 ? null : round(bigExcess / bigSignals, 4),
    baseSamples,
    baseHits,
    baseRate: baseSamples === 0 ? null : round(baseHits / baseSamples, 4),
    avgBaseExcess: baseSamples === 0 ? null : round(baseExcess / baseSamples, 4),
  };
}
