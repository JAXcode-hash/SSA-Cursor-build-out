import { defineTool } from "@grok/agent-sdk/tools";
import { join } from "node:path";
import { alertInput, asAlert } from "../lib/alert-schema.js";
import { getDb, openIsolatedDb } from "../lib/db.js";
import { publishPrepared } from "../lib/publish.js";
import { loadSnapshot } from "../lib/snapshot.js";

export default defineTool({
  description:
    "Publish one accepted long or short alert. Recomputes the payload from SEC, quotes, tags, and bands. Rejects a price, ratio, date, or tag that is not in that payload. Opens one ledger row and posts one Discord embed. A second open alert for the same ticker and side is not posted.",
  effect: "write",
  inputSchema: alertInput,
  async execute(input, ctx) {
    const alert = asAlert(input);
    let snapshot;
    try {
      snapshot = await loadSnapshot(alert.ticker);
    } catch (error) {
      return {
        accepted: false,
        posted: false,
        reason: error instanceof Error ? error.message : "snapshot failed",
      };
    }
    const live = ctx.session.purpose !== "eval" && !ctx.session.dryRun;
    const db = live ? await getDb() : await openIsolatedDb();
    return publishPrepared({
      alert,
      snapshot,
      db,
      now: ctx.now(),
      post: live && Boolean(process.env.DISCORD_WEBHOOK_URL),
      stateDir: join(ctx.stateRoot, "alerts"),
    });
  },
});
