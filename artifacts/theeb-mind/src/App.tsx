import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useEffect } from 'react';
import Layout from './components/shared/Layout';
import AnalyzeChart from './pages/AnalyzeChart';
import VerifyContent from './pages/VerifyContent';
import Journal from './pages/Journal';
import Landing from './pages/Landing';
import Performance from './pages/Performance';
import TradeIntelligence from './pages/TradeIntelligence';
import MarketIntelligence from './pages/MarketIntelligence';
import AuthGate from './components/ledger/AuthGate';
import LedgerHome from './pages/ledger/LedgerHome';
import ImportCenter from './pages/ledger/ImportCenter';
import ImportBatch from './pages/ledger/ImportBatch';
import Trades from './pages/ledger/Trades';
import TradeDetail from './pages/ledger/TradeDetail';
import TrilReview from './pages/ledger/TrilReview';
import Sessions from './pages/ledger/Sessions';
import Analytics from './pages/ledger/Analytics';
import Behavior from './pages/ledger/Behavior';
import Accounts from './pages/ledger/Accounts';
import Rules from './pages/ledger/Rules';

// Scroll to top on route change
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [pathname]);
  return null;
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <AuthGate>
      <Routes>
        {/* Root → Landing page */}
        <Route path="/" element={<Landing />} />

        {/* App stations — inside Command Center layout */}
        <Route path="/analyze"      element={<Layout><AnalyzeChart /></Layout>} />
        <Route path="/verify"       element={<Layout><VerifyContent /></Layout>} />
        <Route path="/journal"      element={<Layout><Journal /></Layout>} />
        <Route path="/performance"  element={<Layout><Performance /></Layout>} />
        <Route path="/intelligence" element={<Layout><TradeIntelligence /></Layout>} />
        <Route path="/market"       element={<Layout><MarketIntelligence /></Layout>} />

        {/* Journal / ledger */}
        <Route path="/ledger"                element={<Layout><LedgerHome /></Layout>} />
        <Route path="/ledger/import"         element={<Layout><ImportCenter /></Layout>} />
        <Route path="/ledger/imports/:id"    element={<Layout><ImportBatch /></Layout>} />
        <Route path="/ledger/trades"         element={<Layout><Trades /></Layout>} />
        <Route path="/ledger/trades/:id"     element={<Layout><TradeDetail /></Layout>} />
        <Route path="/ledger/review"         element={<Layout><TrilReview /></Layout>} />
        <Route path="/ledger/sessions"       element={<Layout><Sessions /></Layout>} />
        <Route path="/ledger/analytics"      element={<Layout><Analytics /></Layout>} />
        <Route path="/ledger/behavior"       element={<Layout><Behavior /></Layout>} />
        <Route path="/ledger/accounts"       element={<Layout><Accounts /></Layout>} />
        <Route path="/ledger/rules"          element={<Layout><Rules /></Layout>} />
        <Route path="*" element={<Navigate to="/ledger" replace />} />
      </Routes>
      </AuthGate>
    </>
  );
}
