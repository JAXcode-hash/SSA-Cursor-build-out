import { marketCapFloor } from "./config.js";
import { GROWTH_MIN, SENTIMENT_EXTREME, type Snapshot } from "./types.js";

export type GateResult = { ok: true } | { ok: false; reason: string };

export function longGate(snapshot: Snapshot, extremeMultiple: number): GateResult {
  if (snapshot.trailingPe === null || snapshot.trailingPe <= 0) {
    return { ok: false, reason: "long requires a positive trailing P/E" };
  }
  if (snapshot.peVsWatchlistMedian === null) {
    return { ok: false, reason: "long requires a watchlist median P/E" };
  }
  if (snapshot.peVsWatchlistMedian > extremeMultiple) {
    return { ok: false, reason: "trailing P/E is extreme versus the watchlist" };
  }
  if (snapshot.marketCap < marketCapFloor(snapshot.ticker)) {
    return { ok: false, reason: "market cap is below the configured floor" };
  }
  if (!snapshot.longBand.inBand) {
    return { ok: false, reason: "price is outside the long entry band" };
  }
  return { ok: true };
}

function deteriorated(snapshot: Snapshot, extremeMultiple: number): boolean {
  const shrinking = snapshot.revenueGrowth !== null && snapshot.revenueGrowth < 0;
  const expensive =
    snapshot.peVsWatchlistMedian !== null && snapshot.peVsWatchlistMedian > extremeMultiple;
  return shrinking || expensive;
}

function strongCompounder(snapshot: Snapshot, extremeMultiple: number): boolean {
  return (
    snapshot.revenueGrowth !== null &&
    snapshot.revenueGrowth >= GROWTH_MIN &&
    snapshot.trailingPe !== null &&
    snapshot.trailingPe > 0 &&
    (snapshot.peVsWatchlistMedian === null || snapshot.peVsWatchlistMedian <= extremeMultiple)
  );
}

export function shortGate(snapshot: Snapshot, extremeMultiple: number): GateResult {
  if (
    strongCompounder(snapshot, extremeMultiple) &&
    snapshot.price < snapshot.technicals.sma20
  ) {
    return { ok: false, reason: "a dip in a strong compounder is a pass, not a short" };
  }
  if (!deteriorated(snapshot, extremeMultiple)) {
    return { ok: false, reason: "short requires fundamental deterioration" };
  }
  if (!snapshot.shortBand.extended) {
    return { ok: false, reason: "short requires an extended technical reading" };
  }
  if (snapshot.sentiment.score > SENTIMENT_EXTREME) {
    return { ok: false, reason: "short requires a sentiment extreme" };
  }
  return { ok: true };
}
