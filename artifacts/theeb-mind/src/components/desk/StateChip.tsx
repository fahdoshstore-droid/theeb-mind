// Data-state and integration-stage indicators for the Market Desk.
// Colour is never the only signal: every chip carries its own mark and text.
import { SOURCES, STAGE_LABEL, stagePips, type SourceEntry } from '../../lib/sources';

export type DataState = 'LIVE' | 'DELAYED' | 'STALE' | 'UNAVAILABLE' | 'VERIFIED' | 'MISMATCH' | 'NO_SOURCE' | 'NOT_APPROVED' | 'METHODOLOGY_PENDING';

const CLASS: Record<DataState, string> = {
  LIVE: 'live', DELAYED: 'delay', STALE: 'stale', UNAVAILABLE: 'na', VERIFIED: 'ok', MISMATCH: 'warn',
  NO_SOURCE: 'na', NOT_APPROVED: 'na', METHODOLOGY_PENDING: 'pend',
};
const TEXT: Record<DataState, string> = {
  LIVE: 'LIVE', DELAYED: 'DELAYED', STALE: 'STALE', UNAVAILABLE: 'UNAVAILABLE', VERIFIED: 'VERIFIED', MISMATCH: 'MISMATCH',
  NO_SOURCE: 'NO SOURCE', NOT_APPROVED: 'NOT APPROVED', METHODOLOGY_PENDING: 'METHODOLOGY PENDING',
};

export function StateChip({ state, detail }: { state: DataState; detail?: string }) {
  return <span className={'chip ' + CLASS[state]}>{TEXT[state]}{detail ? ' · ' + detail : ''}</span>;
}

export function SourceStage({ entry, verified = false }: { entry: SourceEntry | string; verified?: boolean }) {
  const e = typeof entry === 'string' ? SOURCES[entry] : entry;
  const { filled, reported } = stagePips(e, verified);
  const label = verified ? 'VERIFIED' : STAGE_LABEL[e.stage] + (reported ? ' · HERMES (REPORTED)' : '');
  return (
    <span className="stg" title={e.note} aria-label={`${e.label}: ${label}`}>
      <i aria-hidden="true">
        {[0, 1, 2, 3].map((i) => (
          <b key={i} className={i < filled ? 'on' : i === 1 && reported ? 'rep' : ''} />
        ))}
      </i>
      {label}
    </span>
  );
}
