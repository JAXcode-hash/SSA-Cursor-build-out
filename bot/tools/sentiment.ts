import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { sentimentFor } from "../lib/sentiment.js";

export default defineTool({
  description:
    "Sentiment score from X when X_BEARER_TOKEN is set. Otherwise headlines, labeled source headlines. The score is a lexicon over the fetched text.",
  effect: "read",
  inputSchema: z.object({
    ticker: z.string(),
  }),
  async execute({ ticker }) {
    try {
      const sentiment = await sentimentFor(ticker);
      return { ticker: ticker.toUpperCase(), ...sentiment };
    } catch (error) {
      return { ticker: ticker.toUpperCase(), error: error instanceof Error ? error.message : "sentiment failed" };
    }
  },
});
