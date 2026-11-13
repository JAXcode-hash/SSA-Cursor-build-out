import { loadConfig } from "./config.js";
import type { SqlClient } from "./db.js";
import { loadEarlyUniverse } from "./early.js";
import { round } from "./numbers.js";
import { BIG_EXCESS, EARLY_HORIZON, earlyCall } from "./predict.js";
import { dailyBars } from "./quotes.js";
import type { Bar } from "./types.js";

export const STAKE_GBP = 100;

export type PaperMark = {
  date: string;
  price: number;
  returnPct: number;
  valueGbp: number;
};

export type PaperBuy = {
  ticker: string;
  companyName: string;
  identifiedOn: string;
  entryPrice: number;
  stakeGbp: number;
  why: string;
  big: boolean;
  excess20: number;
  excessLong: number;
  rsi14: number;
  status: "open" | "closed";
  lastDate: string;
  lastPrice: number;
  returnPct: number;
  valueGbp: number;
  pnlGbp: number;
  sessionsHeld: number;
  marks: PaperMark[];
};

export type SignalSnap = {
  signal: boolean;
  why: string;
  big: boolean;
  excess20: number;
  excessLong: number;
  rsi14: number;
};

export function stakeResult(entryPrice: number, price: number, stakeGbp = STAKE_GBP): {
  returnPct: number;
  valueGbp: number;
  pnlGbp: number;
} {
  const returnPct = entryPrice > 0 ? price / entryPrice - 1 : 0;
  const valueGbp = stakeGbp * (1 + returnPct);
  return {
    returnPct: round(returnPct, 4),
    valueGbp: round(valueGbp, 2),
    pnlGbp: round(valueGbp - stakeGbp, 2),
  };
}

export function trackPaperBuys(input: {
  ticker: string;
  companyName: string;
  bars: Array<{ date: string; close: number }>;
  signalAt: (index: number) => SignalSnap | null;
  holdSessions?: number;
  stakeGbp?: number;
}): PaperBuy[] {
  const holdSessions = input.holdSessions ?? EARLY_HORIZON;
  const stakeGbp = input.stakeGbp ?? STAKE_GBP;
  const buys: PaperBuy[] = [];
  let open: PaperBuy | null = null;
  for (let index = 0; index < input.bars.length; index += 1) {
    const bar = input.bars[index];
    if (!bar || bar.close <= 0) continue;
    if (open) {
      const result = stakeResult(open.entryPrice, bar.close, stakeGbp);
      open.marks.push({
        date: bar.date,
        price: round(bar.close, 4),
        returnPct: result.returnPct,
        valueGbp: result.valueGbp,
      });
      open.sessionsHeld = open.marks.length - 1;
      open.lastDate = bar.date;
      open.lastPrice = round(bar.close, 4);
      open.returnPct = result.returnPct;
      open.valueGbp = result.valueGbp;
      open.pnlGbp = result.pnlGbp;
      if (open.sessionsHeld >= holdSessions) {
        open.status = "closed";
        buys.push(open);
        open = null;
      }
    }
    if (open) continue;
    const snap = input.signalAt(index);
    if (!snap?.signal) continue;
    const entry = stakeResult(bar.close, bar.close, stakeGbp);
    open = {
      ticker: input.ticker,
      companyName: input.companyName,
      identifiedOn: bar.date,
      entryPrice: round(bar.close, 4),
      stakeGbp,
      why: snap.why,
      big: snap.big,
      excess20: snap.excess20,
      excessLong: snap.excessLong,
      rsi14: snap.rsi14,
      status: "open",
      lastDate: bar.date,
      lastPrice: round(bar.close, 4),
      returnPct: entry.returnPct,
      valueGbp: entry.valueGbp,
      pnlGbp: entry.pnlGbp,
      sessionsHeld: 0,
      marks: [{ date: bar.date, price: round(bar.close, 4), returnPct: entry.returnPct, valueGbp: entry.valueGbp }],
    };
  }
  if (open) buys.push(open);
  return buys;
}

function snapFromCall(stock: Bar[], market: Bar[], asOf: string): SignalSnap | null {
  const call = earlyCall(
    stock.filter((bar) => bar.date <= asOf),
    market.filter((bar) => bar.date <= asOf),
  );
  if (!call) return null;
  return {
    signal: call.signal,
    why: call.reasons.join("; "),
    big: call.features.excess20 >= BIG_EXCESS,
    excess20: call.features.excess20,
    excessLong: call.features.excessLong,
    rsi14: call.features.rsi14,
  };
}

