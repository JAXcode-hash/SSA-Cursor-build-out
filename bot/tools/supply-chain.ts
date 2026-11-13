import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { loadConfig } from "../lib/config.js";
import { supplyFor } from "../lib/supply.js";

export default defineTool({
  description:
    "Related tickers from the curated supplier map. A 10-K mention of a known ticker is tagged stated. Missing links stay missing.",
  effect: "read",
  inputSchema: z.object({
    ticker: z.string(),
  }),
  async execute({ ticker }) {
    const symbol = ticker.toUpperCase();
    const links = await supplyFor(symbol);
    const members = loadConfig().themes.map((theme) => ({ id: theme.id, tickers: theme.tickers }));
    return { ticker: symbol, links, themes: members };
  },
});
