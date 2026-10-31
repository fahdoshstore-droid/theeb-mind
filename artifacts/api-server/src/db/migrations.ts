// Versioned, additive migrations. Each runs once inside a transaction and is recorded in schema_migrations.
// Rules: no DROP / destructive ALTER of existing tables; new tables are owner-scoped (user_id NOT NULL).
import type BetterSqlite3 from 'better-sqlite3';

export interface Migration { version: number; name: string; sql: string }

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    name: 'auth_credentials_sessions',
    sql: `
CREATE TABLE IF NOT EXISTS auth_credentials (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  password_hash TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  expires_at TEXT NOT NULL,
  last_seen_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_user ON auth_sessions(user_id);
`,
  },
  {
    version: 2,
    name: 'ledger_foundation',
    sql: `
CREATE TABLE IF NOT EXISTS firm_profiles (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  source_url TEXT,
  source_checked_at TEXT,
  rules_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_firm_profiles_user ON firm_profiles(user_id);

CREATE TABLE IF NOT EXISTS trading_accounts (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  name TEXT NOT NULL,
  broker TEXT,
  firm_profile_id TEXT REFERENCES firm_profiles(id),
  phase TEXT NOT NULL DEFAULT 'personal' CHECK(phase IN ('challenge','funded_pre_payout','funded_post_payout','personal','demo')),
  starting_balance REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  is_demo INTEGER NOT NULL DEFAULT 0,
  archived INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, name)
);
CREATE INDEX IF NOT EXISTS idx_accounts_user ON trading_accounts(user_id);

CREATE TABLE IF NOT EXISTS import_batches (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('trades','fills','manual')),
  preset TEXT,
  filename TEXT,
  file_sha256 TEXT,
  file_size INTEGER,
  source_text TEXT,
  timezone TEXT NOT NULL,
  date_order TEXT NOT NULL DEFAULT 'MDY',
  mapping_json TEXT NOT NULL DEFAULT '{}',
  duplicate_policy TEXT NOT NULL DEFAULT 'skip' CHECK(duplicate_policy IN ('skip','update','distinct')),
  row_count INTEGER NOT NULL DEFAULT 0,
  imported_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  duplicate_count INTEGER NOT NULL DEFAULT 0,
  error_count INTEGER NOT NULL DEFAULT 0,
  source_net_total REAL,
  imported_net_total REAL,
  status TEXT NOT NULL DEFAULT 'committed',
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_batches_user ON import_batches(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_batches_sha ON import_batches(user_id, file_sha256);

CREATE TABLE IF NOT EXISTS import_raw_rows (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  batch_id TEXT NOT NULL REFERENCES import_batches(id),
  user_id TEXT NOT NULL REFERENCES users(id),
  row_index INTEGER NOT NULL,
  raw_json TEXT NOT NULL,
  row_sha256 TEXT NOT NULL,
  outcome TEXT NOT NULL CHECK(outcome IN ('imported','updated','duplicate_skipped','duplicate_in_file','imported_distinct','error','grouped')),
  errors_json TEXT NOT NULL DEFAULT '[]',
  warnings_json TEXT NOT NULL DEFAULT '[]',
  trade_id TEXT,
  fill_id TEXT,
  UNIQUE(batch_id, row_index)
);
CREATE INDEX IF NOT EXISTS idx_raw_rows_user ON import_raw_rows(user_id, batch_id);

CREATE TABLE IF NOT EXISTS trades (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES trading_accounts(id),
  batch_id TEXT REFERENCES import_batches(id),
  origin TEXT NOT NULL CHECK(origin IN ('import_trades','import_fills','manual','demo')),
  external_id TEXT,
  dedupe_key TEXT NOT NULL,
  symbol TEXT NOT NULL,
  instrument_root TEXT,
  side TEXT NOT NULL CHECK(side IN ('long','short')),
  quantity REAL NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('open','closed')),
  entry_time TEXT NOT NULL,
  exit_time TEXT,
  entry_price REAL,
  exit_price REAL,
  tick_size REAL,
  tick_value REAL,
  tick_source TEXT,
  gross_pnl REAL, gross_source TEXT NOT NULL DEFAULT 'unknown',
  fees REAL, fees_source TEXT NOT NULL DEFAULT 'unknown',
  net_pnl REAL, net_source TEXT NOT NULL DEFAULT 'unknown',
  recomputed_gross REAL,
  pnl_mismatch REAL,
  currency TEXT NOT NULL DEFAULT 'USD',
  stop_price REAL, stop_source TEXT,
  target_price REAL, target_source TEXT,
  initial_risk_usd REAL, initial_risk_source TEXT,
  grouping_confidence TEXT,
  grouping_notes_json TEXT,
  timestamps_had_offset INTEGER NOT NULL DEFAULT 0,
  field_sources_json TEXT NOT NULL DEFAULT '{}',
  setup TEXT,
  execution_grade TEXT CHECK(execution_grade IS NULL OR execution_grade IN ('A','B','C','D','F')),
  emotion_before TEXT,
  emotion_after TEXT,
  user_notes TEXT,
  imported_notes TEXT,
  is_demo INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, account_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_trades_user_time ON trades(user_id, entry_time);
CREATE INDEX IF NOT EXISTS idx_trades_account ON trades(user_id, account_id);

CREATE TABLE IF NOT EXISTS trade_fills (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES trading_accounts(id),
  batch_id TEXT REFERENCES import_batches(id),
  trade_id TEXT REFERENCES trades(id),
  dedupe_key TEXT NOT NULL,
  external_id TEXT,
  order_id TEXT,
  symbol TEXT NOT NULL,
  side TEXT NOT NULL CHECK(side IN ('buy','sell')),
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  fill_time TEXT NOT NULL,
  fees REAL,
  role TEXT,
  allocated_qty REAL,
  UNIQUE(user_id, account_id, dedupe_key)
);
CREATE INDEX IF NOT EXISTS idx_fills_trade ON trade_fills(user_id, trade_id);

CREATE TABLE IF NOT EXISTS trade_tags (
  trade_id TEXT NOT NULL REFERENCES trades(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id),
  tag TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user',
  PRIMARY KEY(trade_id, tag)
);
CREATE INDEX IF NOT EXISTS idx_tags_user ON trade_tags(user_id, tag);

CREATE TABLE IF NOT EXISTS trade_attachments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  trade_id TEXT REFERENCES trades(id) ON DELETE CASCADE,
  evaluation_id TEXT,
  mime TEXT NOT NULL,
  size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  data BLOB NOT NULL,
  caption TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_attach_user ON trade_attachments(user_id, trade_id);

CREATE TABLE IF NOT EXISTS journal_notes (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  kind TEXT NOT NULL CHECK(kind IN ('session_pre','session_post','trade')),
  session_date TEXT,
  trade_id TEXT REFERENCES trades(id) ON DELETE CASCADE,
  body TEXT NOT NULL,
  mood INTEGER CHECK(mood IS NULL OR (mood BETWEEN 1 AND 5)),
  readiness INTEGER CHECK(readiness IS NULL OR (readiness BETWEEN 1 AND 5)),
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  updated_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_notes_user ON journal_notes(user_id, session_date);

CREATE TABLE IF NOT EXISTS tril_evaluations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  trade_id TEXT REFERENCES trades(id),
  phase TEXT NOT NULL CHECK(phase IN ('pre_trade','post_trade')),
  instrument TEXT,
  direction TEXT CHECK(direction IS NULL OR direction IN ('long','short')),
  decision_time TEXT,
  analysis_text TEXT,
  readiness INTEGER CHECK(readiness IS NULL OR (readiness BETWEEN 1 AND 5)),
  emotion TEXT,
  input_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  overall TEXT NOT NULL,
  methodology_version TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  locked_at TEXT,
  supersedes_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_tril_user ON tril_evaluations(user_id, recorded_at DESC);
CREATE INDEX IF NOT EXISTS idx_tril_trade ON tril_evaluations(user_id, trade_id);

CREATE TABLE IF NOT EXISTS risk_rules (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  rule_key TEXT NOT NULL,
  value_json TEXT NOT NULL,
  status TEXT NOT NULL CHECK(status IN ('active','observation','historical','disabled')),
  source TEXT NOT NULL,
  note TEXT,
  effective_from TEXT,
  effective_to TEXT,
  confirmed_at TEXT,
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_risk_rules_active ON risk_rules(user_id, rule_key) WHERE status = 'active';
CREATE INDEX IF NOT EXISTS idx_risk_rules_user ON risk_rules(user_id, rule_key);

CREATE TABLE IF NOT EXISTS risk_rule_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL REFERENCES users(id),
  rule_id TEXT NOT NULL,
  rule_key TEXT NOT NULL,
  action TEXT NOT NULL,
  old_json TEXT,
  new_json TEXT,
  reason TEXT,
  changed_by TEXT NOT NULL,
  changed_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_rule_hist_user ON risk_rule_history(user_id, changed_at DESC);

CREATE TABLE IF NOT EXISTS reported_snapshots (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  dataset TEXT NOT NULL,
  source_name TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  account_ids_json TEXT NOT NULL DEFAULT '[]',
  metrics_json TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, dataset)
);

CREATE TABLE IF NOT EXISTS payout_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES trading_accounts(id),
  kind TEXT NOT NULL CHECK(kind IN ('submitted','approved','received','rejected')),
  amount REAL NOT NULL,
  record_date TEXT NOT NULL,
  reference TEXT,
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);
CREATE INDEX IF NOT EXISTS idx_payouts_user ON payout_records(user_id, account_id);

CREATE TABLE IF NOT EXISTS account_equity_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  account_id TEXT NOT NULL REFERENCES trading_accounts(id),
  equity REAL NOT NULL,
  as_of TEXT NOT NULL,
  source TEXT NOT NULL DEFAULT 'user entry',
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
);

CREATE TABLE IF NOT EXISTS behavior_feedback (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id),
  pattern TEXT NOT NULL,
  trade_id TEXT NOT NULL,
  verdict TEXT NOT NULL CHECK(verdict IN ('confirmed','rejected')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')),
  UNIQUE(user_id, pattern, trade_id)
);
`,
  },
];

export function runMigrations(db: BetterSqlite3.Database): number[] {
  db.exec(`CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY, name TEXT NOT NULL, applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now')))`);
  const done = new Set((db.prepare('SELECT version FROM schema_migrations').all() as { version: number }[]).map((r) => r.version));
  const applied: number[] = [];
  for (const m of MIGRATIONS) {
    if (done.has(m.version)) continue;
    db.transaction(() => {
      db.exec(m.sql);
      db.prepare('INSERT INTO schema_migrations (version, name) VALUES (?, ?)').run(m.version, m.name);
    })();
    applied.push(m.version);
  }
  return applied;
}
