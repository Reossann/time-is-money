-- Session records persistence for the calendar/graph consumers (#35).
-- session_id is the primary key and the idempotency key for saving.

CREATE TABLE IF NOT EXISTS session_records (
  session_id TEXT PRIMARY KEY NOT NULL,
  schema_version INTEGER NOT NULL,
  owner_id TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  ended_at INTEGER NOT NULL,
  duration_seconds INTEGER NOT NULL,
  tracked_duration_seconds INTEGER NOT NULL,
  untracked_duration_seconds INTEGER NOT NULL,
  earned_yen INTEGER NOT NULL,
  wasted_yen INTEGER NOT NULL,
  net_yen INTEGER NOT NULL,
  local_date_key TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  sync_status TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_session_records_owner_date
  ON session_records (owner_id, local_date_key);

CREATE INDEX IF NOT EXISTS idx_session_records_owner
  ON session_records (owner_id);

CREATE TABLE IF NOT EXISTS session_record_apps (
  session_id TEXT NOT NULL,
  app_id TEXT NOT NULL,
  process_name TEXT NOT NULL,
  duration_seconds INTEGER NOT NULL,
  category TEXT,
  hourly_rate_yen REAL NOT NULL,
  earned_yen INTEGER NOT NULL,
  wasted_yen INTEGER NOT NULL,
  net_yen INTEGER NOT NULL,
  PRIMARY KEY (session_id, app_id),
  FOREIGN KEY (session_id) REFERENCES session_records (session_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_record_apps_app
  ON session_record_apps (app_id);
