import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loadSnapshot } from "../lib/snapshot.js";

export default defineTool({
  description:
    "SEC companyfacts plus the latest public quote for one US ticker. Returns price, market cap, trailing P/E, P/E versus the watchlist median, revenue growth, dividend per share, sector, and theme membership. Does not invent figures.",
  effect: "read",
  inputSchema: z.object({
    ticker: z.string(),
  }),
  async execute({ ticker }) {
    try {
      const snapshot = await loadSnapshot(ticker);
      return {
        ticker: snapshot.ticker,
        price: snapshot.price,
        marketCap: snapshot.marketCap,
        trailingPe: snapshot.trailingPe,
        peVsWatchlistMedian: snapshot.peVsWatchlistMedian,
        revenueGrowth: snapshot.revenueGrowth,
        dividendPerShare: snapshot.dividendPerShare,
        sector: snapshot.sector,
        themes: snapshot.themes,
        evidenceIds: [
          "fundamentals.price",
          "fundamentals.marketCap",
          "fundamentals.trailingPe",
          "fundamentals.peVsWatchlistMedian",
          "fundamentals.revenueGrowth",
        ],
      };
    } catch (error) {
      return { ticker: ticker.toUpperCase(), error: error instanceof Error ? error.message : "fundamentals failed" };
    }
  },
});
