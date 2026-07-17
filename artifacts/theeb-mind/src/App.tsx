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
      </Routes>
    </>
  );
}
