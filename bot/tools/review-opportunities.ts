import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { getDb, openIsolatedDb } from "../lib/db.js";
import { dailyBars } from "../lib/quotes.js";
import { reviewOpenBook } from "../lib/review.js";

export default defineTool({
  description:
    "Mark every open opportunity at the latest close. Close it when that close has traded through the target or invalidation, or when the horizon date is in the past. Invalidation wins if both levels trade. The stored return is the price return, not a brokerage profit.",
  effect: "write",
  inputSchema: z.object({}),
  async execute(_input, ctx) {
    const live = ctx.session.purpose !== "eval" && !ctx.session.dryRun;
    const db = live ? await getDb() : await openIsolatedDb();
    return reviewOpenBook({
      db,
      now: ctx.now(),
      post: live && Boolean(process.env.DISCORD_WEBHOOK_URL),
      async quote(ticker) {
        const { bars } = await dailyBars(ticker);
        const last = bars.at(-1);
        if (!last) return null;
        return { high: last.high, low: last.low, close: last.close };
      },
    });
  },
});