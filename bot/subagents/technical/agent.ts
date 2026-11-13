import { defineAgent } from "@grok/agent-sdk";
import { commercialModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "SMA, RSI, ATR, and the computed long and short entry and exit bands for one ticker.",
  model: commercialModel(),
});
