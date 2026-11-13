import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loadSnapshot } from "../lib/snapshot.js";

export default defineTool({
  description:
    "Assign size, style, cycle, and sector from the quote profile and SEC figures. Copy these tags. A label that is not in this payload is rejected.",
  effect: "read",
  inputSchema: z.object({
    ticker: z.string(),
  }),
  async execute({ ticker }) {
    try {
      const snapshot = await loadSnapshot(ticker);
      return {
        ticker: snapshot.ticker,
        tags: snapshot.tags,
        inputs: {
          marketCap: snapshot.marketCap,
          revenueGrowth: snapshot.revenueGrowth,
          trailingPe: snapshot.trailingPe,
          peerCount: snapshot.peerTrailingPes.length,
          dividendPerShare: snapshot.dividendPerShare,
          sector: snapshot.sector,
        },
      };
    } catch (error) {
      return { ticker: ticker.toUpperCase(), error: error instanceof Error ? error.message : "tags failed" };
    }
  },
});
