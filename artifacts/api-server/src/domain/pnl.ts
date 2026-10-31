// Round-trip P&L and risk arithmetic. Pure functions, no I/O.
import { pointValue } from './instruments.js';

export type Side = 'long' | 'short';
export type ValueSource = 'source_reported' | 'recomputed' | 'estimated' | 'unknown';

export const round2 = (n: number): number => Math.round((n + Number.EPSILON) * 100) / 100;

export interface PnlInput {
  side: Side;
  quantity: number;
  entryPrice: number | null;
  exitPrice: number | null;
  tickSize: number | null;
  tickValue: number | null;
}

/** Gross P&L recomputed from prices: (exit − entry) × direction × qty × point value. */
export function recomputeGross(t: PnlInput): number | null {
  if (t.entryPrice == null || t.exitPrice == null || !t.tickSize || !t.tickValue || !(t.quantity > 0)) return null;
  const dir = t.side === 'long' ? 1 : -1;
  return round2((t.exitPrice - t.entryPrice) * dir * t.quantity * pointValue({ tickSize: t.tickSize, tickValue: t.tickValue }));
}

export interface ResolvedPnl {
  gross: number | null; grossSource: ValueSource;
  fees: number | null; feesSource: ValueSource;
  net: number | null; netSource: ValueSource;
  recomputedGross: number | null;
  mismatch: number | null;      // reported gross (or net+fees) − recomputed gross, when both exist
  warnings: string[];
}

/**
 * Decides which P&L numbers to keep and labels each one.
 * Source-reported values win; recomputation is used to fill gaps and to flag mismatches.
 * Nothing is estimated: if a value can't be reported or recomputed it stays null/unknown.
 */
export function resolvePnl(input: PnlInput & {
  reportedGross: number | null; reportedNet: number | null; reportedFees: number | null; closed: boolean;
}): ResolvedPnl {
  const warnings: string[] = [];
  if (!input.closed) {
    return { gross: null, grossSource: 'unknown', fees: input.reportedFees, feesSource: input.reportedFees == null ? 'unknown' : 'source_reported',
      net: null, netSource: 'unknown', recomputedGross: null, mismatch: null, warnings: ['open position — realized P&L unknown'] };
  }
  const rg = recomputeGross(input);
  let gross: number | null = input.reportedGross, grossSource: ValueSource = gross == null ? 'unknown' : 'source_reported';
  let fees: number | null = input.reportedFees, feesSource: ValueSource = fees == null ? 'unknown' : 'source_reported';
  let net: number | null = input.reportedNet, netSource: ValueSource = net == null ? 'unknown' : 'source_reported';

  if (gross == null && net != null && fees != null) { gross = round2(net + fees); grossSource = 'recomputed'; }
  if (gross == null && rg != null) { gross = rg; grossSource = 'recomputed'; }
  if (fees == null && gross != null && net != null && grossSource === 'source_reported') { fees = round2(gross - net); feesSource = 'recomputed'; }
  if (net == null && gross != null && fees != null) { net = round2(gross - fees); netSource = 'recomputed'; }
  if (net == null && gross != null && fees == null) warnings.push('net P&L unknown: fees not provided');

  let mismatch: number | null = null;
  const comparableGross = input.reportedGross ?? (input.reportedNet != null && input.reportedFees != null ? input.reportedNet + input.reportedFees : null);
  if (rg != null && comparableGross != null) {
    mismatch = round2(comparableGross - rg);
    if (Math.abs(mismatch) > 0.01) warnings.push(`reported gross differs from price-recomputed gross by ${mismatch.toFixed(2)} (check point value, partial exits, or fees)`);
    else mismatch = 0;
  }
  if (rg == null && input.reportedNet == null && input.reportedGross == null) warnings.push('P&L unknown: no reported P&L and prices/contract spec insufficient to recompute');
  return { gross, grossSource, fees, feesSource, net, netSource, recomputedGross: rg, mismatch, warnings };
}

