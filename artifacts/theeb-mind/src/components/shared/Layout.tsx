import { useState, ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import {
  BarChart3,
  ShieldCheck,
  Brain,
  Menu,
  X,
} from 'lucide-react';
import { USE_DEMO_MODE } from '../../lib/api';

const NAV_ITEMS = [
  { to: '/analyze', icon: BarChart3, label: 'تحليل القرار' },
  { to: '/verify', icon: ShieldCheck, label: 'كشف التضليل' },
  { to: '/journal', icon: Brain, label: 'الرؤية السلوكية' },
];

const DISCLAIMER =
  'هذه المنصة تقدم تحليلاً تعليمياً وتقييماً لجودة القرار المالي. لا تشكل نصيحة مالية أو توصية بالشراء أو البيع. جميع قرارات التداول يتخذها المستخدم بنفسه وعلى مسؤوليته الخاصة.';

export default function Layout({ children }: { children: ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen" dir="rtl">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden transition-opacity"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar — on the right in RTL */}
      <aside
        className={`w-64 bg-void text-cream flex flex-col shrink-0 fixed lg:static inset-y-0 right-0 z-50 transform transition-transform duration-300 ease-in-out lg:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : 'translate-x-full lg:translate-x-0'
        }`}
      >
        {/* Logo */}
        <div className="px-6 py-6 border-b border-white/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <svg width="28" height="28" viewBox="0 0 48 48" fill="none" className="opacity-60">
                <path d="M24 6L14 22L8 38H18L24 28L30 38H40L34 22L24 6Z" stroke="#c9a84c" strokeWidth="1.5" fill="none" />
                <circle cx="19" cy="20" r="2" fill="#c9a84c" opacity="0.6" />
                <circle cx="29" cy="20" r="2" fill="#c9a84c" opacity="0.6" />
              </svg>
              <h1
                className="text-xl font-bold tracking-wide text-gold"
                style={{ fontFamily: '"Tajawal", sans-serif' }}
              >
                DHEEB MINDSET
              </h1>
            </div>
            {/* Close button for mobile */}
            <button
              className="lg:hidden p-1 rounded hover:bg-white/10"
              onClick={() => setSidebarOpen(false)}
            >
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2 mt-1">
            <p className="text-xs text-cream/40">ذكاء القرار المالي</p>
            {USE_DEMO_MODE && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gold/20 text-gold border border-gold/30">
                عرض تجريبي
              </span>
            )}
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              onClick={() => setSidebarOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors duration-200 ${
                  isActive
                    ? 'bg-gold/20 text-gold'
                    : 'text-cream/70 hover:bg-white/10 hover:text-cream'
                }`
              }
            >
              <Icon size={18} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>

        {/* Disclaimer */}
        <div className="px-4 py-3 border-t border-white/10">
          <p className="text-[9px] leading-relaxed text-cream/25 text-justify">
            {DISCLAIMER}
          </p>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 overflow-auto bg-void-lighter">
        {/* Mobile header */}
        <div className="lg:hidden flex items-center justify-between px-4 py-3 bg-void-light border-b border-white/5">
          <div className="flex items-center gap-2">
            <svg width="24" height="24" viewBox="0 0 48 48" fill="none" className="opacity-60">
              <path d="M24 6L14 22L8 38H18L24 28L30 38H40L34 22L24 6Z" stroke="#c9a84c" strokeWidth="1.5" fill="none" />
            </svg>
            <h1 className="text-lg font-bold text-gold">DHEEB MINDSET</h1>
            {USE_DEMO_MODE && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium bg-gold/20 text-gold border border-gold/30">
                عرض تجريبي
              </span>
            )}
          </div>
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 rounded-lg hover:bg-white/10 text-cream"
          >
            <Menu size={22} />
          </button>
        </div>
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-8 page-enter">
          {children}
        </div>
      </main>
    </div>
  );
}