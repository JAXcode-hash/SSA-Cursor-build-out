import { defineAgent } from "@grok/agent-sdk";
import { localFirstModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "Rank AI-basket tickers already listed by the supply-chain tool. Does not add names.",
  model: localFirstModel(),
});
