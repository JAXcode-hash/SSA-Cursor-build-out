import { defineAgent } from "@grok/agent-sdk";
import { commercialModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "Short or pass for one ticker. A short needs deterioration, an extended tape, and a sentiment extreme.",
  model: commercialModel(),
});
