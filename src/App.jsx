import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import BottomNav from './components/BottomNav';
import MatchesPage from './pages/MatchesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MatchDetailPage from './pages/MatchDetailPage';
import AdminPage from './pages/AdminPage';
import MorePage from './pages/MorePage';

// Lazy load StatsPage (heaviest page)
const StatsPage = lazy(() => import('./pages/StatsPage'));

function LoadingFallback() {
  return (
    <div className="pb-[72px] px-4 pt-6">
      {[1, 2, 3].map((i) => (
        <div key={i} className="h-28 rounded-xl mb-3 animate-pulse" style={{ backgroundColor: '#142055' }} />
      ))}
    </div>
  );
}

function AnimatedRoutes() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/admin');

  return (
    <>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<MatchesPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/match/:matchNumber" element={<MatchDetailPage />} />
          <Route path="/admin" element={<AdminPage />} />
          <Route path="/more" element={<MorePage />} />
          <Route
            path="/stats"
            element={
              <Suspense fallback={<LoadingFallback />}>
                <StatsPage />
              </Suspense>
            }
          />
        </Routes>
      </AnimatePresence>
      {!hideNav && <BottomNav />}
    </>
  );
}

export default function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <ToastProvider>
          <AnimatedRoutes />
        </ToastProvider>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
