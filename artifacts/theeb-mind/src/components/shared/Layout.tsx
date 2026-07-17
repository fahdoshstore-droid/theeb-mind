import { useState, useEffect, type ReactNode, type ComponentType } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { BarChart3, ShieldCheck, Zap, Globe, BookOpen, ChevronLeft, ChevronRight } from 'lucide-react';
import { USE_DEMO_MODE } from '../../lib/api';

// ── Route → station name ──────────────────────────────────────────────────────
const STATION_NAMES: Record<string, string> = {
  '/analyze':      'مركز القرار',
  '/market':       'السياق الكلي',
  '/journal':      'السجل والأداء',
  '/performance':  'السجل والأداء',
  '/intelligence': 'أنماط الفشل',
  '/verify':       'التحقق',
};

// ── Killzone helper ───────────────────────────────────────────────────────────
function getKillzone(): { nameAr: string; active: boolean } {
  const now = new Date();
  const t = now.getUTCHours() * 60 + now.getUTCMinutes();
  if (t >= 60  && t < 240)  return { nameAr: 'الآسيوية',   active: true  };
  if (t >= 480 && t < 660)  return { nameAr: 'اللندنية',   active: true  };
  if (t >= 780 && t < 960)  return { nameAr: 'نيويورك ص',  active: true  };
  if (t >= 960 && t < 1080) return { nameAr: 'نيويورك غ',  active: false };
  if (t >= 1080&& t < 1260) return { nameAr: 'نيويورك م',  active: true  };
  return { nameAr: 'خارج النافذة', active: false };
}

