import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { scanEarly } from "../lib/early.js";

export default defineTool({
  description:
    "Score the risk-sleeve candidates for an early turn: the last 20 sessions beat SPY by at least 2 points, the longer window still lags, and at least two of RSI, the 50-day average, a non-extended price, or rising volume confirm it. Returns today's names and the walk-forward hit rate versus the base rate. This is not a long and it does not place an order.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    return scanEarly();
  },
});