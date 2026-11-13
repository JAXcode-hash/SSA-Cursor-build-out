import { loadConfig, themesFor, universe } from "./config.js";
import { median, round } from "./numbers.js";
import { dailyBars } from "./quotes.js";
import { combinePrice, companyFacts, figuresFromFacts } from "./sec.js";
import { sentimentFor } from "./sentiment.js";
import { supplyFor } from "./supply.js";
import { assignTags, normalizeSector } from "./tags.js";
import { bands } from "./technicals.js";
import type { Snapshot } from "./types.js";

type Peer = { ticker: string; sector: string; trailingPe: number | null };

const cache = new Map<string, { at: number; snapshot: Snapshot }>();
const TTL_MS = 15 * 60 * 1000;

async function peerQuotes(focus: string): Promise<Peer[]> {
  const peers: Peer[] = [];
  for (const ticker of universe()) {
    if (ticker === focus) continue;
    try {
      const quote = await dailyBars(ticker);
      peers.push({
        ticker,
        sector: quote.profile.sector ?? "",
        trailingPe: quote.profile.trailingPe,
      });
    } catch {
      peers.push({ ticker, sector: "", trailingPe: null });
    }
  }
  return peers;
}

export async function loadSnapshot(ticker: string): Promise<Snapshot> {
  const symbol = ticker.toUpperCase();
  const hit = cache.get(symbol);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.snapshot;
  const quote = await dailyBars(symbol);
  const price = quote.profile.price ?? quote.bars.at(-1)?.close;
  if (price === undefined || price === null) throw new Error(`no price for ${symbol}`);
  let facts = null;
  try {
    facts = await companyFacts(symbol);
  } catch {
    facts = null;
  }
  const figures = facts ? figuresFromFacts(facts) : {
    ttmEps: null,
    shares: null,
    revenueGrowth: null,
    dividendPerShare: null,
  };
  const combined = combinePrice(price, figures, quote.profile.marketCap, quote.profile.trailingPe);
  if (combined.marketCap === null) throw new Error(`no market cap for ${symbol}`);
  const window = bands(quote.bars);
  if (!window) throw new Error(`not enough price history for ${symbol}`);
  const peers = await peerQuotes(symbol);
  const sector = quote.profile.sector;
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
    marketCap: combined.marketCap,
    revenueGrowth: figures.revenueGrowth,
    trailingPe: combined.trailingPe,
    peerTrailingPes,
    dividendPerShare: figures.dividendPerShare,
    sector,
  });
  const sentiment = await sentimentFor(symbol);
  const supplyChain = await supplyFor(symbol);
  const snapshot: Snapshot = {
    ticker: symbol,
    price: round(price, 4),
    marketCap: round(combined.marketCap, 2),
    trailingPe: combined.trailingPe === null ? null : round(combined.trailingPe, 4),
    peVsWatchlistMedian:
      combined.trailingPe !== null && watchlistMedian !== null && watchlistMedian > 0
        ? round(combined.trailingPe / watchlistMedian, 4)
        : null,
    revenueGrowth: figures.revenueGrowth === null ? null : round(figures.revenueGrowth, 4),
    dividendPerShare: figures.dividendPerShare,
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
      high: quote.bars.at(-1)?.high ?? price,
      low: quote.bars.at(-1)?.low ?? price,
      close: quote.bars.at(-1)?.close ?? price,
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
}
