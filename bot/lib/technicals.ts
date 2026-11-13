import { round } from "./numbers.js";
import type { Band, Bar, Technicals } from "./types.js";

export function sma(values: number[], length: number): number | null {
  if (values.length < length || length <= 0) return null;
  const window = values.slice(-length);
  const total = window.reduce((sum, value) => sum + value, 0);
  return total / length;
}

export function rsi(closes: number[], length = 14): number | null {
  if (closes.length < length + 1) return null;
  let gain = 0;
  let loss = 0;
  for (let i = 1; i <= length; i += 1) {
    const change = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    if (change >= 0) gain += change;
    else loss -= change;
  }
  let avgGain = gain / length;
  let avgLoss = loss / length;
  for (let i = length + 1; i < closes.length; i += 1) {
    const change = (closes[i] ?? 0) - (closes[i - 1] ?? 0);
    const up = change > 0 ? change : 0;
    const down = change < 0 ? -change : 0;
    avgGain = (avgGain * (length - 1) + up) / length;
    avgLoss = (avgLoss * (length - 1) + down) / length;
  }
  if (avgLoss === 0) return 100;
  const relative = avgGain / avgLoss;
  return 100 - 100 / (1 + relative);
}

function trueRanges(bars: Bar[]): number[] {
  return bars.map((bar, index) => {
    const previous = index === 0 ? bar.close : (bars[index - 1]?.close ?? bar.close);
    return Math.max(bar.high - bar.low, Math.abs(bar.high - previous), Math.abs(bar.low - previous));
  });
}

export function atr(bars: Bar[], length = 14): number | null {
  const ranges = trueRanges(bars);
  if (ranges.length < length) return null;
  let average = ranges.slice(0, length).reduce((sum, value) => sum + value, 0) / length;
  for (let i = length; i < ranges.length; i += 1) {
    average = (average * (length - 1) + (ranges[i] ?? 0)) / length;
  }
  return average;
}

export type BandSet = {
  technicals: Technicals;
  longBand: Band & { inBand: boolean };
  shortBand: Band & { extended: boolean };
};

export function bands(bars: Bar[]): BandSet | null {
  const closes = bars.map((bar) => bar.close).filter((value) => Number.isFinite(value));
  if (closes.length !== bars.length) return null;
  const sma20 = sma(closes, 20);
  const sma50 = sma(closes, 50);
  const rsi14 = rsi(closes, 14);
  const atr14 = atr(bars, 14);
  const close = closes.at(-1);
  if (
    sma20 === null ||
    sma50 === null ||
    rsi14 === null ||
    atr14 === null ||
    close === undefined ||
    atr14 <= 0
  ) {
    return null;
  }
  const technicals = {
    sma20: round(sma20),
    sma50: round(sma50),
    rsi14: round(rsi14),
    atr14: round(atr14),
  };
  const longLow = round(sma20 - atr14);
  const longHigh = round(sma20);
  const shortLow = round(sma20);
  const shortHigh = round(sma20 + atr14);
  const longStop = sma50 < close ? Math.max(close - 2 * atr14, sma50) : close - 2 * atr14;
  const shortStop = sma50 > close ? Math.min(close + 2 * atr14, sma50) : close + 2 * atr14;
  return {
    technicals,
    longBand: {
      low: longLow,
      high: longHigh,
      target: round(close + 2 * atr14),
      invalidation: round(longStop),
      inBand: close <= sma20 && close >= sma20 - atr14,
    },
    shortBand: {
      low: shortLow,
      high: shortHigh,
      target: round(close - 2 * atr14),
      invalidation: round(shortStop),
      extended: rsi14 >= 70 || close >= sma20 + atr14,
    },
  };
}
