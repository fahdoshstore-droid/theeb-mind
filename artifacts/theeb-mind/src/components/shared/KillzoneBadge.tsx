import type { KillzoneStatus } from '../../lib/types';

interface KillzoneBadgeProps {
  nameAr: string;
  status: KillzoneStatus;
}

const STATUS_CONFIG: Record<KillzoneStatus, { color: string; bg: string; dot: string; label: string }> = {
  active:  { color: 'text-emerald',          bg: 'bg-emerald/10',       dot: 'bg-emerald',   label: 'نشط الآن' },
  inactive: { color: 'text-warning',           bg: 'bg-warning/10',       dot: 'bg-warning',   label: 'خارج نافذة النشاط' },
  avoid:  { color: 'text-gold',              bg: 'bg-gold/10',          dot: 'bg-gold',      label: 'فترة تجنب' },
};

export default function KillzoneBadge({ nameAr, status }: KillzoneBadgeProps) {
  const cfg = STATUS_CONFIG[status];

  return (
    <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full ${cfg.bg}`}>
      <span className={`w-2.5 h-2.5 rounded-full ${cfg.dot} animate-pulse`} />
      <span className={`font-medium text-sm ${cfg.color}`}>نافذة نشاط السوق: {nameAr}</span>
      <span className="text-cream/30">|</span>
      <span className={`text-xs ${cfg.color}`}>{cfg.label}</span>
    </div>
  );
}