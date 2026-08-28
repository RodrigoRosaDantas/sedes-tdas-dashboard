PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS answer_key_sets (
  namespace TEXT NOT NULL,
  key_ref TEXT NOT NULL,
  material_id TEXT NOT NULL,
  content_hash TEXT,
  question_count INTEGER NOT NULL CHECK (question_count > 0),
  active INTEGER NOT NULL DEFAULT 1 CHECK (active IN (0, 1)),
  updated_at INTEGER NOT NULL,
  PRIMARY KEY (namespace, key_ref)
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS answer_key_items (
  namespace TEXT NOT NULL,
  key_ref TEXT NOT NULL,
  question_id TEXT NOT NULL,
  answer TEXT NOT NULL CHECK (answer IN ('A', 'B', 'C', 'D', 'E', 'Certo', 'Errado')),
  details_json TEXT NOT NULL DEFAULT '{}' CHECK (json_valid(details_json)),
  PRIMARY KEY (namespace, key_ref, question_id),
  UNIQUE (namespace, question_id),
  FOREIGN KEY (namespace, key_ref)
    REFERENCES answer_key_sets (namespace, key_ref)
    ON DELETE CASCADE
) STRICT, WITHOUT ROWID;

CREATE TABLE IF NOT EXISTS access_sessions (
  token_hash TEXT PRIMARY KEY CHECK (length(token_hash) = 43),
  subject_hash TEXT NOT NULL CHECK (length(subject_hash) = 43),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL CHECK (expires_at > created_at),
  revoked_at INTEGER,
  last_used_at INTEGER NOT NULL CHECK (last_used_at >= created_at)
) STRICT, WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS access_sessions_by_expiry
  ON access_sessions (expires_at);
