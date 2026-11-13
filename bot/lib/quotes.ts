import type { Bar } from "./types.js";

const UA = "SSA-Desk/0.1 (research)";

export type QuoteProfile = {
  price: number | null;
  marketCap: number | null;
  trailingPe: number | null;
  sector: string | null;
  companyName: string | null;
};

export function parseChart(payload: unknown): { bars: Bar[]; profile: QuoteProfile } {
  const result = (payload as { chart?: { result?: Array<Record<string, unknown>> } }).chart?.result?.[0];
  if (!result) {
    return { bars: [], profile: { price: null, marketCap: null, trailingPe: null, sector: null, companyName: null } };
  }
  const meta = (result.meta ?? {}) as Record<string, unknown>;
  const timestamps = result.timestamp;
  const quote = (result.indicators as { quote?: Array<Record<string, unknown>> } | undefined)?.quote?.[0];
  const bars: Bar[] = [];
  if (Array.isArray(timestamps) && quote) {
    const opens = quote.open as Array<number | null>;
    const highs = quote.high as Array<number | null>;
    const lows = quote.low as Array<number | null>;
    const closes = quote.close as Array<number | null>;
    timestamps.forEach((stamp, index) => {
      const close = closes?.[index];
      const high = highs?.[index];
      const low = lows?.[index];
      const open = opens?.[index];
      if (typeof stamp !== "number" || typeof close !== "number" || typeof high !== "number" || typeof low !== "number") {
        return;
      }
      bars.push({
        date: new Date(stamp * 1000).toISOString().slice(0, 10),
        open: typeof open === "number" ? open : close,
        high,
        low,
        close,
      });
    });
  }
  return {
    bars,
    profile: {
      price: typeof meta.regularMarketPrice === "number" ? meta.regularMarketPrice : bars.at(-1)?.close ?? null,
      marketCap: typeof meta.marketCap === "number" ? meta.marketCap : null,
      trailingPe: null,
      sector: null,
      companyName: typeof meta.longName === "string" ? meta.longName : typeof meta.shortName === "string" ? meta.shortName : null,
    },
  };
}

export function parseQuoteSummary(payload: unknown): QuoteProfile {
  const result = (
    payload as {
      quoteSummary?: { result?: Array<Record<string, unknown>> };
    }
  ).quoteSummary?.result?.[0];
  const price = result?.price as Record<string, unknown> | undefined;
  const profile = result?.assetProfile as Record<string, unknown> | undefined;
  const summary = result?.summaryDetail as Record<string, unknown> | undefined;
  const raw = (node: unknown, key: string): number | null => {
    const value = (node as Record<string, unknown> | undefined)?.[key];
    if (typeof value === "number") return value;
    if (value && typeof value === "object" && typeof (value as { raw?: unknown }).raw === "number") {
      return (value as { raw: number }).raw;
    }
    return null;
  };
  return {
    price: raw(price, "regularMarketPrice"),
    marketCap: raw(price, "marketCap"),
    trailingPe: raw(summary, "trailingPE"),
    sector: typeof profile?.sector === "string" ? profile.sector : null,
    companyName: typeof price?.longName === "string" ? price.longName : null,
  };
}

async function getJson(url: string): Promise<unknown> {
  const response = await fetch(url, {
    headers: { "user-agent": UA, accept: "application/json" },
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`quote request returned ${response.status}`);
  return response.json();
}

export async function dailyBars(ticker: string): Promise<{ bars: Bar[]; profile: QuoteProfile }> {
  const chart = parseChart(
    await getJson(
      `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(ticker)}?interval=1d&range=6mo`,
    ),
  );
  try {
    const summary = parseQuoteSummary(
      await getJson(
        `https://query1.finance.yahoo.com/v10/finance/quoteSummary/${encodeURIComponent(ticker)}?modules=assetProfile,price,summaryDetail`,
      ),
    );
    return {
      bars: chart.bars,
      profile: {
        price: summary.price ?? chart.profile.price,
        marketCap: summary.marketCap ?? chart.profile.marketCap,
        trailingPe: summary.trailingPe,
        sector: summary.sector,
        companyName: summary.companyName ?? chart.profile.companyName,
      },
    };
  } catch {
    return chart;
  }
}
