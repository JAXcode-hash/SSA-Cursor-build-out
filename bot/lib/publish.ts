import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { alertPayload, postDiscord, type DiscordPayload } from "./discord.js";
import type { SqlClient } from "./db.js";
import { openOpportunity } from "./ledger.js";
import type { Alert } from "./types.js";
import { validateAlert } from "./validate.js";
import type { Snapshot } from "./types.js";

export type PublishResult = {
  accepted: boolean;
  reason?: string;
  opportunityId?: string;
  posted: boolean;
  payload?: DiscordPayload;
};

export async function publishPrepared(input: {
  alert: Alert;
  snapshot: Snapshot;
  db: SqlClient;
  now: Date;
  post: boolean;
  stateDir?: string;
}): Promise<PublishResult> {
  const verdict = validateAlert(input.alert, input.snapshot);
  if (!verdict.ok) return { accepted: false, reason: verdict.reason, posted: false };
  const payload = alertPayload(input.alert);
  const opened = await openOpportunity(input.db, input.alert, input.now);
  if (!opened.ok) return { accepted: false, reason: opened.reason, posted: false, payload };
  if (input.stateDir) {
    try {
      await mkdir(input.stateDir, { recursive: true });
      await writeFile(join(input.stateDir, `${opened.row.id}.json`), JSON.stringify(payload, null, 2));
    } catch {
      // The ledger row is the lock. A local copy is only for desks without a webhook.
    }
  }
  if (!input.post) return { accepted: true, opportunityId: opened.row.id, posted: false, payload };
  const delivery = await postDiscord(payload);
  return {
    accepted: true,
    opportunityId: opened.row.id,
    posted: delivery.posted,
    reason: delivery.reason,
    payload,
  };
}