// ── HUD Bar ───────────────────────────────────────────────────────────────────
function HudBar({ stationName }: { stationName: string }) {
  const [time, setTime] = useState(() => new Date());
  const [kz, setKz] = useState(getKillzone);

  useEffect(() => {
    const id = setInterval(() => {
      setTime(new Date());
      setKz(getKillzone());
    }, 1000);
    return () => clearInterval(id);
  }, []);

  const timeStr = time.toLocaleTimeString('en-US', {
    hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false,
  });

  return (
    <div style={{
      position: 'absolute', top: 0, left: 0, right: 0,
      height: '44px',
      background: 'linear-gradient(to bottom, rgba(5,5,8,0.92) 0%, rgba(5,5,8,0.0) 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      padding: '0 20px',
      zIndex: 50,
      pointerEvents: 'none',
    }}>
      {/* Station name — left in LTR context (appears on right in RTL layout) */}
      <span style={{
        color: 'var(--gold)', fontSize: '11px', fontWeight: 700,
        letterSpacing: '2px', textTransform: 'uppercase',
        fontFamily: 'var(--font-body)',
      }}>
        {stationName}
      </span>

      {/* Right cluster */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', pointerEvents: 'auto' }}>
        {/* Killzone */}
        <span style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <span style={{
            width: '6px', height: '6px', borderRadius: '50%',
            background: kz.active ? 'var(--emerald)' : 'var(--gold)',
            boxShadow: kz.active
              ? '0 0 6px var(--emerald)'
              : '0 0 6px var(--gold)',
            animation: kz.active ? 'pulse-hud 2s infinite' : 'none',
            display: 'inline-block', flexShrink: 0,
          }} />
          <span style={{
            color: kz.active ? 'var(--emerald)' : 'var(--gold)',
            fontSize: '10px', fontFamily: 'var(--font-body)', letterSpacing: '0.3px',
          }}>
            {kz.nameAr}
          </span>
        </span>

        <span style={{ color: 'var(--border-strong)', fontSize: '10px' }}>|</span>

        {/* LIVE badge */}
        <span style={{
          background: 'var(--green-bg)', color: 'var(--emerald)',
          fontSize: '9px', fontWeight: 700, letterSpacing: '1.5px',
          padding: '2px 7px', borderRadius: '100px',
          border: '1px solid var(--emerald)',
        }}>
          LIVE
        </span>

        {/* Clock */}
        <span style={{
          color: 'var(--text-muted)', fontSize: '10px',
          fontFamily: 'var(--font-mono)',
        }}>
          {timeStr}
        </span>

        {/* Demo badge */}
        {USE_DEMO_MODE && (
          <span style={{
            background: 'rgba(212,168,67,0.12)', color: 'var(--gold)',
            fontSize: '9px', fontWeight: 700, letterSpacing: '1px',
            padding: '2px 7px', borderRadius: '100px',
            border: '1px solid var(--border-medium)',
          }}>
            DEMO
          </span>
        )}
      </div>
    </div>
  );
}

// ── Nav item ──────────────────────────────────────────────────────────────────
function NavItem({
  to, icon: Icon, label, expanded, primary, utility,
}: {
  to: string;
  icon: ComponentType<{ size?: number }>;
  label: string;
  expanded: boolean;
  primary?: boolean;
  utility?: boolean;
}) {
  return (
    <NavLink
      to={to}
      style={({ isActive }) => ({
        width: expanded ? 'calc(100% - 16px)' : '42px',
        height: '42px',
        borderRadius: '10px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: expanded ? 'flex-end' : 'center',
        gap: '9px',
        padding: expanded ? '0 14px' : '0',
        margin: '2px 8px',
        cursor: 'pointer',
        textDecoration: 'none',
        transition: 'all 0.18s ease',
        background: isActive ? 'var(--gold-subtle)' : 'transparent',
        color: isActive
          ? 'var(--gold)'
          : utility
          ? 'var(--text-muted)'
          : 'var(--text-secondary)',
        borderLeft: isActive ? '3px solid var(--gold)' : '3px solid transparent',
        boxShadow: isActive ? 'inset 0 0 12px var(--gold-glow)' : 'none',
        fontSize: primary ? '12px' : '11px',
        fontWeight: primary ? 700 : 500,
      })}
    >
      {({ isActive: _ia }) => (
        <>
          {expanded && (
            <span style={{
              whiteSpace: 'nowrap',
              fontFamily: 'var(--font-body)',
              letterSpacing: '0.3px',
              overflow: 'hidden',
            }}>
              {label}
            </span>
          )}
          <Icon size={primary ? 18 : 16} />
        </>
      )}
    </NavLink>
  );
}

// ── Primary nav separator ─────────────────────────────────────────────────────
function Divider({ expanded }: { expanded: boolean }) {
  return (
    <div style={{
      width: expanded ? 'calc(100% - 28px)' : '28px',
      height: '1px',
      background: 'var(--border)',
      margin: '6px auto',
      transition: 'width 0.25s ease',
    }} />
  );
}

// ── Navigation items ──────────────────────────────────────────────────────────
const NAV_PRIMARY   = [{ to: '/analyze',      icon: BarChart3,   label: 'مركز القرار'  }];
const NAV_SECONDARY = [
  { to: '/market',       icon: Globe,       label: 'السياق الكلي'  },
  { to: '/journal',      icon: BookOpen,    label: 'السجل والأداء' },
  { to: '/intelligence', icon: Zap,         label: 'أنماط الفشل'  },
];
const NAV_UTILITY   = [{ to: '/verify',       icon: ShieldCheck, label: 'التحقق'       }];

// ── Layout ────────────────────────────────────────────────────────────────────
export default function Layout({ children }: { children: ReactNode }) {
  const [expanded, setExpanded] = useState(false);
  const location = useLocation();
  const stationName = STATION_NAMES[location.pathname] ?? 'THEEB MIND';

  return (
    <div
      dir="rtl"
      style={{
        display: 'flex',
        height: '100dvh',
        background: 'var(--void)',
        overflow: 'hidden',
      }}
    >
      {/* ── Station Rail ── */}
      <aside
        style={{
          width: expanded ? 'var(--rail-expanded)' : 'var(--rail-width)',
          flexShrink: 0,
          background: 'var(--void)',
          borderLeft: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          alignItems: expanded ? 'flex-end' : 'center',
          padding: '12px 0',
          transition: 'width 0.25s cubic-bezier(0.16,1,0.3,1)',
          zIndex: 60,
          overflowX: 'hidden',
        }}
      >
        {/* Logo */}
        <div style={{
          padding: expanded ? '6px 14px' : '6px',
          marginBottom: '16px',
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: expanded ? 'flex-end' : 'center',
        }}>
          <img
            src="/wolf-hero.png"
            alt="DHEEB"
            style={{ width: '32px', height: '32px', objectFit: 'contain', borderRadius: '8px', opacity: 0.85 }}
            onError={(e) => {
              const t = e.currentTarget as HTMLImageElement;
              t.style.display = 'none';
              const wrap = t.parentElement;
              if (wrap) {
                const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
                s.setAttribute('width', '32'); s.setAttribute('height', '32');
                s.setAttribute('viewBox', '0 0 48 48'); s.setAttribute('fill', 'none');
                s.innerHTML = `<path d="M24 6L14 22L8 38H18L24 28L30 38H40L34 22L24 6Z" stroke="#d4a843" stroke-width="1.5" fill="none"/><circle cx="19" cy="20" r="2" fill="#d4a843" opacity="0.7"/><circle cx="29" cy="20" r="2" fill="#d4a843" opacity="0.7"/>`;
                wrap.insertBefore(s, t.nextSibling);
              }
            }}
          />
          {expanded && (
            <span style={{
              marginRight: '10px',
              color: 'var(--gold)',
              fontSize: '11px',
              fontWeight: 700,
              letterSpacing: '2px',
              fontFamily: 'var(--font-mono)',
              whiteSpace: 'nowrap',
            }}>
              DHEEB
            </span>
          )}
        </div>

        {/* Primary station */}
        {NAV_PRIMARY.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} expanded={expanded} primary />
        ))}

        <Divider expanded={expanded} />

        {/* Secondary stations */}
        {NAV_SECONDARY.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} expanded={expanded} />
        ))}

        {/* Spacer */}
        <div style={{ flex: 1 }} />

        <Divider expanded={expanded} />

        {/* Utility station */}
        {NAV_UTILITY.map(({ to, icon, label }) => (
          <NavItem key={to} to={to} icon={icon} label={label} expanded={expanded} utility />
        ))}

        {/* Expand / collapse toggle */}
        <button
          onClick={() => setExpanded((e) => !e)}
          title={expanded ? 'طي القائمة' : 'توسيع القائمة'}
          style={{
            marginTop: '10px',
            width: '32px',
            height: '32px',
            borderRadius: '8px',
            background: 'var(--void-raised)',
            border: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            transition: 'border-color 0.2s, color 0.2s',
            flexShrink: 0,
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-medium)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
            (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-muted)';
          }}
        >
          {expanded ? <ChevronLeft size={14} /> : <ChevronRight size={14} />}
        </button>
      </aside>

      {/* ── Main Stage ── */}
      <main
        style={{
          flex: 1,
          position: 'relative',
          overflow: 'hidden',
          background: 'var(--void)',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        {/* Floating HUD overlay */}
        <HudBar stationName={stationName} />

        {/* Content area — scrollable, below HUD */}
        <div style={{ flex: 1, overflow: 'auto', paddingTop: '44px', display: 'flex', flexDirection: 'column' }}>
          {children}
        </div>
      </main>
    </div>
  );
}
