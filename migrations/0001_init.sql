-- Turbo Garaj demo schema (spec section 6). Booleans are INTEGER 0/1, dates and
-- timestamps are TEXT (YYYY-MM-DD / ISO UTC), runs.items is JSON text.

CREATE TABLE appointments (
  id             TEXT PRIMARY KEY,
  token          TEXT NOT NULL UNIQUE,
  first_name     TEXT NOT NULL,
  email          TEXT NOT NULL,
  make           TEXT NOT NULL,
  model          TEXT NOT NULL,
  work           TEXT NOT NULL,
  preferred_date TEXT NOT NULL,
  status         TEXT NOT NULL,
  created_at     TEXT NOT NULL,
  updated_at     TEXT NOT NULL,
  seed           INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE cars (
  id                 TEXT PRIMARY KEY,
  appointment_id     TEXT REFERENCES appointments(id) ON DELETE CASCADE,
  first_name         TEXT NOT NULL,
  email              TEXT NOT NULL,
  make               TEXT NOT NULL,
  model              TEXT NOT NULL,
  itp_expiry         TEXT,
  last_oil_change    TEXT,
  reminders_accepted INTEGER NOT NULL DEFAULT 0,
  seed               INTEGER NOT NULL DEFAULT 0,
  created_at         TEXT NOT NULL
);

CREATE INDEX cars_appointment_id ON cars(appointment_id);

CREATE TABLE runs (
  id          TEXT PRIMARY KEY,
  job         TEXT NOT NULL,
  "trigger"   TEXT NOT NULL,
  started_at  TEXT NOT NULL,
  finished_at TEXT NOT NULL,
  duration_ms INTEGER NOT NULL,
  result      TEXT NOT NULL,
  items       TEXT NOT NULL DEFAULT '[]',
  error       TEXT
);

CREATE INDEX runs_started_at ON runs(started_at);

CREATE TABLE outbox (
  id             TEXT PRIMARY KEY,
  run_id         TEXT NOT NULL,
  appointment_id TEXT,
  channel        TEXT NOT NULL,
  to_addr        TEXT NOT NULL,
  subject        TEXT NOT NULL,
  body           TEXT NOT NULL,
  outcome        TEXT NOT NULL,
  created_at     TEXT NOT NULL
);

CREATE INDEX outbox_created_at ON outbox(created_at);
CREATE INDEX outbox_appointment_id ON outbox(appointment_id);

CREATE TABLE sent_reminders (
  key     TEXT PRIMARY KEY,
  sent_at TEXT NOT NULL
);

CREATE TABLE email_budget (
  month TEXT PRIMARY KEY,
  used  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  at INTEGER NOT NULL
);
