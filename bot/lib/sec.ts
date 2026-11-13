export type SecFigures = {
  ttmEps: number | null;
  shares: number | null;
  revenueGrowth: number | null;
  dividendPerShare: number | null;
};

type SecRow = {
  end?: string;
  val?: number;
  fp?: string;
  form?: string;
  filed?: string;
};

const REVENUE_CONCEPTS = [
  "RevenueFromContractWithCustomerExcludingAssessedTax",
  "Revenues",
  "SalesRevenueNet",
  "SalesRevenueGoodsNet",
];

const DIVIDEND_CONCEPTS = [
  "CommonStockDividendsPerShareDeclared",
  "CommonStockDividendsPerShareCashPaid",
];

function unitRows(facts: unknown, namespace: "us-gaap" | "dei", concept: string): SecRow[] {
  const units = (
    facts as {
      facts?: Record<string, Record<string, { units?: Record<string, SecRow[]> }>>;
    }
  ).facts?.[namespace]?.[concept]?.units;
  if (!units) return [];
  return Object.values(units).flatMap((rows) => (Array.isArray(rows) ? rows : []));
}

function conceptRows(facts: unknown, concept: string): SecRow[] {
  return unitRows(facts, "us-gaap", concept);
}

function latestPositive(rows: SecRow[]): number | null {
  const latest = rows
    .filter((row) => typeof row.val === "number" && row.val > 0 && typeof row.end === "string")
    .sort((a, b) => String(a.end).localeCompare(String(b.end)))
    .at(-1);
  return typeof latest?.val === "number" ? latest.val : null;
}

function annuals(rows: SecRow[]): SecRow[] {
  return rows
    .filter((row) => row.fp === "FY" && typeof row.val === "number" && typeof row.end === "string")
    .sort((a, b) => String(a.end).localeCompare(String(b.end)));
}

function latestAnnual(rows: SecRow[]): SecRow | null {
  return annuals(rows).at(-1) ?? null;
}

function ttmEps(rows: SecRow[]): number | null {
  const quarters = rows
    .filter((row) => typeof row.val === "number" && typeof row.end === "string" && /^Q[1-4]$/.test(row.fp ?? ""))
    .sort((a, b) => String(a.end).localeCompare(String(b.end)));
  const byEnd = new Map<string, number>();
  for (const row of quarters) byEnd.set(String(row.end), row.val as number);
  const ends = [...byEnd.keys()].sort();
  if (ends.length >= 4) {
    return ends.slice(-4).reduce((sum, end) => sum + (byEnd.get(end) ?? 0), 0);
  }
  const annual = latestAnnual(rows);
  return typeof annual?.val === "number" ? annual.val : null;
}

export function figuresFromFacts(facts: unknown): SecFigures {
  let revenueGrowth: number | null = null;
  for (const concept of REVENUE_CONCEPTS) {
    const years = annuals(conceptRows(facts, concept));
    if (years.length >= 2) {
      const prior = years[years.length - 2]?.val;
      const latest = years[years.length - 1]?.val;
      if (typeof prior === "number" && prior > 0 && typeof latest === "number") {
        revenueGrowth = (latest - prior) / prior;
        break;
      }
    }
  }
  const epsRows = conceptRows(facts, "EarningsPerShareDiluted");
  const shares =
    latestPositive(unitRows(facts, "dei", "EntityCommonStockSharesOutstanding")) ??
    latestPositive(conceptRows(facts, "CommonStockSharesOutstanding")) ??
    latestPositive(annuals(conceptRows(facts, "WeightedAverageNumberOfDilutedSharesOutstanding")));
  let dividendPerShare: number | null = null;
  for (const concept of DIVIDEND_CONCEPTS) {
    const annual = latestAnnual(conceptRows(facts, concept));
    if (typeof annual?.val === "number") {
      dividendPerShare = annual.val;
      break;
    }
  }
  return {
    ttmEps: ttmEps(epsRows),
    shares,
    revenueGrowth,
    dividendPerShare,
  };
}

export function combinePrice(price: number, figures: SecFigures, quoteMarketCap: number | null, quotePe: number | null): {
  marketCap: number | null;
  trailingPe: number | null;
} {
  const marketCap =
    figures.shares !== null && figures.shares > 0 ? price * figures.shares : quoteMarketCap;
  const trailingPe =
    figures.ttmEps !== null && figures.ttmEps > 0
      ? price / figures.ttmEps
      : figures.ttmEps !== null
        ? null
        : quotePe !== null && quotePe > 0
          ? quotePe
          : null;
  return { marketCap, trailingPe };
}

const TICKER_URL = "https://www.sec.gov/files/company_tickers.json";

let tickerMap: Map<string, number> | null = null;

function secHeaders(): Record<string, string> {
  return {
    "user-agent": process.env.SEC_USER_AGENT ?? "SSA-Desk research desk admin@example.com",
    accept: "application/json",
  };
}

export async function cikFor(ticker: string): Promise<number | null> {
  if (!tickerMap) {
    const response = await fetch(TICKER_URL, {
      headers: secHeaders(),
      signal: AbortSignal.timeout(8000),
    });
    if (!response.ok) throw new Error(`SEC ticker list returned ${response.status}`);
    const body = (await response.json()) as Record<string, { cik_str?: number; ticker?: string }>;
    tickerMap = new Map();
    for (const row of Object.values(body)) {
      if (row.ticker && typeof row.cik_str === "number") {
        tickerMap.set(row.ticker.toUpperCase(), row.cik_str);
      }
    }
  }
  return tickerMap.get(ticker.toUpperCase()) ?? null;
}

export async function companyFacts(ticker: string): Promise<unknown | null> {
  const cik = await cikFor(ticker);
  if (cik === null) return null;
  const padded = String(cik).padStart(10, "0");
  const response = await fetch(`https://data.sec.gov/api/xbrl/companyfacts/CIK${padded}.json`, {
    headers: secHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) throw new Error(`SEC companyfacts returned ${response.status}`);
  return response.json();
}

export async function latestFilingText(ticker: string): Promise<string | null> {
  const cik = await cikFor(ticker);
  if (cik === null) return null;
  const padded = String(cik).padStart(10, "0");
  const response = await fetch(`https://data.sec.gov/submissions/CIK${padded}.json`, {
    headers: secHeaders(),
    signal: AbortSignal.timeout(8000),
  });
  if (!response.ok) return null;
  const body = (await response.json()) as {
    filings?: {
      recent?: {
        form?: string[];
        accessionNumber?: string[];
        primaryDocument?: string[];
      };
    };
  };
  const recent = body.filings?.recent;
  if (!recent?.form || !recent.accessionNumber || !recent.primaryDocument) return null;
  const index = recent.form.findIndex((form) => form === "10-K");
  if (index < 0) return null;
  const accession = recent.accessionNumber[index];
  const document = recent.primaryDocument[index];
  if (!accession || !document) return null;
  const url = `https://www.sec.gov/Archives/edgar/data/${cik}/${accession.replaceAll("-", "")}/${document}`;
  const filing = await fetch(url, { headers: secHeaders(), signal: AbortSignal.timeout(8000) });
  if (!filing.ok) return null;
  const text = await filing.text();
  return text.slice(0, 400_000);
}
