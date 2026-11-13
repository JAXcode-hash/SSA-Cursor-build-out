import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { buildSleeve } from "../lib/sleeve.js";

export default defineTool({
  description:
    "Select the higher-risk sleeve: 12 names from the candidate pool whose six-month price return beat SPY, with beta at least 1.2 and volatility above SPY. This is a trailing measurement, not a forecast, and it is not a long alert.",
  effect: "read",
  inputSchema: z.object({}),
  async execute() {
    return buildSleeve();
  },
});
