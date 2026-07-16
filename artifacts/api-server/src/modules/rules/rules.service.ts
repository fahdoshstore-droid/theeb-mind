import { db } from '../../db/db.js';
import { RULE_REGISTRY } from './rule-registry.js';
import type { RuleContext } from './rule-registry.js';

// ── Types ──────────────────────────────────────────────

export interface RuleViolation {
  ruleId: string;
  ruleName: string;
  severity: 'warning' | 'block';
  description: string;
}

export interface EvaluateResult {
  violations: RuleViolation[];
  blocked: boolean;
  warnings: string[];
}

export interface ViolationRecord {
  id: number;
  user_id: string;
  rule_id: string;
  rule_name: string;
  severity: 'warning' | 'block';
  context_json: string;
  created_at: string;
}

export interface ViolationWithStats extends ViolationRecord {
  /** Total number of times this rule has been violated by this user (all time) */
  totalOccurrences: number;
}

// ── Service functions ──────────────────────────────────

export function evaluateRules(userId: string, context: RuleContext): EvaluateResult {
  const violations: RuleViolation[] = [];
  const contextStr = JSON.stringify(context);
  const insertStmt = db.raw.prepare(
    `INSERT INTO rule_violations (user_id, rule_id, rule_name, severity, context_json)
     VALUES (?, ?, ?, ?, ?)`
  );

  for (const rule of RULE_REGISTRY) {
    if (rule.evaluate(context)) {
      violations.push({
        ruleId:      rule.id,
        ruleName:    rule.name,
        severity:    rule.severity,
        description: rule.description,
      });
      // Persist every violation for audit trail
      insertStmt.run(userId, rule.id, rule.name, rule.severity, contextStr);
    }
  }

  return {
    violations,
    blocked:  violations.some(v => v.severity === 'block'),
    warnings: violations.map(v => v.description),
  };
}

export function getViolations(userId: string, limit = 50): ViolationWithStats[] {
  const rows = db.raw.prepare(
    `SELECT * FROM rule_violations WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`
  ).all(userId, limit) as ViolationRecord[];

  // Count total occurrences per rule across all time for this user
  const occurrenceRows = db.raw.prepare(
    `SELECT rule_id, COUNT(*) as total
     FROM rule_violations WHERE user_id = ?
     GROUP BY rule_id`
  ).all(userId) as { rule_id: string; total: number }[];

  const occurrenceMap = new Map<string, number>();
  for (const r of occurrenceRows) {
    occurrenceMap.set(r.rule_id, r.total);
  }

  return rows.map(r => ({
    ...r,
    totalOccurrences: occurrenceMap.get(r.rule_id) ?? 1,
  }));
}

export function getRuleConfig() {
  return RULE_REGISTRY.map(r => ({
    id:          r.id,
    name:        r.name,
    nameEn:      r.nameEn,
    description: r.description,
    threshold:   r.threshold,
    severity:    r.severity,
  }));
}
