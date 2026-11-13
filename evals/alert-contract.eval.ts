import { defineEval, equals } from "@grok/agent-sdk/evals";
import { DISCLAIMER } from "../bot/lib/types.js";
import { contractCases, longDiscordPayload } from "./fixtures.js";

export default defineEval({
  description: "Fixture long, fixture short, a rejected invented price, and the Discord embed body.",
  cases: [
    {
      id: "valid-long",
      async test(t) {
        const found = contractCases().find((entry) => entry.name === "valid-long");
        t.check(found?.accepted, equals(true));
      },
    },
    {
      id: "valid-short",
      async test(t) {
        const found = contractCases().find((entry) => entry.name === "valid-short");
        t.check(found?.accepted, equals(true));
      },
    },
    {
      id: "invented-price",
      async test(t) {
        const found = contractCases().find((entry) => entry.name === "invented-price");
        t.check(found?.accepted, equals(false));
        t.check(found?.reason ?? "", equals("price is not in the tool payload"));
      },
    },
    {
      id: "discord-payload",
      async test(t) {
        const payload = longDiscordPayload();
        t.check(payload.username, equals("SSA Desk"));
        t.check(payload.embeds[0]?.title, equals("Long KO"));
        t.check(payload.embeds[0]?.color, equals(0x2ecc71));
        t.check(payload.embeds[0]?.footer?.text, equals(DISCLAIMER));
        t.check(payload.embeds.length, equals(1));
      },
    },
  ],
});
