import BetterSqlite3 from 'better-sqlite3';
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { env } from '../config/env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export class Database {
  private db: BetterSqlite3.Database;
  private stmts: Map<string, BetterSqlite3.Statement> = new Map();

  constructor() {
    this.db = new BetterSqlite3(env.DB_PATH);
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
  }

  init(): void {
    const schemaPath = join(__dirname, 'schema.sql');
    const schema = readFileSync(schemaPath, 'utf-8');
    this.db.exec(schema);
    this.prepareStatements();
  }

  private prepareStatements(): void {
    this.stmts.set('insertDecision', this.db.prepare(
      `INSERT INTO decisions (id, user_id, type, image_hash, timeframe, instrument,
       analysis_json, scoring_json, psychology_json, risk_json, coaching_json,
       quality_score, grade, killzone, day_blocked, news_blackout, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ));

    this.stmts.set('getDecision', this.db.prepare('SELECT * FROM decisions WHERE id = ?'));
    this.stmts.set('getDecisionsByUser', this.db.prepare('SELECT * FROM decisions WHERE user_id = ? ORDER BY created_at DESC'));
    this.stmts.set('updateOutcome', this.db.prepare(
      `UPDATE decisions SET outcome = ?, outcome_pnl = ?, outcome_notes = ?, outcome_at = datetime('now') WHERE id = ?`
    ));

    this.stmts.set('insertAuditEvent', this.db.prepare(
      `INSERT INTO audit_events (user_id, event_type, event_data) VALUES (?, ?, ?)`
    ));

    this.stmts.set('insertVerification', this.db.prepare(
      `INSERT INTO verifications (user_id, content, source, credibility, credibility_score, claims_count, verified_claims, rejected_claims, manipulation_flags, verdict)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ));

    this.stmts.set('insertPsychologyState', this.db.prepare(
      `INSERT INTO psychology_state (user_id, decision_id, phase, score, max_score, verdict, behavioral_lock, lock_reason)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    ));

    this.stmts.set('getPsychologyState', this.db.prepare(
      `SELECT * FROM psychology_state WHERE user_id = ? ORDER BY created_at DESC LIMIT 1`
    ));

    this.stmts.set('insertDecisionTag', this.db.prepare(
      `INSERT OR IGNORE INTO decision_tags (decision_id, tag) VALUES (?, ?)`
    ));

    this.stmts.set('getDecisionsByUserDateRange', this.db.prepare(
      `SELECT * FROM decisions WHERE user_id = ? AND created_at >= ? AND created_at <= ? ORDER BY created_at DESC`
    ));

    this.stmts.set('getUserStats', this.db.prepare(
      `SELECT
        COUNT(*) as total,
        SUM(CASE WHEN outcome = 'win' THEN 1 ELSE 0 END) as wins,
        SUM(CASE WHEN outcome = 'loss' THEN 1 ELSE 0 END) as losses,
        AVG(quality_score) as avg_quality,
        SUM(outcome_pnl) as total_pnl
       FROM decisions WHERE user_id = ?`
    ));
  }

  stmt(name: string): BetterSqlite3.Statement {
    const s = this.stmts.get(name);
    if (!s) throw new Error(`Prepared statement "${name}" not found`);
    return s;
  }

  get raw(): BetterSqlite3.Database {
    return this.db;
  }

  close(): void {
    this.db.close();
  }
}

export const db = new Database();