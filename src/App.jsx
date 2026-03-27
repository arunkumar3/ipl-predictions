import { lazy, Suspense, useEffect, useRef } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { ToastProvider, useToast } from './components/Toast';
import ErrorBoundary from './components/ErrorBoundary';
import { supabase } from './lib/supabase';
import BottomNav from './components/BottomNav';
import MatchesPage from './pages/MatchesPage';
import LeaderboardPage from './pages/LeaderboardPage';
import MatchDetailPage from './pages/MatchDetailPage';
import AdminPage from './pages/AdminPage';
import MorePage from './pages/MorePage';
import MemesPage from './pages/MemesPage';

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

function MemeNotifier() {
  const showToast = useToast();
  const location = useLocation();
  const seenRef = useRef(new Set());

  useEffect(() => {
    const channel = supabase
      .channel('meme-notifications')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'memes' }, (payload) => {
        const matchNum = payload.new.match_number;
        // Only notify once per match per session, skip if already on memes page
        if (seenRef.current.has(matchNum) || location.pathname === '/memes') return;
        seenRef.current.add(matchNum);
        showToast(`\uD83D\uDD25 New memes for Match #${matchNum} are live!`, 'info');
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [showToast, location.pathname]);

  return null;
}

function AnimatedRoutes() {
  const location = useLocation();
  const hideNav = location.pathname.startsWith('/admin');

  return (
    <>
      <MemeNotifier />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route path="/" element={<MatchesPage />} />
          <Route path="/leaderboard" element={<LeaderboardPage />} />
          <Route path="/match/:matchNumber" element={<MatchDetailPage />} />
          <Route path="/memes" element={<MemesPage />} />
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
