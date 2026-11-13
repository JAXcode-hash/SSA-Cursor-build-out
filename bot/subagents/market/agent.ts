import { defineAgent } from "@grok/agent-sdk";
import { commercialModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "Watchlist movers and curated or 10-K supply-chain links for one ticker.",
  model: commercialModel(),
});