export interface RiskInput {
  side: Side;
  entryPrice: number;
  stopPrice: number;
  targetPrice?: number | null;
  quantity: number;
  tickSize: number;
  tickValue: number;
  feesPerContractRoundTrip?: number | null;  // commissions + exchange fees, if known
  slippageTicks?: number | null;             // optional user assumption, labelled
}

export interface RiskResult {
  valid: boolean;
  errors: string[];
  stopDistancePoints: number | null;
  stopDistanceTicks: number | null;
  riskPerContract: number | null;        // price risk only
  riskUsd: number | null;                // price risk × qty
  feesUsd: number | null;
  slippageUsd: number | null;
  totalRiskUsd: number | null;           // price + fees + slippage assumption
  rewardUsd: number | null;
  rrr: number | null;                    // reward / price risk (fees excluded; see rrrAfterCosts)
  rrrAfterCosts: number | null;
}

/** Initial risk from planned entry/stop/qty and contract spec. Never inferred from P&L. */
export function computeRisk(r: RiskInput): RiskResult {
  const errors: string[] = [];
  const empty: RiskResult = { valid: false, errors, stopDistancePoints: null, stopDistanceTicks: null, riskPerContract: null, riskUsd: null,
    feesUsd: null, slippageUsd: null, totalRiskUsd: null, rewardUsd: null, rrr: null, rrrAfterCosts: null };
  if (![r.entryPrice, r.stopPrice].every(Number.isFinite)) errors.push('entry and stop are required');
  if (!(r.quantity > 0) || !Number.isInteger(r.quantity)) errors.push('quantity must be a positive whole number of contracts');
  if (!(r.tickSize > 0) || !(r.tickValue > 0)) errors.push('tick size and tick value are required');
  if (errors.length) return empty;
  const dir = r.side === 'long' ? 1 : -1;
  const stopDist = (r.entryPrice - r.stopPrice) * dir;
  if (stopDist <= 0) { errors.push(r.side === 'long' ? 'stop must be below entry for a long' : 'stop must be above entry for a short'); return empty; }
  const pv = pointValue(r);
  const riskPerContract = round2(stopDist * pv);
  const riskUsd = round2(riskPerContract * r.quantity);
  const feesUsd = r.feesPerContractRoundTrip != null ? round2(r.feesPerContractRoundTrip * r.quantity) : null;
  const slippageUsd = r.slippageTicks != null ? round2(r.slippageTicks * r.tickValue * r.quantity) : null;
  const totalRiskUsd = round2(riskUsd + (feesUsd ?? 0) + (slippageUsd ?? 0));
  let rewardUsd: number | null = null, rrr: number | null = null, rrrAfterCosts: number | null = null;
  if (r.targetPrice != null && Number.isFinite(r.targetPrice)) {
    const tgtDist = (r.targetPrice - r.entryPrice) * dir;
    if (tgtDist <= 0) errors.push(r.side === 'long' ? 'target must be above entry for a long' : 'target must be below entry for a short');
    else {
      rewardUsd = round2(tgtDist * pv * r.quantity);
      rrr = Math.round((tgtDist / stopDist) * 100) / 100;
      const costs = (feesUsd ?? 0) + (slippageUsd ?? 0);
      rrrAfterCosts = Math.round(((rewardUsd - costs) / (riskUsd + costs)) * 100) / 100;
    }
  }
  return { valid: errors.length === 0, errors, stopDistancePoints: stopDist, stopDistanceTicks: Math.round((stopDist / r.tickSize) * 100) / 100,
    riskPerContract, riskUsd, feesUsd, slippageUsd, totalRiskUsd, rewardUsd, rrr, rrrAfterCosts };
}

/** R multiple — only from a verifiable initial risk. */
export function rMultiple(netPnl: number | null, initialRiskUsd: number | null): number | null {
  if (netPnl == null || initialRiskUsd == null || !(initialRiskUsd > 0)) return null;
  return Math.round((netPnl / initialRiskUsd) * 100) / 100;
}
