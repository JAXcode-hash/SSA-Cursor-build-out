import { defineAgent } from "@grok/agent-sdk";
import { commercialModel } from "../../lib/model-route.js";

export default defineAgent({
  description: "Long or pass for one ticker after the fundamental screen and the computed entry band.",
  model: commercialModel(),
});
