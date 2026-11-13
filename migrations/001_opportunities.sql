CREATE TABLE IF NOT EXISTS opportunities (
  id text PRIMARY KEY,
  ticker text NOT NULL,
  side text NOT NULL CHECK (side IN ('long', 'short')),
  theme text,
  status text NOT NULL CHECK (status IN ('open', 'closed')),
  size_tag text NOT NULL,
  style_tags text[] NOT NULL DEFAULT '{}',
  cycle_tag text NOT NULL DEFAULT '',
  sector text NOT NULL DEFAULT '',
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  horizon_on date NOT NULL,
  entry_price numeric NOT NULL,
  entry_low numeric NOT NULL,
  entry_high numeric NOT NULL,
  target_price numeric NOT NULL,
  invalidation_price numeric NOT NULL,
  exit_price numeric,
  close_reason text CHECK (close_reason IS NULL OR close_reason IN ('target', 'invalidation', 'horizon')),
  return_pct numeric,
  thesis text NOT NULL,
  CHECK (
    (
      status = 'open'
      AND ended_at IS NULL
      AND exit_price IS NULL
      AND close_reason IS NULL
      AND return_pct IS NULL
    )
    OR (
      status = 'closed'
      AND ended_at IS NOT NULL
      AND exit_price IS NOT NULL
      AND close_reason IS NOT NULL
      AND return_pct IS NOT NULL
    )
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS opportunities_one_open
  ON opportunities (ticker, side)
  WHERE status = 'open';

CREATE TABLE IF NOT EXISTS opportunity_marks (
  id text PRIMARY KEY,
  opportunity_id text NOT NULL REFERENCES opportunities (id),
  marked_at timestamptz NOT NULL,
  price numeric NOT NULL,
  unrealized_return_pct numeric NOT NULL
);

CREATE INDEX IF NOT EXISTS opportunity_marks_by_opportunity
  ON opportunity_marks (opportunity_id, marked_at);
