export const SCHEMA_VERSION = 2;

export const CREATE_TABLES_SQL = `
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS accounts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  bank TEXT NOT NULL,
  kind TEXT NOT NULL DEFAULT 'bank',
  last_txn_date TEXT
);

CREATE TABLE IF NOT EXISTS categories (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  kind TEXT NOT NULL,
  icon TEXT,
  color TEXT,
  is_system INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS category_rules (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  pattern TEXT NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  priority INTEGER DEFAULT 100,
  source TEXT NOT NULL DEFAULT 'seed'
);

CREATE TABLE IF NOT EXISTS import_batches (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  file_name TEXT,
  imported_at TEXT NOT NULL,
  stmt_start TEXT,
  stmt_end TEXT,
  rows_in_file INTEGER,
  rows_inserted INTEGER,
  rows_skipped_dupe INTEGER
);

CREATE TABLE IF NOT EXISTS transactions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  batch_id INTEGER NOT NULL REFERENCES import_batches(id),
  txn_date TEXT NOT NULL,
  narration TEXT NOT NULL,
  ref_no TEXT,
  amount INTEGER NOT NULL,
  direction TEXT NOT NULL,
  balance_after INTEGER,
  category_id INTEGER REFERENCES categories(id),
  category_source TEXT NOT NULL DEFAULT 'uncategorized',
  txn_hash TEXT NOT NULL,
  notes TEXT,
  UNIQUE(account_id, txn_hash)
);

CREATE INDEX IF NOT EXISTS idx_txn_date ON transactions(txn_date);
CREATE INDEX IF NOT EXISTS idx_txn_cat  ON transactions(category_id);
CREATE INDEX IF NOT EXISTS idx_txn_account ON transactions(account_id);

CREATE TABLE IF NOT EXISTS budgets (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  month TEXT NOT NULL,
  category_id INTEGER REFERENCES categories(id),
  planned_amount INTEGER NOT NULL,
  UNIQUE(month, category_id)
);
`;
