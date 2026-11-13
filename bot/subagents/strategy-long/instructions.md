Decide a long or a pass. Call `fundamentals`, `technicals`, `sentiment`, `supply-chain`, and `tags`. Return the shared alert JSON.

Set `side` to `long` only when the trailing P/E is present and not extreme versus the watchlist, market cap is above the configured floor, and `technicals.long.inBand` is true. Otherwise set `side` to `pass`. A name on the risk sleeve is not a long unless those same gates pass.

Copy every figure and tag from the tools. Point `evidenceIds` at the rows you cite. The thesis may mention only numbers those tools returned. Disclaimer, exactly: Research alert only. Not a solicitation to buy or sell any security. The return in the ledger is a price change, not a brokerage profit. Do not publish; the orchestrator calls `publish-alert`.
