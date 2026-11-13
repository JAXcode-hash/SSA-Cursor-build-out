import { closePayload, postDiscord } from "./discord.js";
import type { SqlClient } from "./db.js";
import { closeOpportunity, insertMark, listOpen, reasonFor } from "./ledger.js";
import { londonDate } from "./numbers.js";

export type BarQuote = { high: number; low: number; close: number };

export async function reviewOpenBook(input: {
  db: SqlClient;
  now: Date;
  quote: (ticker: string) => Promise<BarQuote | null>;
  post: boolean;
}): Promise<{
  marked: string[];
  closed: Array<{ id: string; ticker: string; side: string; reason: string; returnPct: number }>;
  skipped: Array<{ ticker: string; reason: string }>;
}> {
  const today = londonDate(input.now);
  const marked: string[] = [];
  const closed: Array<{ id: string; ticker: string; side: string; reason: string; returnPct: number }> = [];
  const skipped: Array<{ ticker: string; reason: string }> = [];
  for (const row of await listOpen(input.db)) {
    const bar = await input.quote(row.ticker).catch(() => null);
    if (!bar) {
      skipped.push({ ticker: row.ticker, reason: "no quote" });
      continue;
    }
    await insertMark(input.db, row, bar.close, input.now);
    marked.push(row.id);
    const reason = reasonFor(row, bar, today);
    if (!reason) continue;
    const updated = await closeOpportunity(input.db, row, bar.close, reason, input.now);
    if (!updated || updated.returnPct === null) continue;
    closed.push({
      id: updated.id,
      ticker: updated.ticker,
      side: updated.side,
      reason,
      returnPct: updated.returnPct,
    });
    if (input.post) {
      await postDiscord(
        closePayload({
          ticker: updated.ticker,
          side: updated.side,
          startedAt: updated.startedAt,
          endedAt: updated.endedAt ?? input.now.toISOString(),
          entryPrice: updated.entryPrice,
          exitPrice: bar.close,
          closeReason: reason,
          returnPct: updated.returnPct,
        }),
      );
    }
  }
  return { marked, closed, skipped };
}
