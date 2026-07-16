import type { GateVerdict } from '../../lib/types';

interface GuardBadgeProps {
  verdict: GateVerdict;
  size?: 'sm' | 'lg';
}

const VERDICT_CONFIG: Record<GateVerdict, { color: string; bg: string; border: string; label: string; icon: string }> = {
  GO:      { color: 'text-emerald',   bg: 'bg-emerald/10',  border: 'border-emerald/30', label: 'مسموح', icon: '✓' },
  CAUTION: { color: 'text-gold',      bg: 'bg-gold/10',    border: 'border-gold/30',     label: 'تنبيه',  icon: '⚠' },
  STOP:   { color: 'text-warning',    bg: 'bg-warning/10',  border: 'border-warning/30',  label: 'ممنوع',  icon: '✕' },
};

export default function GuardBadge({ verdict, size = 'lg' }: GuardBadgeProps) {
  const cfg = VERDICT_CONFIG[verdict];
  const isLarge = size === 'lg';

  return (
    <div className={`inline-flex flex-col items-center gap-1 rounded-2xl border-2 ${cfg.bg} ${cfg.border} ${
      isLarge ? 'px-5 py-3' : 'px-3 py-1'
    }`}>
      <span className="text-cream/50 text-xs">الجاهزية النفسية</span>
      <div className={`inline-flex items-center gap-2 font-bold ${cfg.color} ${isLarge ? 'text-lg' : 'text-sm'}`}>
        <span className={isLarge ? 'text-xl' : 'text-sm'}>{cfg.icon}</span>
        <span>{cfg.label}</span>
      </div>
    </div>
  );
}