-- Bounded owner-scoped history lookup for period aggregation (#12).
CREATE INDEX IF NOT EXISTS idx_session_records_owner_ended
  ON session_records (owner_id, ended_at DESC, session_id ASC);
