import { round } from "./numbers.js";
import type { Bar } from "./types.js";

export type PairedReturn = { date: string; stock: number; market: number };

export function pairedReturns(stock: Bar[], market: Bar[]): PairedReturn[] {
  const marketClose = new Map(market.map((bar) => [bar.date, bar.close]));
  const pairs: PairedReturn[] = [];
  let previousStock: number | null = null;
  let previousMarket: number | null = null;
  for (const bar of stock) {
    const close = marketClose.get(bar.date);
    if (close === undefined) continue;
    if (previousStock !== null && previousMarket !== null && previousStock > 0 && previousMarket > 0) {
      pairs.push({
        date: bar.date,
        stock: bar.close / previousStock - 1,
        market: close / previousMarket - 1,
      });
    }
    previousStock = bar.close;
    previousMarket = close;
  }
  return pairs;
}

export function beta(pairs: PairedReturn[]): number | null {
  if (pairs.length < 2) return null;
  const meanStock = pairs.reduce((sum, row) => sum + row.stock, 0) / pairs.length;
  const meanMarket = pairs.reduce((sum, row) => sum + row.market, 0) / pairs.length;
  let covariance = 0;
  let variance = 0;
  for (const row of pairs) {
    const stockGap = row.stock - meanStock;
    const marketGap = row.market - meanMarket;
    covariance += stockGap * marketGap;
    variance += marketGap * marketGap;
  }
  if (variance === 0) return null;
  return covariance / variance;
}

export function annualizedVolatility(returns: number[]): number | null {
  if (returns.length < 2) return null;
  const mean = returns.reduce((sum, value) => sum + value, 0) / returns.length;
  const variance = returns.reduce((sum, value) => sum + (value - mean) ** 2, 0) / (returns.length - 1);
  return Math.sqrt(variance) * Math.sqrt(252);
}

export function windowReturn(bars: Bar[], dates: string[]): number | null {
  if (dates.length < 2) return null;
  const close = new Map(bars.map((bar) => [bar.date, bar.close]));
  const first = close.get(dates[0] ?? "");
  const last = close.get(dates.at(-1) ?? "");
  if (first === undefined || last === undefined || first <= 0) return null;
  return last / first - 1;
}

export type RiskReading = {
  sessions: number;
  beta: number;
  volatility: number;
  stockReturn: number;
  marketReturn: number;
  excessReturn: number;
};

export function riskReading(stock: Bar[], market: Bar[]): RiskReading | null {
  const pairs = pairedReturns(stock, market);
  const slope = beta(pairs);
  const stockVol = annualizedVolatility(pairs.map((row) => row.stock));
  const dates = [];
  const marketDates = new Set(market.map((bar) => bar.date));
  for (const bar of stock) {
    if (marketDates.has(bar.date)) dates.push(bar.date);
  }
  const stockReturn = windowReturn(stock, dates);
  const marketReturn = windowReturn(market, dates);
  if (slope === null || stockVol === null || stockReturn === null || marketReturn === null) return null;
  return {
    sessions: pairs.length,
    beta: round(slope, 4),
    volatility: round(stockVol, 4),
    stockReturn: round(stockReturn, 4),
    marketReturn: round(marketReturn, 4),
    excessReturn: round(stockReturn - marketReturn, 4),
  };
}
