import * as z from "zod/v4";
import type { Alert } from "./types.js";

export const alertInput = z.object({
  ticker: z.string().regex(/^[A-Za-z][A-Za-z0-9.\-]{0,9}$/),
  side: z.enum(["long", "short", "pass"]),
  horizon: z.number().int().min(5).max(120),
  thesis: z.string().min(1).max(1500),
  evidenceIds: z.array(z.string()).min(1),
  fundamentals: z.object({
    price: z.number(),
    marketCap: z.number(),
    trailingPe: z.number().nullable(),
    peVsWatchlistMedian: z.number().nullable(),
  }),
  technicals: z.object({
    sma20: z.number(),
    sma50: z.number(),
    rsi14: z.number(),
    atr14: z.number(),
  }),
  entry: z.object({
    low: z.number(),
    high: z.number(),
  }),
  exit: z.object({
    target: z.number(),
    invalidation: z.number(),
  }),
  sentiment: z.object({
    score: z.number().min(-1).max(1),
    source: z.enum(["x", "headlines"]),
    volatilityNote: z.string(),
  }),
  supplyChain: z.array(
    z.object({
      ticker: z.string(),
      source: z.enum(["stated", "curated"]),
      confidence: z.number().min(0).max(1),
    }),
  ),
  themes: z.array(z.enum(["ai", "quantum-cryptography"])),
  tags: z.object({
    size: z.enum(["Large Cap", "Mid Cap", "Small Cap"]),
    styles: z.array(z.enum(["Growth Stock", "Value Stock", "Dividend Stock"])),
    cycle: z.enum(["Cyclical", "Defensive", ""]),
    sector: z.string(),
  }),
  disclaimer: z.string(),
});

export function asAlert(input: z.infer<typeof alertInput>): Alert {
  return {
    ...input,
    ticker: input.ticker.toUpperCase(),
  };
}
