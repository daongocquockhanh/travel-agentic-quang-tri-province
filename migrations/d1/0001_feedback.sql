-- Editor feedback on Cloudflare D1 (free plan). Mirrors the Supabase tables in
-- supabase/migrations (0001 content_gaps, 0004 answer_reports) for when no
-- Supabase project is configured. Written by the Worker only; read by editors with
--   bunx wrangler d1 execute quang-tri-feedback --remote --command "SELECT ..."

CREATE TABLE IF NOT EXISTS answer_reports (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  reason     TEXT NOT NULL CHECK (reason IN ('wrong', 'offensive', 'other')),
  note       TEXT,
  question   TEXT NOT NULL,
  answer     TEXT NOT NULL,
  track      TEXT,
  lang       TEXT,
  site_slug  TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS answer_reports_created_at_idx ON answer_reports (created_at DESC);

CREATE TABLE IF NOT EXISTS content_gaps (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  query       TEXT NOT NULL,
  track       TEXT,
  lang        TEXT,
  site_slug   TEXT,
  occurred_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS content_gaps_occurred_at_idx ON content_gaps (occurred_at DESC);
