import { defineAgent } from "@grok/agent-sdk";
import { commercialModel } from "./lib/model-route.js";

export default defineAgent({
  description:
    "Advisory US equity research desk. Publishes Discord alerts and records opportunity price returns. Does not place trades.",
  model: commercialModel(),
});
