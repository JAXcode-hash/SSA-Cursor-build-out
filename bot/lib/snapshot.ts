import { listWatchlist, clearBasketCache } from "./basket.js";
import { loadConfig, themesFor } from "./config.js";
import { median, round } from "./numbers.js";
import { sentimentFor } from "./sentiment.js";
import { supplyFor } from "./supply.js";
import { assignTags, normalizeSector } from "./tags.js";
import { bands } from "./technicals.js";
import type { Snapshot } from "./types.js";

const cache = new Map<string, { at: number; snapshot: Snapshot }>();
const TTL_MS = 15 * 60 * 1000;

export async function loadSnapshot(ticker: string): Promise<Snapshot> {
  const symbol = ticker.toUpperCase();
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.snapshot;
  const book = await listWatchlist();
  const row = book.find((item) => item.ticker === symbol);
  if (!row) throw new Error(`no price for ${symbol}`);
  const price = row.price;
  if (row.marketCap === null) throw new Error(`no market cap for ${symbol}`);
  const window = bands(row.bars);
  if (!window) throw new Error(`not enough price history for ${symbol}`);
  const peers = book.filter((item) => item.ticker !== symbol);
  const sector = row.sector;
  const focusSector = normalizeSector(sector);
  const positivePeers = peers
    .filter((peer) => peer.trailingPe !== null && peer.trailingPe > 0)
    .map((peer) => peer.trailingPe as number);
  const watchlistMedian = positivePeers.length >= 3 ? median(positivePeers) : null;
  const peerTrailingPes = peers
    .filter((peer) => {
      if (peer.trailingPe === null || peer.trailingPe <= 0) return false;
      if (!focusSector) return false;
      return normalizeSector(peer.sector) === focusSector;
    })
    .map((peer) => peer.trailingPe as number);
  const tags = assignTags({
    marketCap: row.marketCap,
    revenueGrowth: row.revenueGrowth,
    trailingPe: row.trailingPe,
    peerTrailingPes,
    dividendPerShare: row.dividendPerShare,
    sector,
  });
  const sentiment = await sentimentFor(symbol);
  const supplyChain = await supplyFor(symbol);
  const snapshot: Snapshot = {
    ticker: symbol,
    companyName: row.companyName,
    price: round(price, 4),
    marketCap: round(row.marketCap, 2),
    trailingPe: row.trailingPe === null ? null : round(row.trailingPe, 4),
    peVsWatchlistMedian:
      row.trailingPe !== null && watchlistMedian !== null && watchlistMedian > 0
        ? round(row.trailingPe / watchlistMedian, 4)
        : null,
    revenueGrowth: row.revenueGrowth === null ? null : round(row.revenueGrowth, 4),
    dividendPerShare: row.dividendPerShare,
    sector: tags.sector,
    peerTrailingPes,
    technicals: window.technicals,
    longBand: window.longBand,
    shortBand: window.shortBand,
    sentiment: {
      score: sentiment.score,
      source: sentiment.source,
      volatilityNote: sentiment.volatilityNote,
    },
    supplyChain,
    themes: themesFor(symbol),
    tags,
    latestBar: {
      high: row.bars.at(-1)?.high ?? price,
      low: row.bars.at(-1)?.low ?? price,
      close: row.bars.at(-1)?.close ?? price,
    },
  };
  cache.set(symbol, { at: Date.now(), snapshot });
  return snapshot;
}

export function watchlistTickers(): string[] {
  return loadConfig().tickers;
}

export function clearSnapshotCache(): void {
  cache.clear();
  clearBasketCache();
}
