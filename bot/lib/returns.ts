import type { CloseReason, OpenSide } from "./types.js";

export function priceReturn(side: OpenSide, entry: number, exit: number): number {
  if (!(entry > 0)) throw new Error("entry price must be positive");
  const change = (exit - entry) / entry;
  return side === "short" ? -change : change;
}

export function closeReason(input: {
  side: OpenSide;
  target: number;
  invalidation: number;
  high: number;
  low: number;
  horizonOn: string;
  today: string;
}): CloseReason | null {
  const hitTarget =
    input.side === "long" ? input.high >= input.target : input.low <= input.target;
  const hitInvalidation =
    input.side === "long" ? input.low <= input.invalidation : input.high >= input.invalidation;
  if (hitInvalidation) return "invalidation";
  if (hitTarget) return "target";
  if (input.horizonOn < input.today) return "horizon";
  return null;
}
