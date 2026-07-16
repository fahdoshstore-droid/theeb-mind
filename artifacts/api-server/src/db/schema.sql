PRAGMA journal_mode=WAL;
PRAGMA foreign_keys=ON;

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  settings_json TEXT DEFAULT '{}'
);

CREATE TABLE IF NOT EXISTS decisions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  type TEXT NOT NULL CHECK(type IN ('long', 'short', 'no_trade')),
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  image_hash TEXT,
  timeframe TEXT NOT NULL,
  instrument TEXT NOT NULL,
  analysis_json TEXT,
  scoring_json TEXT,
  psychology_json TEXT,
  risk_json TEXT,
  coaching_json TEXT,
  quality_score REAL NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'C' CHECK(grade IN ('A+', 'A', 'B', 'C')),
  outcome TEXT CHECK(outcome IN ('win', 'loss', 'breakeven', 'cancelled')),
  outcome_pnl REAL,
  outcome_notes TEXT,
  outcome_at TEXT,
  killzone TEXT,
  day_blocked INTEGER NOT NULL DEFAULT 0,
  news_blackout INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS decision_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  decision_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE CASCADE,
  UNIQUE(decision_id, tag)
);

CREATE TABLE IF NOT EXISTS psychology_state (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  decision_id TEXT,
  phase TEXT NOT NULL,
  score INTEGER NOT NULL DEFAULT 0,
  max_score INTEGER NOT NULL DEFAULT 100,
  verdict TEXT NOT NULL DEFAULT 'pending',
  behavioral_lock INTEGER NOT NULL DEFAULT 0,
  lock_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (decision_id) REFERENCES decisions(id)
);

