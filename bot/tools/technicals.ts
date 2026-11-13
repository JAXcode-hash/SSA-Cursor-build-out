import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loadSnapshot } from "../lib/snapshot.js";

export default defineTool({
  description:
    "SMA20, SMA50, RSI14, and ATR14 from the latest daily bars, plus the long and short entry, target, and invalidation levels. Bands are arithmetic. Copy them.",
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
        technicals: snapshot.technicals,
        long: snapshot.longBand,
        short: snapshot.shortBand,
      };
    } catch (error) {
      return { ticker: ticker.toUpperCase(), error: error instanceof Error ? error.message : "technicals failed" };
    }
  },
});
