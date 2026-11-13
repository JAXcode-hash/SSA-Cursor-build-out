import { randomUUID } from "node:crypto";
import type { SqlClient } from "./db.js";
import { isUniqueViolation } from "./db.js";
import { addCalendarDays, asNumber, londonDate } from "./numbers.js";
import { closeReason, priceReturn } from "./returns.js";
import type { Alert, CloseReason, OpenSide, OpportunityRow, StyleTag } from "./types.js";

type OpportunityRecord = Record<string, unknown>;

function styles(value: unknown): StyleTag[] {
  if (Array.isArray(value)) return value.map(String) as StyleTag[];
  if (typeof value === "string") {
    const inner = value.replace(/^\{|\}$/g, "");
    if (!inner) return [];
    return inner.split(",").map((part) => part.replace(/^"|"$/g, "")) as StyleTag[];
  }
  return [];
}

function asIso(value: unknown): string {
  if (value instanceof Date) return value.toISOString();
  return new Date(String(value)).toISOString();
}

function mapRow(row: OpportunityRecord): OpportunityRow {
  return {
    id: String(row.id),
    ticker: String(row.ticker),
    side: String(row.side) as OpenSide,
    theme: row.theme === null || row.theme === undefined ? null : String(row.theme),
    status: String(row.status) as "open" | "closed",
    sizeTag: String(row.size_tag) as OpportunityRow["sizeTag"],
    styleTags: styles(row.style_tags),
    cycleTag: String(row.cycle_tag ?? ""),
    sector: String(row.sector ?? ""),
    startedAt: asIso(row.started_at),
    endedAt: row.ended_at ? asIso(row.ended_at) : null,
    horizonOn: String(row.horizon_on).slice(0, 10),
    entryPrice: asNumber(row.entry_price),
    entryLow: asNumber(row.entry_low),
    entryHigh: asNumber(row.entry_high),
    targetPrice: asNumber(row.target_price),
    invalidationPrice: asNumber(row.invalidation_price),
    exitPrice: row.exit_price === null || row.exit_price === undefined ? null : asNumber(row.exit_price),
    closeReason: (row.close_reason as CloseReason | null) ?? null,
    returnPct: row.return_pct === null || row.return_pct === undefined ? null : asNumber(row.return_pct),
    thesis: String(row.thesis),
  };
}

const OPEN_SQL = `
  SELECT id, ticker, side, theme, status, size_tag, style_tags, cycle_tag, sector,
         started_at, ended_at, horizon_on::text AS horizon_on,
         entry_price, entry_low, entry_high, target_price, invalidation_price,
         exit_price, close_reason, return_pct, thesis
  FROM opportunities
`;

export async function findOpen(
  db: SqlClient,
  ticker: string,
  side: OpenSide,
): Promise<OpportunityRow | null> {
  const result = await db.query<OpportunityRecord>(
    `${OPEN_SQL} WHERE status = 'open' AND ticker = $1 AND side = $2`,
    [ticker.toUpperCase(), side],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export async function listOpen(db: SqlClient): Promise<OpportunityRow[]> {
  const result = await db.query<OpportunityRecord>(
    `${OPEN_SQL} WHERE status = 'open' ORDER BY started_at`,
  );
  return result.rows.map(mapRow);
}

export async function openOpportunity(
  db: SqlClient,
  alert: Alert,
  now: Date,
): Promise<{ ok: true; row: OpportunityRow } | { ok: false; reason: string }> {
  if (alert.side === "pass") return { ok: false, reason: "pass is not published" };
  const existing = await findOpen(db, alert.ticker, alert.side);
  if (existing) {
    return { ok: false, reason: "an open alert already exists for this ticker and side" };
  }
  const id = randomUUID();
  const started = now.toISOString();
  const horizonOn = addCalendarDays(londonDate(now), alert.horizon);
  const theme = alert.themes.length === 0 ? null : [...alert.themes].sort().join(",");
  try {
    await db.query(
      `INSERT INTO opportunities (
         id, ticker, side, theme, status, size_tag, style_tags, cycle_tag, sector,
         started_at, ended_at, horizon_on, entry_price, entry_low, entry_high,
         target_price, invalidation_price, exit_price, close_reason, return_pct, thesis
       ) VALUES (
         $1, $2, $3, $4, 'open', $5, $6, $7, $8,
         $9, NULL, $10, $11, $12, $13,
         $14, $15, NULL, NULL, NULL, $16
       )`,
      [
        id,
        alert.ticker.toUpperCase(),
        alert.side,
        theme,
        alert.tags.size,
        alert.tags.styles,
        alert.tags.cycle,
        alert.tags.sector,
        started,
        horizonOn,
        alert.fundamentals.price,
        alert.entry.low,
        alert.entry.high,
        alert.exit.target,
        alert.exit.invalidation,
        alert.thesis,
      ],
    );
  } catch (error) {
    if (isUniqueViolation(error)) {
      return { ok: false, reason: "an open alert already exists for this ticker and side" };
    }
    throw error;
  }
  const row = await findOpen(db, alert.ticker, alert.side);
  if (!row) return { ok: false, reason: "open row was not stored" };
  return { ok: true, row };
}

export async function hasMarkOnDate(db: SqlClient, opportunityId: string, day: string): Promise<boolean> {
  const result = await db.query<{ marked_at: string }>(
    `SELECT marked_at FROM opportunity_marks WHERE opportunity_id = $1`,
    [opportunityId],
  );
  return result.rows.some((row) => londonDate(new Date(asIso(row.marked_at))) === day);
}

export async function insertMark(
  db: SqlClient,
  opportunity: OpportunityRow,
  price: number,
  now: Date,
): Promise<void> {
  const day = londonDate(now);
  if (await hasMarkOnDate(db, opportunity.id, day)) return;
  await db.query(
    `INSERT INTO opportunity_marks (id, opportunity_id, marked_at, price, unrealized_return_pct)
     VALUES ($1, $2, $3, $4, $5)`,
    [
      randomUUID(),
      opportunity.id,
      now.toISOString(),
      price,
      priceReturn(opportunity.side, opportunity.entryPrice, price),
    ],
  );
}

export async function closeOpportunity(
  db: SqlClient,
  opportunity: OpportunityRow,
  exitPrice: number,
  reason: CloseReason,
  now: Date,
): Promise<OpportunityRow | null> {
  const ret = priceReturn(opportunity.side, opportunity.entryPrice, exitPrice);
  const result = await db.query<OpportunityRecord>(
    `UPDATE opportunities
     SET status = 'closed', ended_at = $2, exit_price = $3, close_reason = $4, return_pct = $5
     WHERE id = $1 AND status = 'open'
     RETURNING id, ticker, side, theme, status, size_tag, style_tags, cycle_tag, sector,
               started_at, ended_at, horizon_on::text AS horizon_on,
               entry_price, entry_low, entry_high, target_price, invalidation_price,
               exit_price, close_reason, return_pct, thesis`,
    [opportunity.id, now.toISOString(), exitPrice, reason, ret],
  );
  const row = result.rows[0];
  return row ? mapRow(row) : null;
}

export function reasonFor(
  opportunity: OpportunityRow,
  bar: { high: number; low: number },
  today: string,
): CloseReason | null {
  return closeReason({
    side: opportunity.side,
    target: opportunity.targetPrice,
    invalidation: opportunity.invalidationPrice,
    high: bar.high,
    low: bar.low,
    horizonOn: opportunity.horizonOn,
    today,
  });
}