CREATE TABLE IF NOT EXISTS audit_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_data TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE TABLE IF NOT EXISTS verifications (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  content TEXT NOT NULL,
  source TEXT,
  credibility TEXT NOT NULL DEFAULT 'pending',
  credibility_score REAL NOT NULL DEFAULT 0,
  claims_count INTEGER NOT NULL DEFAULT 0,
  verified_claims INTEGER NOT NULL DEFAULT 0,
  rejected_claims INTEGER NOT NULL DEFAULT 0,
  manipulation_flags TEXT DEFAULT '[]',
  verdict TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_decisions_user ON decisions(user_id);
CREATE INDEX IF NOT EXISTS idx_decisions_created ON decisions(created_at);
CREATE INDEX IF NOT EXISTS idx_decisions_type ON decisions(type);
CREATE INDEX IF NOT EXISTS idx_decisions_grade ON decisions(grade);
CREATE INDEX IF NOT EXISTS idx_psychology_user ON psychology_state(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_events(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_type ON audit_events(event_type);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_events(created_at);
CREATE INDEX IF NOT EXISTS idx_verifications_user ON verifications(user_id);

CREATE TABLE IF NOT EXISTS rule_violations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  rule_id TEXT NOT NULL,
  rule_name TEXT NOT NULL,
  severity TEXT NOT NULL DEFAULT 'warning' CHECK(severity IN ('warning', 'block')),
  context_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id)
);
CREATE INDEX IF NOT EXISTS idx_rule_violations_user ON rule_violations(user_id);
CREATE INDEX IF NOT EXISTS idx_rule_violations_created ON rule_violations(created_at);

CREATE TABLE IF NOT EXISTS memory_fingerprints (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  decision_id TEXT NOT NULL UNIQUE,
  instrument TEXT NOT NULL,
  timeframe TEXT NOT NULL,
  killzone TEXT,
  grade TEXT NOT NULL,
  quality_score REAL NOT NULL DEFAULT 0,
  risk_amount REAL NOT NULL DEFAULT 0,
  setup_tags_json TEXT NOT NULL DEFAULT '[]',
  outcome TEXT,
  signatures_json TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (decision_id) REFERENCES decisions(id)
);
CREATE INDEX IF NOT EXISTS idx_memory_fp_user ON memory_fingerprints(user_id);
CREATE INDEX IF NOT EXISTS idx_memory_fp_decision ON memory_fingerprints(decision_id);
CREATE INDEX IF NOT EXISTS idx_memory_fp_setup ON memory_fingerprints(user_id, instrument, timeframe);
CREATE INDEX IF NOT EXISTS idx_memory_fp_outcome ON memory_fingerprints(user_id, outcome);

CREATE TABLE IF NOT EXISTS failure_patterns (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  pattern_key TEXT NOT NULL,
  hit_count INTEGER NOT NULL DEFAULT 0,
  last_seen TEXT NOT NULL DEFAULT (datetime('now')),
  notes TEXT,
  UNIQUE(user_id, pattern_key)
);
CREATE INDEX IF NOT EXISTS idx_failure_patterns_user ON failure_patterns(user_id);
CREATE INDEX IF NOT EXISTS idx_failure_patterns_hits ON failure_patterns(user_id, hit_count DESC);

CREATE TABLE IF NOT EXISTS quality_evaluations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  decision_id TEXT,
  composite_score INTEGER NOT NULL DEFAULT 0,
  grade TEXT NOT NULL DEFAULT 'C' CHECK(grade IN ('A+', 'A', 'B', 'C')),
  confidence REAL NOT NULL DEFAULT 0,
  breakdown_json TEXT NOT NULL DEFAULT '{}',
  flags_json TEXT NOT NULL DEFAULT '[]',
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (user_id) REFERENCES users(id),
  FOREIGN KEY (decision_id) REFERENCES decisions(id) ON DELETE SET NULL
);
CREATE INDEX IF NOT EXISTS idx_quality_eval_user ON quality_evaluations(user_id);
CREATE INDEX IF NOT EXISTS idx_quality_eval_decision ON quality_evaluations(decision_id);
CREATE INDEX IF NOT EXISTS idx_quality_eval_created ON quality_evaluations(user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS trade_intelligence_cache (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id TEXT NOT NULL,
  cache_key TEXT NOT NULL,
  data_json TEXT NOT NULL DEFAULT '{}',
  computed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, cache_key)
);
CREATE INDEX IF NOT EXISTS idx_tic_user ON trade_intelligence_cache(user_id);
CREATE INDEX IF NOT EXISTS idx_tic_key ON trade_intelligence_cache(user_id, cache_key);

-- ─── Market Intelligence ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS market_snapshots (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  instrument TEXT NOT NULL,
  metric TEXT NOT NULL,
  value REAL NOT NULL,
  direction TEXT NOT NULL DEFAULT 'neutral' CHECK(direction IN ('bullish','bearish','neutral')),
  note TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_msnap_instrument ON market_snapshots(instrument, metric, created_at DESC);

CREATE TABLE IF NOT EXISTS economic_events (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  title TEXT NOT NULL,
  title_ar TEXT,
  impact TEXT NOT NULL DEFAULT 'medium' CHECK(impact IN ('high','medium','low')),
  event_date TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  actual TEXT,
  forecast TEXT,
  previous TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS idx_eco_date ON economic_events(event_date DESC);

CREATE TABLE IF NOT EXISTS weekly_bias (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  instrument TEXT NOT NULL,
  bias TEXT NOT NULL DEFAULT 'neutral' CHECK(bias IN ('bullish','bearish','neutral')),
  week_key TEXT NOT NULL,
  notes TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, instrument, week_key)
);
CREATE INDEX IF NOT EXISTS idx_wbias_user ON weekly_bias(user_id, week_key);

CREATE TABLE IF NOT EXISTS macro_narratives (
  id TEXT PRIMARY KEY DEFAULT (lower(hex(randomblob(16)))),
  user_id TEXT NOT NULL,
  narrative_text TEXT NOT NULL,
  week_key TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(user_id, week_key)
);
CREATE INDEX IF NOT EXISTS idx_mnarr_user ON macro_narratives(user_id, week_key);