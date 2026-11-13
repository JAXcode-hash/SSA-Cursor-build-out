import { loadConfig } from "./config.js";
import { median } from "./numbers.js";
import {
  GICS_SECTORS,
  GROWTH_MIN,
  LARGE_CAP,
  MID_CAP,
  type CycleTag,
  type GicsSector,
  type SizeTag,
  type StyleTag,
  type Tags,
} from "./types.js";

const SECTOR_ALIASES: Record<string, GicsSector> = {
  Energy: "Energy",
  Materials: "Materials",
  "Basic Materials": "Materials",
  Industrials: "Industrials",
  "Consumer Discretionary": "Consumer Discretionary",
  "Consumer Cyclical": "Consumer Discretionary",
  "Consumer Staples": "Consumer Staples",
  "Consumer Defensive": "Consumer Staples",
  "Health Care": "Health Care",
  Healthcare: "Health Care",
  Financials: "Financials",
  Financial: "Financials",
  "Financial Services": "Financials",
  "Information Technology": "Information Technology",
  Technology: "Information Technology",
  "Communication Services": "Communication Services",
  Utilities: "Utilities",
  "Real Estate": "Real Estate",
};

export type TagInput = {
  marketCap: number;
  revenueGrowth: number | null;
  trailingPe: number | null;
  peerTrailingPes: number[];
  dividendPerShare: number | null;
  sector: string | null;
};

export function normalizeSector(sector: string | null | undefined): string {
  if (!sector) return "";
  const mapped = SECTOR_ALIASES[sector.trim()];
  if (!mapped) return "";
  return GICS_SECTORS.includes(mapped) ? mapped : "";
}

export function sizeTag(marketCap: number): SizeTag {
  if (marketCap >= LARGE_CAP) return "Large Cap";
  if (marketCap >= MID_CAP) return "Mid Cap";
  return "Small Cap";
}

export function cycleForSector(sector: string): CycleTag {
  if (!sector) return "";
  const map = loadConfig().sectorCycle;
  for (const [cycle, sectors] of Object.entries(map)) {
    if (sectors.includes(sector)) {
      if (cycle === "Cyclical" || cycle === "Defensive") return cycle;
    }
  }
  return "";
}

export function assignTags(input: TagInput): Tags {
  const sector = normalizeSector(input.sector);
  const styles: StyleTag[] = [];
  if (input.revenueGrowth !== null && input.revenueGrowth >= GROWTH_MIN) {
    styles.push("Growth Stock");
  }
  if (
    input.trailingPe !== null &&
    input.trailingPe > 0 &&
    input.peerTrailingPes.length >= 3
  ) {
    const peerMedian = median(input.peerTrailingPes);
    if (peerMedian !== null && input.trailingPe < peerMedian) {
      styles.push("Value Stock");
    }
  }
  if (input.dividendPerShare !== null && input.dividendPerShare > 0) {
    styles.push("Dividend Stock");
  }
  return {
    size: sizeTag(input.marketCap),
    styles,
    cycle: cycleForSector(sector),
    sector,
  };
}

export function sameTags(left: Tags, right: Tags): boolean {
  return (
    left.size === right.size &&
    left.cycle === right.cycle &&
    left.sector === right.sector &&
    left.styles.length === right.styles.length &&
    left.styles.every((style, index) => style === right.styles[index])
  );
}
