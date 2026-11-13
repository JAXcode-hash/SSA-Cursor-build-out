import { defineEval, equals } from "@grok/agent-sdk/evals";
import { contractCases, missingSectorTags, smallTechTags, staplesTags } from "./fixtures.js";

export default defineEval({
  description: "Size, style, cycle, and sector tags, including a tag the model adds on its own.",
  cases: [
    {
      id: "large-staples",
      async test(t) {
        const tags = staplesTags();
        t.check(tags.size, equals("Large Cap"));
        t.check(tags.styles.join(","), equals("Value Stock,Dividend Stock"));
        t.check(tags.cycle, equals("Defensive"));
        t.check(tags.sector, equals("Consumer Staples"));
      },
    },
    {
      id: "small-growth-tech",
      async test(t) {
        const tags = smallTechTags();
        t.check(tags.size, equals("Small Cap"));
        t.check(tags.styles.join(","), equals("Growth Stock"));
        t.check(tags.cycle, equals("Cyclical"));
        t.check(tags.sector, equals("Information Technology"));
      },
    },
    {
      id: "missing-sector",
      async test(t) {
        const tags = missingSectorTags();
        t.check(tags.sector, equals(""));
        t.check(tags.cycle, equals(""));
      },
    },
    {
      id: "invented-tag",
      async test(t) {
        const found = contractCases().find((entry) => entry.name === "invented-tag");
        t.check(found?.accepted, equals(false));
      },
    },
  ],
});
