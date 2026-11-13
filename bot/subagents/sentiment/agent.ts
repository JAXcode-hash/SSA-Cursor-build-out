import { defineAgent } from "@grok/agent-sdk";
import { localFirstModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "Sentiment score for one ticker. Uses X when a token is configured, otherwise headlines.",
  model: localFirstModel(),
});
