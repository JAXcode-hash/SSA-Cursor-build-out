import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loadConfig } from "../lib/config.js";
import { dailyBars } from "../lib/quotes.js";
import { curatedLinks } from "../lib/supply.js";

export default defineTool({
  description:
    "Watchlist names whose last daily close moved at least the configured threshold, with curated supply-chain names attached.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    const threshold = loadConfig().moverThreshold;
    const movers: Array<{
      ticker: string;
      change: number;
      close: number;
      links: ReturnType<typeof curatedLinks>;
    }> = [];
    const errors: Array<{ ticker: string; error: string }> = [];
    for (const ticker of loadConfig().tickers) {
      try {
        const quote = await dailyBars(ticker);
        const last = quote.bars.at(-1);
        const previous = quote.bars.at(-2);
        if (!last || !previous || previous.close === 0) continue;
        const change = (last.close - previous.close) / previous.close;
        if (Math.abs(change) >= threshold) {
          movers.push({
            ticker,
            change: Math.round(change * 10000) / 10000,
            close: last.close,
            links: curatedLinks(ticker),
          });
        }
      } catch (error) {
        errors.push({ ticker, error: error instanceof Error ? error.message : "quote failed" });
      }
    }
    return { threshold, movers, errors };
  },
});
