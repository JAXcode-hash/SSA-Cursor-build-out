import { readFileSync } from "node:fs";
import { join } from "node:path";
import { dataDir } from "./paths.js";
import type { ThemeId } from "./types.js";

export type ThemeBasket = {
  id: ThemeId;
  marketCapFloor: number;
  tickers: string[];
};

export type SupplyRecord = {
  ticker: string;
  related: string;
  relation: "supplier" | "customer";
  source: "stated" | "curated";
  confidence: number;
};

export type DeskConfig = {
  marketCapFloor: number;
  peExtremeMultiple: number;
  moverThreshold: number;
  tickers: string[];
  themes: ThemeBasket[];
  sectorCycle: Record<string, string[]>;
  supplyLinks: SupplyRecord[];
};

let cached: DeskConfig | null = null;

function readJson<T>(path: string): T {
  return JSON.parse(readFileSync(path, "utf8")) as T;
}

export function loadConfig(): DeskConfig {
  if (cached) return cached;
  const watchlist = readJson<{
    marketCapFloor: number;
    peExtremeMultiple: number;
    moverThreshold: number;
    tickers: string[];
  }>(join(dataDir, "watchlist.json"));
  const ai = readJson<ThemeBasket>(join(dataDir, "themes", "ai.json"));
  const quantum = readJson<ThemeBasket>(join(dataDir, "themes", "quantum.json"));
  const sectorCycle = readJson<Record<string, string[]>>(join(dataDir, "sector-cycle.json"));
  const supply = readJson<{ links: SupplyRecord[] }>(join(dataDir, "supply-chain.json"));
  cached = {
    marketCapFloor: watchlist.marketCapFloor,
    peExtremeMultiple: watchlist.peExtremeMultiple,
    moverThreshold: watchlist.moverThreshold,
    tickers: watchlist.tickers.map((ticker) => ticker.toUpperCase()),
    themes: [ai, quantum].map((theme) => ({
      ...theme,
      tickers: theme.tickers.map((ticker) => ticker.toUpperCase()),
    })),
    sectorCycle,
    supplyLinks: supply.links.map((link) => ({
      ...link,
      ticker: link.ticker.toUpperCase(),
      related: link.related.toUpperCase(),
    })),
  };
  return cached;
}

export function themesFor(ticker: string, config: DeskConfig = loadConfig()): ThemeId[] {
  const symbol = ticker.toUpperCase();
  return config.themes.filter((theme) => theme.tickers.includes(symbol)).map((theme) => theme.id);
}

export function marketCapFloor(ticker: string, config: DeskConfig = loadConfig()): number {
  const symbol = ticker.toUpperCase();
  const floors = [config.marketCapFloor];
  for (const theme of config.themes) {
    if (theme.tickers.includes(symbol)) floors.push(theme.marketCapFloor);
  }
  return Math.min(...floors);
}

export function universe(config: DeskConfig = loadConfig()): string[] {
  const names = new Set(config.tickers);
  for (const theme of config.themes) {
    for (const ticker of theme.tickers) names.add(ticker);
  }
  return [...names];
}
