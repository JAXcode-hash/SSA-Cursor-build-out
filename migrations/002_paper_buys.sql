CREATE TABLE IF NOT EXISTS paper_buys (
  id text PRIMARY KEY,
  ticker text NOT NULL,
  company_name text NOT NULL,
  identified_on date NOT NULL,
  entry_price numeric NOT NULL,
  stake_gbp numeric NOT NULL,
  why text NOT NULL,
  big boolean NOT NULL,
  excess_20 numeric NOT NULL,
  excess_long numeric NOT NULL,
  rsi14 numeric NOT NULL,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  last_price numeric NOT NULL,
  last_on date NOT NULL,
  return_pct numeric NOT NULL,
  value_gbp numeric NOT NULL,
  pnl_gbp numeric NOT NULL,
  sessions_held integer NOT NULL,
  UNIQUE (ticker, identified_on)
);

CREATE TABLE IF NOT EXISTS paper_marks (
  id text PRIMARY KEY,
  buy_id text NOT NULL REFERENCES paper_buys (id),
  marked_on date NOT NULL,
  price numeric NOT NULL,
  return_pct numeric NOT NULL,
  value_gbp numeric NOT NULL,
  UNIQUE (buy_id, marked_on)
);

CREATE INDEX IF NOT EXISTS paper_marks_by_buy
  ON paper_marks (buy_id, marked_on);
