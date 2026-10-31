import { v4 as uuid } from 'uuid';
import { db } from '../../db/db.js';
import { audit, notFound, badRequest, j } from './common.js';
import type { FirmRules, Phase } from '../../domain/payout.js';

export interface AccountRow {
  id: string; user_id: string; name: string; broker: string | null; firm_profile_id: string | null; phase: Phase;
  starting_balance: number | null; currency: string; is_demo: number; archived: number; created_at: string;
}

export function listAccounts(userId: string): AccountRow[] {
  return db.raw.prepare('SELECT * FROM trading_accounts WHERE user_id = ? ORDER BY is_demo, name').all(userId) as AccountRow[];
}

export function getAccount(userId: string, id: string): AccountRow {
  const a = db.raw.prepare('SELECT * FROM trading_accounts WHERE id = ? AND user_id = ?').get(id, userId) as AccountRow | undefined;
  if (!a) throw notFound('account');
  return a;
}

export function findOrCreateAccount(userId: string, name: string, isDemo = false): AccountRow {
  const ex = db.raw.prepare('SELECT * FROM trading_accounts WHERE user_id = ? AND name = ?').get(userId, name) as AccountRow | undefined;
  if (ex) {
    if (Boolean(ex.is_demo) !== isDemo) throw badRequest(`account "${name}" is ${ex.is_demo ? 'a DEMO' : 'a real'} account — demo and real data cannot be mixed`, 'DEMO_MIX');
    return ex;
  }
  return createAccount(userId, { name, isDemo, phase: isDemo ? 'demo' : 'personal' });
}

export function createAccount(userId: string, a: { name: string; broker?: string | null; firmProfileId?: string | null; phase?: Phase; startingBalance?: number | null; currency?: string; isDemo?: boolean }): AccountRow {
  if (a.firmProfileId) getFirmProfile(userId, a.firmProfileId);
  const id = uuid();
  try {
    db.raw.prepare(`INSERT INTO trading_accounts (id, user_id, name, broker, firm_profile_id, phase, starting_balance, currency, is_demo) VALUES (?,?,?,?,?,?,?,?,?)`)
      .run(id, userId, a.name.trim(), a.broker ?? null, a.firmProfileId ?? null, a.isDemo ? 'demo' : a.phase ?? 'personal', a.startingBalance ?? null, a.currency ?? 'USD', a.isDemo ? 1 : 0);
  } catch (e) {
    if (String(e).includes('UNIQUE')) throw badRequest(`an account named "${a.name}" already exists`, 'DUPLICATE_ACCOUNT');
    throw e;
  }
  audit(userId, 'ledger.account.create', { id, name: a.name });
  return getAccount(userId, id);
}

export function updateAccount(userId: string, id: string, p: { name?: string; broker?: string | null; firmProfileId?: string | null; phase?: Phase; startingBalance?: number | null; archived?: boolean }): AccountRow {
  const cur = getAccount(userId, id);
  if (p.firmProfileId) getFirmProfile(userId, p.firmProfileId);
  if (cur.is_demo && p.phase && p.phase !== 'demo') throw badRequest('a DEMO account cannot change phase', 'DEMO_MIX');
  db.raw.prepare(`UPDATE trading_accounts SET name = COALESCE(?, name), broker = ?, firm_profile_id = ?, phase = COALESCE(?, phase), starting_balance = ?, archived = COALESCE(?, archived) WHERE id = ? AND user_id = ?`)
    .run(p.name ?? null, p.broker !== undefined ? p.broker : cur.broker, p.firmProfileId !== undefined ? p.firmProfileId : cur.firm_profile_id, p.phase ?? null,
      p.startingBalance !== undefined ? p.startingBalance : cur.starting_balance, p.archived === undefined ? null : p.archived ? 1 : 0, id, userId);
  audit(userId, 'ledger.account.update', { id, before: cur, patch: p });
  return getAccount(userId, id);
}

// ── Firm profiles ──
export interface FirmRow { id: string; user_id: string; name: string; source_url: string | null; source_checked_at: string | null; rules_json: string; notes: string | null; created_at: string; updated_at: string }
export const firmOut = (f: FirmRow) => ({ id: f.id, name: f.name, sourceUrl: f.source_url, sourceCheckedAt: f.source_checked_at, rules: j<FirmRules>(f.rules_json, {}), notes: f.notes, updatedAt: f.updated_at });

export function listFirmProfiles(userId: string) {
  return (db.raw.prepare('SELECT * FROM firm_profiles WHERE user_id = ? ORDER BY name').all(userId) as FirmRow[]).map(firmOut);
}
export function getFirmProfile(userId: string, id: string): FirmRow {
  const f = db.raw.prepare('SELECT * FROM firm_profiles WHERE id = ? AND user_id = ?').get(id, userId) as FirmRow | undefined;
  if (!f) throw notFound('firm profile');
  return f;
}
export function upsertFirmProfile(userId: string, id: string | null, p: { name: string; sourceUrl?: string | null; sourceCheckedAt?: string | null; rules: FirmRules; notes?: string | null }) {
  if (p.sourceUrl && !/^https:\/\//i.test(p.sourceUrl)) throw badRequest('source URL must be https://');
  if (id) {
    const before = getFirmProfile(userId, id);
    db.raw.prepare(`UPDATE firm_profiles SET name=?, source_url=?, source_checked_at=?, rules_json=?, notes=?, updated_at=strftime('%Y-%m-%dT%H:%M:%fZ','now') WHERE id=? AND user_id=?`)
      .run(p.name, p.sourceUrl ?? null, p.sourceCheckedAt ?? null, JSON.stringify(p.rules), p.notes ?? null, id, userId);
    audit(userId, 'ledger.firm.update', { id, before: firmOut(before), after: p });
    return firmOut(getFirmProfile(userId, id));
  }
  const nid = uuid();
  db.raw.prepare('INSERT INTO firm_profiles (id, user_id, name, source_url, source_checked_at, rules_json, notes) VALUES (?,?,?,?,?,?,?)')
    .run(nid, userId, p.name, p.sourceUrl ?? null, p.sourceCheckedAt ?? null, JSON.stringify(p.rules), p.notes ?? null);
  audit(userId, 'ledger.firm.create', { id: nid, ...p });
  return firmOut(getFirmProfile(userId, nid));
}
