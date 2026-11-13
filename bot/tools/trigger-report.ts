import { defineTool } from "@grok/agent-sdk/tools";
import * as z from "zod/v4";
import { getDb } from "../lib/db.js";
import { buildTriggerReport, saveTriggerReport } from "../lib/trigger-log.js";

export default defineTool({
  description:
    "Scan the early universe and the watchlist. Log a £100 paper buy at the close when the early rule identifies a name, store why it was identified, and mark the share-price path for 20 sessions. Rebuilds the training log from historic prices. This does not place an order.",
  effect: "write",
  inputSchema: z.object({}),
  async execute() {
    const report = await buildTriggerReport();
    const db = await getDb();
    await saveTriggerReport(db, report);
    return {
      stakeGbp: report.stakeGbp,
      holdSessions: report.holdSessions,
      searched: report.searched,
      note: report.note,
      open: report.open.map((buy) => ({
        ticker: buy.ticker,
        companyName: buy.companyName,
        identifiedOn: buy.identifiedOn,
        entryPrice: buy.entryPrice,
        why: buy.why,
        big: buy.big,
        lastDate: buy.lastDate,
        lastPrice: buy.lastPrice,
        returnPct: buy.returnPct,
        valueGbp: buy.valueGbp,
        pnlGbp: buy.pnlGbp,
        sessionsHeld: buy.sessionsHeld,
      })),
      closedCount: report.closed.length,
      closedWinners: report.closedWinners,
      closedAvgReturn: report.closedAvgReturn,
      closedAvgPnlGbp: report.closedAvgPnlGbp,
    };
  },
});