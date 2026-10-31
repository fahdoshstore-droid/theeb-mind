// Groups executions (fills) into round-trip positions, flat → flat, per account + symbol.
// A fill never becomes a trade by itself; trades are derived and reference their fills.
import { pointValue } from './instruments.js';
import { round2, type Side } from './pnl.js';
import type { NormalizedFill } from './import-normalize.js';

export interface FillLeg { fillKey: string; fill: NormalizedFill; qty: number; role: 'open' | 'add' | 'reduce' | 'close'; split: boolean }

export interface GroupedPosition {
  accountName: string | null; symbol: string; side: Side; status: 'closed' | 'open';
  legs: FillLeg[];
  quantity: number;               // max absolute position size reached
  entryTime: string; exitTime: string | null;
  avgEntry: number; avgExit: number | null;
  grossPnl: number | null; fees: number | null; netPnl: number | null;
  confidence: 'high' | 'medium' | 'low';
  confidenceReasons: string[];
  addedWhileAgainst: { fillKey: string; price: number; avgBefore: number }[];  // adds at a worse price than the running average
}

export function groupFills(fills: { key: string; fill: NormalizedFill }[]): GroupedPosition[] {
  const byInstr = new Map<string, { key: string; fill: NormalizedFill }[]>();
  for (const f of fills) {
    const k = `${f.fill.accountName ?? ''}|${f.fill.symbol}`;
    if (!byInstr.has(k)) byInstr.set(k, []);
    byInstr.get(k)!.push(f);
  }
  const out: GroupedPosition[] = [];
  for (const list of byInstr.values()) {
    list.sort((a, b) => a.fill.timeMs - b.fill.timeMs || String(a.fill.externalId).localeCompare(String(b.fill.externalId)));
    let pos = 0;                    // signed contracts
    let cur: GroupedPosition | null = null;
    let cash = 0;                   // Σ signed (sell +, buy −) price × qty, for flat-to-flat P&L
    let openQty = 0, openCost = 0, closeQty = 0, closeCost = 0, maxAbs = 0;
    const start = (f: NormalizedFill, side: Side) => {
      cur = { accountName: f.accountName, symbol: f.symbol, side, status: 'open', legs: [], quantity: 0, entryTime: f.time, exitTime: null,
        avgEntry: 0, avgExit: null, grossPnl: null, fees: 0, netPnl: null, confidence: 'high', confidenceReasons: [], addedWhileAgainst: [] };
      cash = 0; openQty = 0; openCost = 0; closeQty = 0; closeCost = 0; maxAbs = 0;
    };
    const finish = (f: NormalizedFill | null) => {
      const c = cur!;
      c.quantity = maxAbs;
      c.avgEntry = openQty ? openCost / openQty : 0;
      c.avgExit = closeQty ? closeCost / closeQty : null;
      const spec = c.legs[0].fill;
      if (f) {
        c.status = 'closed'; c.exitTime = f.time;
        if (spec.tickSize && spec.tickValue) c.grossPnl = round2(cash * pointValue({ tickSize: spec.tickSize, tickValue: spec.tickValue }));
        else { c.confidence = 'low'; c.confidenceReasons.push('contract spec unknown — P&L not computed'); }
      }
      const anyFeeMissing = c.legs.some((l) => l.fill.fees == null);
      c.fees = anyFeeMissing ? null : round2(c.legs.reduce((s, l) => s + (l.split ? (l.fill.fees! * l.qty) / l.fill.quantity : l.fill.fees!), 0));
      if (anyFeeMissing && c.legs.some((l) => l.fill.fees != null)) c.confidenceReasons.push('fees missing on some fills — net P&L unknown');
      c.netPnl = c.grossPnl != null && c.fees != null ? round2(c.grossPnl - c.fees) : null;
      if (c.legs.some((l) => !l.fill.externalId)) { if (c.confidence === 'high') c.confidence = 'medium'; c.confidenceReasons.push('some fills have no execution id'); }
      out.push(c); cur = null;
    };
    for (const { key, fill } of list) {
      const signed = fill.side === 'buy' ? fill.quantity : -fill.quantity;
      let remaining = signed;
      while (remaining !== 0) {
        if (pos === 0) start(fill, remaining > 0 ? 'long' : 'short');
        const c = cur!;
        const sameDir = Math.sign(remaining) === Math.sign(pos) || pos === 0;
        let take = remaining;
        if (!sameDir && Math.abs(remaining) > Math.abs(pos)) take = -pos;   // flip through zero → split the fill
        const split = take !== signed;
        if (split) { c.confidence = c.confidence === 'low' ? 'low' : 'medium'; c.confidenceReasons.push(`fill ${fill.externalId ?? key} reverses the position and was split`); }
        const q = Math.abs(take);
        if (sameDir) {
          const avgBefore = openQty ? openCost / openQty : null;
          if (avgBefore != null && ((c.side === 'long' && fill.price < avgBefore) || (c.side === 'short' && fill.price > avgBefore)))
            c.addedWhileAgainst.push({ fillKey: key, price: fill.price, avgBefore: Math.round(avgBefore * 100) / 100 });
          openQty += q; openCost += q * fill.price;
        } else { closeQty += q; closeCost += q * fill.price; }
        cash += (take > 0 ? -1 : 1) * q * fill.price;
        pos += take;
        maxAbs = Math.max(maxAbs, Math.abs(pos));
        c.legs.push({ fillKey: key, fill, qty: q, role: pos === 0 ? 'close' : sameDir ? (c.legs.length ? 'add' : 'open') : 'reduce', split });
        if (pos === 0) finish(fill);
        remaining -= take;
      }
    }
    if (cur) { (cur as GroupedPosition).confidenceReasons.push('position still open at end of file'); finish(null); }
  }
  return out.sort((a, b) => a.entryTime.localeCompare(b.entryTime));
}
