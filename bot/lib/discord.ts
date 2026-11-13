import { formatMoney, formatPct, formatPrice, formatLondon } from "./numbers.js";
import type { Alert, OpenSide } from "./types.js";

export type DiscordPayload = {
  username: "SSA Desk";
  embeds: Array<{
    title: string;
    description?: string;
    color: number;
    fields: Array<{ name: string; value: string; inline?: boolean }>;
    footer?: { text: string };
  }>;
};

const GREEN = 0x2ecc71;
const RED = 0xe74c3c;
const SLATE = 0x95a5a6;

function field(name: string, value: string): { name: string; value: string; inline: boolean } {
  return { name, value: value.slice(0, 1024), inline: true };
}

function dash(value: string): string {
  return value.trim() === "" ? "—" : value;
}

export function alertPayload(alert: Alert): DiscordPayload {
  const side = alert.side === "short" ? "Short" : "Long";
  const pe =
    alert.fundamentals.trailingPe === null ? "n/a" : alert.fundamentals.trailingPe.toFixed(2);
  const versus =
    alert.fundamentals.peVsWatchlistMedian === null
      ? "n/a"
      : `${alert.fundamentals.peVsWatchlistMedian.toFixed(2)}x`;
  const chain =
    alert.supplyChain.length === 0
      ? "—"
      : alert.supplyChain.map((link) => `${link.ticker} (${link.source})`).join(", ");
  return {
    username: "SSA Desk",
    embeds: [
      {
        title: `${side} ${alert.ticker}`,
        description: alert.thesis.slice(0, 4000),
        color: alert.side === "short" ? RED : GREEN,
        fields: [
          field("Price", formatPrice(alert.fundamentals.price)),
          field("Market cap", formatMoney(alert.fundamentals.marketCap)),
          field("Trailing P/E", pe),
          field("P/E vs watchlist median", versus),
          field("Size", alert.tags.size),
          field("Style", dash(alert.tags.styles.join(", "))),
          field("Cycle", dash(alert.tags.cycle)),
          field("Sector", dash(alert.tags.sector)),
          field("Entry", `${formatPrice(alert.entry.low)} – ${formatPrice(alert.entry.high)}`),
          field("Target", formatPrice(alert.exit.target)),
          field("Invalidation", formatPrice(alert.exit.invalidation)),
          field("Sentiment", `${alert.sentiment.source} ${alert.sentiment.score.toFixed(2)}`),
          field("Supply chain", chain),
          field("Theme", alert.themes.length === 0 ? "none" : alert.themes.join(", ")),
        ],
        footer: { text: alert.disclaimer },
      },
    ],
  };
}

export function closePayload(input: {
  ticker: string;
  side: OpenSide;
  startedAt: string;
  endedAt: string;
  entryPrice: number;
  exitPrice: number;
  closeReason: string;
  returnPct: number;
}): DiscordPayload {
  const side = input.side === "short" ? "Short" : "Long";
  return {
    username: "SSA Desk",
    embeds: [
      {
        title: `Closed ${side} ${input.ticker}`,
        color: SLATE,
        fields: [
          field("Side", side),
          field("Started", formatLondon(input.startedAt)),
          field("Ended", formatLondon(input.endedAt)),
          field("Entry close", formatPrice(input.entryPrice)),
          field("Exit close", formatPrice(input.exitPrice)),
          field("Close reason", input.closeReason),
          field("Return", formatPct(input.returnPct)),
        ],
        footer: {
          text: "Price return from the stored entry close to the stored exit close. Not a brokerage profit.",
        },
      },
    ],
  };
}

let lastPostAt = 0;

export async function postDiscord(payload: DiscordPayload): Promise<{ posted: boolean; reason?: string }> {
  const url = process.env.DISCORD_WEBHOOK_URL;
  if (!url) return { posted: false, reason: "DISCORD_WEBHOOK_URL unset" };
  const wait = 1100 - (Date.now() - lastPostAt);
  if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
  lastPostAt = Date.now();
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) {
    return { posted: false, reason: `discord webhook returned ${response.status}` };
  }
  return { posted: true };
}
