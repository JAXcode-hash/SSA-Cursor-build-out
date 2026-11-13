import { defineSchedule } from "@grok/agent-sdk/schedules";

export default defineSchedule({
  // 11:30 UTC on weekdays. That is 11:30 in London during GMT and 12:30 during British Summer Time, about 06:30 America/New_York in winter.
  cron: "30 11 * * 1-5",
  markdown: `Run the weekday research desk. Do not place trades.

1. Call review-opportunities so each open row is marked or closed before anything new is published.
2. For the watchlist and the AI and quantum-cryptography baskets, call fundamentals, technicals, sentiment, supply-chain, and tags. Delegate research, market, sentiment, technical, theme-ai, and theme-quantum. Theme agents rank only tickers those tools list.
3. Delegate strategy-long and strategy-short. Publish a long or a short only through publish-alert. A pass is not posted. If publish-alert rejects the JSON, report the reason and do not replace a tool number.
4. The ledger already blocks a second open alert for the same ticker and side.`,
});
