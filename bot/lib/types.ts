export const GICS_SECTORS = [
  "Energy",
  "Materials",
  "Industrials",
  "Consumer Discretionary",
  "Consumer Staples",
  "Health Care",
  "Financials",
  "Information Technology",
  "Communication Services",
  "Utilities",
  "Real Estate",
] as const;

export type GicsSector = (typeof GICS_SECTORS)[number];

export const SIZE_TAGS = ["Large Cap", "Mid Cap", "Small Cap"] as const;
export type SizeTag = (typeof SIZE_TAGS)[number];

export const STYLE_TAGS = ["Growth Stock", "Value Stock", "Dividend Stock"] as const;
export type StyleTag = (typeof STYLE_TAGS)[number];

export const CYCLE_TAGS = ["Cyclical", "Defensive"] as const;
export type CycleTag = (typeof CYCLE_TAGS)[number] | "";

export type ThemeId = "ai" | "quantum-cryptography";
export type Side = "long" | "short" | "pass";
export type OpenSide = "long" | "short";
export type CloseReason = "target" | "invalidation" | "horizon";
export type SentimentSource = "x" | "headlines";
export type LinkSource = "stated" | "curated";

export type Tags = {
  size: SizeTag;
  styles: StyleTag[];
  cycle: CycleTag;
  sector: string;
};

export type Bar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume?: number;
};

export type Technicals = {
  sma20: number;
  sma50: number;
  rsi14: number;
  atr14: number;
};

export type Band = {
  low: number;
  high: number;
  target: number;
  invalidation: number;
};

export type SupplyLink = {
  ticker: string;
  source: LinkSource;
  confidence: number;
};

export type Sentiment = {
  score: number;
  source: SentimentSource;
  volatilityNote: string;
};

export type Alert = {
  ticker: string;
  side: Side;
  horizon: number;
  thesis: string;
  evidenceIds: string[];
  fundamentals: {
    price: number;
    marketCap: number;
    trailingPe: number | null;
    peVsWatchlistMedian: number | null;
  };
  technicals: Technicals;
  entry: { low: number; high: number };
  exit: { target: number; invalidation: number };
  sentiment: Sentiment;
  supplyChain: SupplyLink[];
  themes: ThemeId[];
  tags: Tags;
  disclaimer: string;
};

export type Snapshot = {
  ticker: string;
  companyName: string;
  price: number;
  marketCap: number;
  trailingPe: number | null;
  peVsWatchlistMedian: number | null;
  revenueGrowth: number | null;
  dividendPerShare: number | null;
  sector: string;
  peerTrailingPes: number[];
  technicals: Technicals;
  longBand: Band & { inBand: boolean };
  shortBand: Band & { extended: boolean };
  sentiment: Sentiment;
  supplyChain: SupplyLink[];
  themes: ThemeId[];
  tags: Tags;
  latestBar: { high: number; low: number; close: number };
};

export type OpportunityRow = {
  id: string;
  ticker: string;
  side: OpenSide;
  theme: string | null;
  status: "open" | "closed";
  sizeTag: SizeTag;
  styleTags: StyleTag[];
  cycleTag: string;
  sector: string;
  startedAt: string;
  endedAt: string | null;
  horizonOn: string;
  entryPrice: number;
  entryLow: number;
  entryHigh: number;
  targetPrice: number;
  invalidationPrice: number;
  exitPrice: number | null;
  closeReason: CloseReason | null;
  returnPct: number | null;
  thesis: string;
};

export const DISCLAIMER =
  "Research alert only. Not a solicitation to buy or sell any security. The return in the ledger is a price change, not a brokerage profit.";

export const EVIDENCE_IDS = [
  "fundamentals.price",
  "fundamentals.marketCap",
  "fundamentals.trailingPe",
  "fundamentals.peVsWatchlistMedian",
  "fundamentals.revenueGrowth",
  "technicals.sma20",
  "technicals.sma50",
  "technicals.rsi14",
  "technicals.atr14",
  "entry",
  "exit",
  "sentiment",
  "supplyChain",
  "tags",
] as const;

export const LARGE_CAP = 10_000_000_000;
export const MID_CAP = 2_000_000_000;
export const GROWTH_MIN = 0.1;
export const SENTIMENT_EXTREME = -0.4;
