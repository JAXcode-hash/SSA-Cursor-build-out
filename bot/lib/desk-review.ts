import { listWatchlist, type ListedStock } from "./basket.js";
import { loadConfig, themesFor } from "./config.js";
import { longGate, shortGate } from "./gates.js";
import { median, round } from "./numbers.js";
import { sentimentFor } from "./sentiment.js";
import { curatedLinks } from "./supply.js";
import { assignTags, normalizeSector } from "./tags.js";
import { bands } from "./technicals.js";
import type { Snapshot, Tags, ThemeId } from "./types.js";

export type ReviewRow = {
  ticker: string;
  companyName: string;
  price: number;
  marketCap: number | null;
  trailingPe: number | null;
  peVsWatchlistMedian: number | null;
  dividendPerShare: number | null;
  revenueGrowth: number | null;
  tags: Tags;
  themes: ThemeId[];
  inLongBand: boolean;
  extended: boolean;
  long: string;
  short: string;
  income: boolean;
  sentimentScore: number;
  sentimentNote: string;
  entryLow: number | null;
  entryHigh: number | null;
  shortEntryLow: number | null;
  shortEntryHigh: number | null;
  longTarget: number | null;
  longInvalidation: number | null;
  shortTarget: number | null;
  shortInvalidation: number | null;
};

function snapshotFor(row: ListedStock, peers: ListedStock[], sentimentScore: number, sentimentNote: string): { row: ReviewRow; snapshot: Snapshot | null } {
  const window = bands(row.bars);
  const focusSector = normalizeSector(row.sector);
  const peerTrailingPes = peers
    .filter((peer) => peer.trailingPe !== null && peer.trailingPe > 0 && focusSector !== "" && normalizeSector(peer.sector) === focusSector)
    .map((peer) => peer.trailingPe as number);
  const positivePeers = peers
    .filter((peer) => peer.trailingPe !== null && peer.trailingPe > 0)
    .map((peer) => peer.trailingPe as number);
  const watchlistMedian = positivePeers.length >= 3 ? median(positivePeers) : null;
  const marketCap = row.marketCap;
  const tags = assignTags({
    marketCap: marketCap ?? 0,
    revenueGrowth: row.revenueGrowth,
    trailingPe: row.trailingPe,
    peerTrailingPes,
    dividendPerShare: row.dividendPerShare,
    sector: row.sector,
  });
  const peVsWatchlistMedian =
    row.trailingPe !== null && watchlistMedian !== null && watchlistMedian > 0
      ? round(row.trailingPe / watchlistMedian, 4)
      : null;
  const review: ReviewRow = {
    ticker: row.ticker,
    companyName: row.companyName,
    price: round(row.price, 2),
    marketCap: marketCap === null ? null : round(marketCap, 0),
    trailingPe: row.trailingPe === null ? null : round(row.trailingPe, 2),
    peVsWatchlistMedian,
    dividendPerShare: row.dividendPerShare,
    revenueGrowth: row.revenueGrowth === null ? null : round(row.revenueGrowth, 4),
    tags,
    themes: themesFor(row.ticker),
    inLongBand: window?.longBand.inBand ?? false,
    extended: window?.shortBand.extended ?? false,
    long: marketCap === null ? "no market cap" : "not enough price history",
    short: marketCap === null ? "no market cap" : "not enough price history",
    income: tags.styles.includes("Dividend Stock") && (row.dividendPerShare ?? 0) > 0,
    sentimentScore,
    sentimentNote,
    entryLow: window?.longBand.low ?? null,
    entryHigh: window?.longBand.high ?? null,
    shortEntryLow: window?.shortBand.low ?? null,
    shortEntryHigh: window?.shortBand.high ?? null,
    longTarget: window?.longBand.target ?? null,
    longInvalidation: window?.longBand.invalidation ?? null,
    shortTarget: window?.shortBand.target ?? null,
    shortInvalidation: window?.shortBand.invalidation ?? null,
  };
  if (!window || marketCap === null) return { row: review, snapshot: null };
  return {
    row: review,
    snapshot: {
      ticker: row.ticker,
      companyName: row.companyName,
      price: row.price,
      marketCap,
      trailingPe: row.trailingPe,
      peVsWatchlistMedian,
      revenueGrowth: row.revenueGrowth,
      dividendPerShare: row.dividendPerShare,
      sector: tags.sector,
      peerTrailingPes,
      technicals: window.technicals,
      longBand: window.longBand,
      shortBand: window.shortBand,
      sentiment: { score: sentimentScore, source: "headlines", volatilityNote: sentimentNote },
      supplyChain: curatedLinks(row.ticker),
      themes: themesFor(row.ticker),
      tags,
      latestBar: {
        high: row.bars.at(-1)?.high ?? row.price,
        low: row.bars.at(-1)?.low ?? row.price,
        close: row.bars.at(-1)?.close ?? row.price,
      },
    },
  };
}

export async function reviewWatchlist(): Promise<ReviewRow[]> {
  const book = await listWatchlist();
  const extreme = loadConfig().peExtremeMultiple;
  const rows: ReviewRow[] = [];
  for (const row of book) {
    let sentimentNote = "sparse headlines";
    let sentimentScore = 0;
    try {
      const sentiment = await sentimentFor(row.ticker);
      sentimentScore = sentiment.score;
      sentimentNote = sentiment.volatilityNote;
    } catch {
      sentimentScore = 0;
    }
    const built = snapshotFor(row, book.filter((item) => item.ticker !== row.ticker), sentimentScore, sentimentNote);
    if (built.snapshot) {
      const long = longGate(built.snapshot, extreme);
      const short = shortGate(built.snapshot, extreme);
      built.row.long = long.ok ? "publish" : long.reason;
      built.row.short = short.ok ? "publish" : short.reason;
    }
    rows.push(built.row);
  }
  return rows;
}