export type TriggerReport = {
  stakeGbp: number;
  holdSessions: number;
  searched: number;
  note: string;
  open: PaperBuy[];
  closed: PaperBuy[];
  closedAvgReturn: number | null;
  closedAvgPnlGbp: number | null;
  closedWinners: number;
};

const NOTE =
  "A paper buy of £100 is logged at the close when the early rule identifies the name. The pound value follows the share price from that close. It is not a broker order and it does not convert through the pound-dollar rate.";

export function summarizeBuys(buys: PaperBuy[], searched: number): TriggerReport {
  const open = buys.filter((buy) => buy.status === "open").sort((left, right) => right.returnPct - left.returnPct);
  const closed = buys.filter((buy) => buy.status === "closed");
  const closedAvgReturn =
    closed.length === 0 ? null : round(closed.reduce((sum, buy) => sum + buy.returnPct, 0) / closed.length, 4);
  const closedAvgPnlGbp =
    closed.length === 0 ? null : round(closed.reduce((sum, buy) => sum + buy.pnlGbp, 0) / closed.length, 2);
  return {
    stakeGbp: STAKE_GBP,
    holdSessions: EARLY_HORIZON,
    searched,
    note: NOTE,
    open,
    closed,
    closedAvgReturn,
    closedAvgPnlGbp,
    closedWinners: closed.filter((buy) => buy.valueGbp > STAKE_GBP).length,
  };
}

async function mapLimited<T, R>(items: T[], limit: number, task: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  async function worker(): Promise<void> {
    for (;;) {
      const index = next;
      next += 1;
      if (index >= items.length) return;
      const item = items[index];
      if (item === undefined) return;
      results[index] = await task(item);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export function reportUniverse(): { benchmark: string; tickers: string[] } {
  const early = loadEarlyUniverse();
  const tickers = [...new Set([...early.tickers, ...loadConfig().tickers])];
  return { benchmark: early.benchmark, tickers };
}

export async function buildTriggerReport(): Promise<TriggerReport> {
  const universe = reportUniverse();
  const benchmark = await dailyBars(universe.benchmark);
  const groups = await mapLimited(universe.tickers, 5, async (ticker) => {
    try {
      const quote = await dailyBars(ticker);
      return trackPaperBuys({
        ticker,
        companyName: quote.profile.companyName || ticker,
        bars: quote.bars.map((bar) => ({ date: bar.date, close: bar.close })),
        signalAt: (index) => {
          const asOf = quote.bars[index]?.date;
          if (!asOf) return null;
          return snapFromCall(quote.bars, benchmark.bars, asOf);
        },
      });
    } catch {
      return [];
    }
  });
  return summarizeBuys(groups.flat(), universe.tickers.length);
}

export async function saveTriggerReport(db: SqlClient, report: TriggerReport): Promise<void> {
  await db.exec("DELETE FROM paper_marks");
  await db.exec("DELETE FROM paper_buys");
  const buys = [...report.open, ...report.closed];
  for (const buy of buys) {
    const id = `${buy.ticker}:${buy.identifiedOn}`;
    await db.query(
      `INSERT INTO paper_buys (
         id, ticker, company_name, identified_on, entry_price, stake_gbp, why, big,
         excess_20, excess_long, rsi14, status, last_price, last_on, return_pct, value_gbp, pnl_gbp, sessions_held
       ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)`,
      [
        id,
        buy.ticker,
        buy.companyName,
        buy.identifiedOn,
        buy.entryPrice,
        buy.stakeGbp,
        buy.why,
        buy.big,
        buy.excess20,
        buy.excessLong,
        buy.rsi14,
        buy.status,
        buy.lastPrice,
        buy.lastDate,
        buy.returnPct,
        buy.valueGbp,
        buy.pnlGbp,
        buy.sessionsHeld,
      ],
    );
    for (const mark of buy.marks) {
      await db.query(
        `INSERT INTO paper_marks (id, buy_id, marked_on, price, return_pct, value_gbp)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [`${id}:${mark.date}`, id, mark.date, mark.price, mark.returnPct, mark.valueGbp],
      );
    }
  }
}
