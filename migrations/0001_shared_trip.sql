CREATE TABLE IF NOT EXISTS trip_access (
  trip_id TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_initialization (
  trip_id TEXT PRIMARY KEY,
  initialized_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS trip_records (
  trip_id TEXT NOT NULL,
  collection TEXT NOT NULL,
  record_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (trip_id, collection, record_id)
);

CREATE INDEX IF NOT EXISTS idx_trip_records_lookup
  ON trip_records (trip_id, collection);
