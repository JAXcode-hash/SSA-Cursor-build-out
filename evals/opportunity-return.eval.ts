import { defineEval, equals } from "@grok/agent-sdk/evals";
import { longTargetReturn, shortInvalidationReturn } from "./returns.js";

export default defineEval({
  description: "A long close through the target is a positive price return. A short close through invalidation is negative.",
  cases: [
    {
      id: "long-target",
      async test(t) {
        t.check(await longTargetReturn(), equals(0.15));
      },
    },
    {
      id: "short-invalidation",
      async test(t) {
        t.check(await shortInvalidationReturn(), equals(-0.12));
      },
    },
  ],
});
