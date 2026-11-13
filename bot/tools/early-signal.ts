import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { scanEarly } from "../lib/early.js";

export default defineTool({
  description:
    "Search the expanded early universe for turns that have not yet shown up in the six-month record. A big position is an early signal whose last 20 sessions beat SPY by at least 8 points. Returns the names ranked by that move, plus the walk-forward hit rate. This is not a long and it does not place an order.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    return scanEarly();
  },
});