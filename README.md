# SSA Desk

Advisory multi-agent research desk for a US equity watchlist. It publishes a Discord message when a long or short passes a code-checked contract, and it records when that opportunity opened, when it closed, and the price return.

It does not place trades, borrow shares, or connect to a broker. The return is the price change from the stored entry close to the stored exit close. A profitable short is positive. Borrow fees and fills are not included.

## Run

```bash
npx --yes "@grok/agent-sdk@0.6.0" validate --dir .
npm test
npm run check
```

`DATABASE_URL` selects Postgres. When it is unset, the process uses in-memory PGlite and the same migration in `migrations/001_opportunities.sql`. Hosted agent disk is wiped on deploy, so the live ledger is Postgres.

`DISCORD_WEBHOOK_URL` is the channel incoming webhook. See `docs/discord.md`. `X_BEARER_TOKEN` switches sentiment from headlines to X. `SEC_USER_AGENT` should identify this desk to EDGAR. `MODEL_ROUTE` and the local endpoint are described in `docs/local-model.md`.

The weekday schedule is `30 11 * * 1-5` UTC (11:30 London during GMT, 12:30 London during British Summer Time). One run reviews the configured watchlist, currently 21 names, not the whole market. Each accepted long is its own green message. Each accepted short is its own red message. Each dividend payer also gets a separate income message with the annual dividend per share and the yield.

## Contract

Prices, ratios, entry and exit bands, tags, and returns are computed in code. A model number or tag that is not in the tool payload is rejected before Discord is called. One open row is allowed per ticker and side.

Size is Large Cap at $10 billion, Mid Cap from $2 billion, and Small Cap below that. Style labels stack: revenue growth of at least 10 percent, a trailing P/E below the sector-peer median when at least three peers exist, and a dividend per share above zero. Cycle comes from `data/sector-cycle.json`. Sector is one of the eleven GICS names. Common quote-profile labels such as `Technology` or `Healthcare` are crosswalked onto those names. Any other string is dropped, and an empty sector leaves the cycle empty. The daily chart does not include a sector. When the quote profile returns none of the eleven names, sector and cycle stay empty. Market cap is price times the latest share count from SEC.

The early signal uses the same candidate pool one step before the sleeve. It flags a name when the last 20 sessions beat SPY by at least 2 percentage points and the longer window still lags. At least two confirmations are also required: RSI between 50 and 68, price above the 50-day average, price still inside the upper ATR band, or recent volume at least 1.25 times the prior month. On each earlier non-overlapping 20-session window in the six-month history, the desk records whether the next 20 sessions beat SPY. That hit rate is shown next to the base rate for every window. The model uses public daily prices and volume. It does not see other participants' orders, and an early signal does not publish a long.

The risk sleeve is a satellite of up to 12 names, inside a 10 to 15 name book, taken from `data/risk-sleeve.json`. A name is included only when its trailing six-month price return beats SPY, its beta versus SPY is at least 1.2, its volatility is higher than SPY, and its market cap is at least $2 billion. The set is ranked by that excess return and recomputed on each run. It is the higher-risk book. It is not a forecast that those names will keep beating the index, and it does not by itself publish a long.

Long alerts need a positive trailing P/E that is not above the configured multiple of the watchlist median, market cap at or above the floor, and a close inside the one-ATR pullback band. Names that appear only on a theme basket use that basket's floor when it is lower. Short alerts need fundamental deterioration, an extended tape, and a sentiment score at or below -0.4. A dip in a strong compounder is a pass.

Theme agents rank only the tickers in `data/themes`. Supply-chain links are the curated map in `data/supply-chain.json`, plus a 10-K mention of a known ticker tagged `stated`. Missing links stay missing.

Reference projects (ai-hedge-fund, FinRobot, OpenBB, Qlib) are not vendored. Fundamentals come from SEC `companyfacts`. Daily bars come from a public quote chart.
