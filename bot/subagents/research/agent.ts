import { defineAgent } from "@grok/agent-sdk";
import { commercialModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "Fundamental screen for one ticker: trailing P/E, market cap, revenue growth, and dividends from the fundamentals tool.",
  model: commercialModel(),
});
