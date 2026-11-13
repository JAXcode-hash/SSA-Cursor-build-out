import { universe } from "./config.js";
import { dailyBars } from "./quotes.js";
import { combinePrice, companyFacts, entityName, figuresFromFacts } from "./sec.js";
import type { Bar } from "./types.js";

export type ListedStock = {
  ticker: string;
  companyName: string;
  price: number;
  marketCap: number | null;
  trailingPe: number | null;
  revenueGrowth: number | null;
  dividendPerShare: number | null;
  sector: string | null;
  bars: Bar[];
};

const TTL_MS = 15 * 60 * 1000;
let cached: { at: number; rows: ListedStock[] } | null = null;

export function clearBasketCache(): void {
  cached = null;
}

export async function listWatchlist(): Promise<ListedStock[]> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached.rows;
  const rows: ListedStock[] = [];
  for (const ticker of universe()) {
    try {
      const quote = await dailyBars(ticker);
      const price = quote.profile.price ?? quote.bars.at(-1)?.close;
      if (price === undefined || price === null) continue;
      let facts: unknown = null;
      try {
        facts = await companyFacts(ticker);
      } catch {
        facts = null;
      }
      const figures = facts
        ? figuresFromFacts(facts)
        : { ttmEps: null, shares: null, revenueGrowth: null, dividendPerShare: null };
      const combined = combinePrice(price, figures, quote.profile.marketCap, quote.profile.trailingPe);
      const filingName = facts ? entityName(facts) : "";
      rows.push({
        ticker,
        companyName: quote.profile.companyName || filingName || ticker,
        price,
        marketCap: combined.marketCap,
        trailingPe: combined.trailingPe,
        revenueGrowth: figures.revenueGrowth,
        dividendPerShare: figures.dividendPerShare,
        sector: quote.profile.sector,
        bars: quote.bars,
      });
    } catch {
      continue;
    }
  }
  cached = { at: Date.now(), rows };
  return rows;
}
