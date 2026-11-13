import { loadConfig } from "./config.js";
import { longGate, shortGate, type GateResult } from "./gates.js";
import { near } from "./numbers.js";
import { sameTags } from "./tags.js";
import {
  DISCLAIMER,
  EVIDENCE_IDS,
  type Alert,
  type Snapshot,
  type SupplyLink,
} from "./types.js";

const ALLOWED = new Set<string>(EVIDENCE_IDS);

function sameLinks(alert: SupplyLink[], snapshot: SupplyLink[]): boolean {
  const key = (link: SupplyLink) =>
    `${link.ticker}|${link.source}|${link.confidence.toFixed(4)}`;
  const left = alert.map(key).sort();
  const right = snapshot.map(key).sort();
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function evidenceNumbers(snapshot: Snapshot, horizon: number): number[] {
  const found: number[] = [14, 20, 50, horizon];
  const walk = (value: unknown): void => {
    if (typeof value === "number" && Number.isFinite(value)) {
      found.push(value);
      if (Math.abs(value) <= 2) found.push(value * 100);
      if (Math.abs(value) >= 1_000_000) {
        found.push(value / 1_000_000);
        found.push(value / 1_000_000_000);
      }
      return;
    }
    if (Array.isArray(value)) {
      value.forEach(walk);
      return;
    }
    if (value && typeof value === "object") {
      Object.values(value).forEach(walk);
    }
  };
  walk(snapshot);
  return found;
}

function thesisIsGrounded(thesis: string, snapshot: Snapshot, horizon: number): boolean {
  const allowed = evidenceNumbers(snapshot, horizon);
  const numbers = thesis.match(/-?\d+(?:\.\d+)?/g) ?? [];
  return numbers.every((token) => {
    const value = Number(token);
    return allowed.some((candidate) => near(value, candidate, 0.02, 0.05));
  });
}

export function validateAlert(alert: Alert, snapshot: Snapshot): GateResult {
  if (alert.ticker.toUpperCase() !== snapshot.ticker.toUpperCase()) {
    return { ok: false, reason: "ticker does not match the tool payload" };
  }
  if (alert.side === "pass") {
    return { ok: false, reason: "pass is not published" };
  }
  if (alert.disclaimer !== DISCLAIMER) {
    return { ok: false, reason: "disclaimer does not match the research notice" };
  }
  if (alert.evidenceIds.length === 0 || alert.evidenceIds.some((id) => !ALLOWED.has(id))) {
    return { ok: false, reason: "thesis evidence ids are missing or unknown" };
  }
  if (!near(alert.fundamentals.price, snapshot.price)) {
    return { ok: false, reason: "price is not in the tool payload" };
  }
  if (!near(alert.fundamentals.marketCap, snapshot.marketCap, 0.02, 1)) {
    return { ok: false, reason: "market cap is not in the tool payload" };
  }
  if (!sameNullable(alert.fundamentals.trailingPe, snapshot.trailingPe)) {
    return { ok: false, reason: "trailing P/E is not in the tool payload" };
  }
  if (!sameNullable(alert.fundamentals.peVsWatchlistMedian, snapshot.peVsWatchlistMedian)) {
    return { ok: false, reason: "P/E versus the watchlist median is not in the tool payload" };
  }
  const technicals = [
    [alert.technicals.sma20, snapshot.technicals.sma20],
    [alert.technicals.sma50, snapshot.technicals.sma50],
    [alert.technicals.rsi14, snapshot.technicals.rsi14],
    [alert.technicals.atr14, snapshot.technicals.atr14],
  ] as const;
  if (technicals.some(([actual, expected]) => !near(actual, expected))) {
    return { ok: false, reason: "technicals are not in the tool payload" };
  }
  const band = alert.side === "long" ? snapshot.longBand : snapshot.shortBand;
  if (!near(alert.entry.low, band.low) || !near(alert.entry.high, band.high)) {
    return { ok: false, reason: "entry band is not the computed band" };
  }
  if (!near(alert.exit.target, band.target) || !near(alert.exit.invalidation, band.invalidation)) {
    return { ok: false, reason: "exit levels are not the computed levels" };
  }
  if (alert.sentiment.source !== snapshot.sentiment.source) {
    return { ok: false, reason: "sentiment source does not match the tool payload" };
  }
  if (!near(alert.sentiment.score, snapshot.sentiment.score, 0.02, 0.02)) {
    return { ok: false, reason: "sentiment score is not in the tool payload" };
  }
  if (!sameLinks(alert.supplyChain, snapshot.supplyChain)) {
    return { ok: false, reason: "supply chain does not match the tool payload" };
  }
  const themes = [...alert.themes].sort().join(",");
  const expectedThemes = [...snapshot.themes].sort().join(",");
  if (themes !== expectedThemes) {
    return { ok: false, reason: "themes do not match the configured baskets" };
  }
  if (!sameTags(alert.tags, snapshot.tags)) {
    return { ok: false, reason: "tags do not match the tag tool" };
  }
  if (!thesisIsGrounded(alert.thesis, snapshot, alert.horizon)) {
    return { ok: false, reason: "thesis cites a number that is not in the tool payload" };
  }
  const extreme = loadConfig().peExtremeMultiple;
  return alert.side === "long" ? longGate(snapshot, extreme) : shortGate(snapshot, extreme);
}

function sameNullable(actual: number | null, expected: number | null): boolean {
  if (actual === null || expected === null) return actual === expected;
  return near(actual, expected);
}
