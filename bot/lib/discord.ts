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
const GOLD = 0xf1c40f;
const PURPLE = 0x8e44ad;
const AMBER = 0xe67e22;

function field(name: string, value: string): { name: string; value: string; inline: boolean } {
  return { name, value: value.slice(0, 1024), inline: true };
}

function dash(value: string): string {
  return value.trim() === "" ? "—" : value;
}

export function dividendIncome(price: number, dividendPerShare: number): string {
  const yieldPct = price > 0 ? (dividendPerShare / price) * 100 : 0;
  return `${formatPrice(dividendPerShare)} a share, yield ${yieldPct.toFixed(2)}%`;
}

export function alertPayload(
  alert: Alert,
  facts?: { companyName?: string; dividendPerShare?: number | null },
): DiscordPayload {
  const side = alert.side === "short" ? "Short" : "Long";
  const companyName = facts?.companyName?.trim() || "—";
  const dividend = facts?.dividendPerShare;
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
          field("Company", companyName),
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
          ...(typeof dividend === "number" && dividend > 0
            ? [field("Dividend income", dividendIncome(alert.fundamentals.price, dividend))]
            : []),
        ],
        footer: { text: alert.disclaimer },
      },
    ],
  };
}

export function incomePayload(input: {
  ticker: string;
  companyName: string;
  price: number;
  dividendPerShare: number;
  size: string;
}): DiscordPayload {
  return {
    username: "SSA Desk",
    embeds: [
      {
        title: `Income ${input.ticker}`,
        description: `${input.companyName} pays a dividend. This is income information, not a long or a short.`,
        color: GOLD,
        fields: [
          field("Company", input.companyName),
          field("Ticker", input.ticker),
          field("Price", formatPrice(input.price)),
          field("Dividend income", dividendIncome(input.price, input.dividendPerShare)),
          field("Size", input.size),
        ],
        footer: {
          text: "Research alert only. Not a solicitation to buy or sell any security. Dividend income is the latest annual dividend per share from SEC divided into the latest price.",
        },
      },
    ],
  };
}

export function sleevePayload(input: {
  benchmark: string;
  benchmarkReturn: number | null;
  held: Array<{ ticker: string; companyName: string; beta: number; excessReturn: number }>;
  sleeveReturn: number | null;
  excessReturn: number | null;
}): DiscordPayload {
  const lines =
    input.held.length === 0
      ? "No candidate cleared the risk sleeve rules."
      : input.held
          .map(
            (row, index) =>
              `${index + 1}. ${row.companyName} (${row.ticker}) beta ${row.beta.toFixed(2)}, excess ${formatPct(row.excessReturn)}`,
          )
          .join("\n");
  return {
    username: "SSA Desk",
    embeds: [
      {
        title: "Risk sleeve",
        description: lines.slice(0, 4000),
        color: PURPLE,
        fields: [
          field("Names", String(input.held.length)),
          field("Benchmark", input.benchmark),
          field("Benchmark return", input.benchmarkReturn === null ? "n/a" : formatPct(input.benchmarkReturn)),
          field("Sleeve return", input.sleeveReturn === null ? "n/a" : formatPct(input.sleeveReturn)),
          field("Sleeve excess", input.excessReturn === null ? "n/a" : formatPct(input.excessReturn)),
        ],
        footer: {
          text: "Trailing six-month price returns versus the benchmark. Not a forecast. Research alert only. Not a solicitation to buy or sell any security.",
        },
      },
    ],
  };
}

export function earlyPayload(input: {
  horizon: number;
  searched?: number;
  picks: Array<{ ticker: string; companyName: string; excess20: number; excessLong: number; big?: boolean }>;
  hitRate: number | null;
  baseRate: number | null;
  signals: number;
  edge: boolean;
  bigHitRate?: number | null;
  bigSignals?: number;
  bigEdge?: boolean;
}): DiscordPayload {
  const lines =
    input.picks.length === 0
      ? "No name is leading SPY over 20 sessions while the longer window still lags."
      : input.picks
          .map((row, index) => {
            const size = row.big ? "big" : "early";
            return `${index + 1}. ${row.companyName} (${row.ticker}) ${size} 20-day excess ${formatPct(row.excess20)}, longer excess ${formatPct(row.excessLong)}`;
          })
          .join("\n");
  const hit = input.hitRate === null ? "n/a" : formatPct(input.hitRate);
  const base = input.baseRate === null ? "n/a" : formatPct(input.baseRate);
  const bigHit = input.bigHitRate === null || input.bigHitRate === undefined ? "n/a" : formatPct(input.bigHitRate);
  return {
    username: "SSA Desk",
    embeds: [
      {
        title: "Early positions",
        description: lines.slice(0, 4000),
        color: AMBER,
        fields: [
          field("Searched", String(input.searched ?? input.picks.length)),
          field("Names", String(input.picks.length)),
          field("Big moves", String(input.picks.filter((row) => row.big).length)),
          field("Horizon", `${input.horizon} sessions`),
          field("Past signals", String(input.signals)),
          field("Signal hit rate", hit),
          field("Big-move hit rate", bigHit),
          field("Big-move samples", String(input.bigSignals ?? 0)),
          field("Base hit rate", base),
          field("Measured edge", input.edge ? "yes" : "no"),
          field("Big-move edge", input.bigEdge ? "yes" : "no"),
        ],
        footer: {
          text: "Public daily prices only. A hit is a positive excess return versus SPY over the next 20 sessions. This is not an order. Research alert only. Not a solicitation to buy or sell any security.",
        },
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
