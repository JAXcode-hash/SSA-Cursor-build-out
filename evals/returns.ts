import { openIsolatedDb, type SqlClient } from "../bot/lib/db.js";
import { openOpportunity } from "../bot/lib/ledger.js";
import { reviewOpenBook } from "../bot/lib/review.js";
import { DISCLAIMER, type Alert } from "../bot/lib/types.js";

function shell(ticker: string, side: "long" | "short", entry: number, target: number, invalidation: number): Alert {
  return {
    ticker,
    side,
    horizon: 40,
    thesis: "Fixture row for the ledger.",
    evidenceIds: ["fundamentals.price"],
    fundamentals: {
      price: entry,
      marketCap: 80_000_000_000,
      trailingPe: 15,
      peVsWatchlistMedian: 0.7,
    },
    technicals: { sma20: entry, sma50: entry, rsi14: 50, atr14: 2 },
    entry: { low: entry - 2, high: entry },
    exit: { target, invalidation },
    sentiment: { score: 0, source: "headlines", volatilityNote: "fixture" },
    supplyChain: [],
    themes: [],
    tags: { size: "Large Cap", styles: [], cycle: "Defensive", sector: "Consumer Staples" },
    disclaimer: DISCLAIMER,
  };
}

export async function withLedger<T>(run: (db: SqlClient) => Promise<T>): Promise<T> {
  const db = await openIsolatedDb();
  try {
    return await run(db);
  } finally {
    await db.close();
  }
}

export async function longTargetReturn(): Promise<number> {
  return withLedger(async (db) => {
    const opened = await openOpportunity(
      db,
      shell("KO", "long", 100, 110, 90),
      new Date("2026-06-01T15:00:00Z"),
    );
    if (!opened.ok) throw new Error(opened.reason);
    const review = await reviewOpenBook({
      db,
      now: new Date("2026-06-20T15:00:00Z"),
      post: false,
      async quote() {
        return { high: 120, low: 108, close: 115 };
      },
    });
    const closed = review.closed[0];
    if (!closed || closed.reason !== "target") throw new Error("long did not close on target");
    return closed.returnPct;
  });
}

export async function shortInvalidationReturn(): Promise<number> {
  return withLedger(async (db) => {
    const opened = await openOpportunity(
      db,
      shell("XOM", "short", 100, 80, 110),
      new Date("2026-06-01T15:00:00Z"),
    );
    if (!opened.ok) throw new Error(opened.reason);
    const review = await reviewOpenBook({
      db,
      now: new Date("2026-06-20T15:00:00Z"),
      post: false,
      async quote() {
        return { high: 116, low: 101, close: 112 };
      },
    });
    const closed = review.closed[0];
    if (!closed || closed.reason !== "invalidation") {
      throw new Error("short did not close on invalidation");
    }
    return closed.returnPct;
  });
}
