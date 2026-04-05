import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { PLAYERS } from '../lib/constants';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { getDateKey, formatDateGroup, isMatchLocked, buildUrl } from '../lib/utils';
import { useToast } from '../components/Toast';
import { getClaimedIdentity, hasClaimedIdentity, claimIdentity, isOwnProfile, clearIdentity } from '../lib/identity';
import Header from '../components/Header';
import MatchTicker from '../components/MatchTicker';
import MatchCard from '../components/MatchCard';

const TABS = ['Upcoming', 'All', 'Completed'];
const OPENING_DAY = '2026-03-28';

export default function MatchesPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get('user');
  const resetRequested = searchParams.get('reset') === 'true';
  const isValidUser = userName && PLAYERS.includes(userName);

  // Handle ?reset=true — clear identity and show player selection
  useEffect(() => {
    if (resetRequested) {
      clearIdentity();
      setSearchParams({}, { replace: true });
    }
  }, [resetRequested, setSearchParams]);

  // Auto-redirect if identity is claimed but no ?user param
  useEffect(() => {
    if (!resetRequested && !isValidUser && hasClaimedIdentity()) {
      const claimed = getClaimedIdentity();
      if (PLAYERS.includes(claimed)) {
        setSearchParams({ user: claimed });
      }
    }
  }, [isValidUser, resetRequested, setSearchParams]);

  if (!isValidUser) {
    return <PlayerSelect onSelect={(name) => {
      claimIdentity(name);
      setSearchParams({ user: name });
    }} />;
  }

  return <MatchesView userName={userName} />;
}

function PlayerSelect({ onSelect }) {
  const claimed = getClaimedIdentity();
  const hasClaimed = hasClaimedIdentity() && PLAYERS.includes(claimed);
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ backgroundColor: '#F5F6FA' }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-sm rounded-2xl p-6 text-center"
        style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0', boxShadow: '0 4px 12px rgba(0,0,0,0.06)' }}
      >
        <div className="flex items-center justify-center gap-2.5 mb-1">
          <img src="https://www.iplt20.com/assets/images/IPL_LOGO_CORPORATE_2024.png" alt="IPL" className="w-10 h-auto object-contain" />
          <h2 className="text-2xl font-black" style={{ color: '#1A1A2E' }}>
            IPL <span style={{ color: '#1B2A6B' }}>PREDICT</span>
          </h2>
        </div>

        {hasClaimed ? (
          <>
            <p className="text-sm mb-1" style={{ color: '#1B2A6B' }}>You are <strong>{claimed}</strong></p>
            <p className="text-xs mb-5" style={{ color: '#8890A6' }}>View other players' predictions (read-only)</p>
          </>
        ) : (
          <>
            <p className="text-sm mb-1" style={{ color: '#4A5068' }}>Who are you?</p>
            <p className="text-[10px] mb-5" style={{ color: '#8890A6' }}>Choose carefully — this locks your identity to this device</p>
          </>
        )}

        <div className="flex flex-col gap-3">
          {PLAYERS.map((name, i) => {
            const isMe = hasClaimed && name === claimed;
            return (
              <motion.button
                key={name}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.06 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  if (hasClaimed) {
                    navigate(buildUrl('/', name));
                  } else {
                    onSelect(name);
                  }
                }}
                className="w-full py-3.5 rounded-xl text-base font-bold transition-colors"
                style={{
                  backgroundColor: isMe ? '#1B2A6B' : '#EEF3FF',
                  color: isMe ? '#FFFFFF' : '#1B2A6B',
                  border: isMe ? '1px solid #1B2A6B' : '1px solid #D5DDF5',
                }}
              >
                {isMe ? `${name} (You)` : hasClaimed ? `View ${name}'s predictions` : name}
              </motion.button>
            );
          })}
        </div>

        {hasClaimed && (
          <p className="text-[11px] mt-4" style={{ color: '#8890A6' }}>
            Locked as {claimed}. Not you?{' '}
            <button
              onClick={() => {
                if (window.confirm('Reset your identity? You\'ll need to pick your name again.')) {
                  clearIdentity();
                  window.location.replace('/');
                }
              }}
              className="underline"
              style={{ color: '#8890A6', minHeight: 'auto' }}
            >
              Reset
            </button>
          </p>
        )}
      </motion.div>
    </div>
  );
}

function MatchesView({ userName }) {
  const { matches, loading: matchesLoading, error: matchesError } = useMatches();
  const { predictions, savePrediction, loading: predsLoading, error: predsError } = usePredictions(userName);
  const { leaderboard, loading: lbLoading } = useLeaderboard();
  const cardRefs = useRef({});
  const prevMatchesRef = useRef(null);
  const showToast = useToast();
  const navigate = useNavigate();

  const readOnly = !isOwnProfile(userName);
  const claimedName = getClaimedIdentity();

  const hasUpcoming = matches.some((m) => m.status === 'upcoming' && !isMatchLocked(m.match_date));
  const [activeTab, setActiveTab] = useState(hasUpcoming ? 'Upcoming' : 'All');

  // Real-time celebration (only for own profile)
  useEffect(() => {
    if (readOnly || !prevMatchesRef.current || !showToast) {
      prevMatchesRef.current = matches;
      return;
    }
    for (const match of matches) {
      const prev = prevMatchesRef.current.find((m) => m.match_number === match.match_number);
      if (prev && prev.status !== 'completed' && match.status === 'completed' && match.winner) {
        const pred = predictions[match.match_number];
        if (pred?.predicted_team === match.winner) {
          showToast(`You got Match #${match.match_number} right! +1 point`, 'success');
        } else if (pred?.predicted_team) {
          showToast(`Match #${match.match_number}: ${match.winner} won. Better luck next time!`, 'error');
        }
      }
    }
    prevMatchesRef.current = matches;
  }, [matches, predictions, showToast, readOnly]);

  const userStats = useMemo(() => {
    const entry = leaderboard.find((e) => e.name === userName);
    return entry || { points: 0, accuracy: 0, currentStreak: 0, rank: '-' };
  }, [leaderboard, userName]);

  const todayKey = getDateKey(new Date().toISOString());

  const filteredMatches = useMemo(() => {
    switch (activeTab) {
      case 'Upcoming': return matches.filter((m) => m.status === 'upcoming' && !isMatchLocked(m.match_date));
      case 'Completed': return matches.filter((m) => m.status === 'completed' || (m.status === 'upcoming' && isMatchLocked(m.match_date)));
      default: {
        // Sort: live first, then today's matches, then upcoming (asc), then completed (desc)
        return [...matches].sort((a, b) => {
          const aKey = getDateKey(a.match_date);
          const bKey = getDateKey(b.match_date);
          const aIsLive = a.status === 'live';
          const bIsLive = b.status === 'live';
          const aIsToday = aKey === todayKey;
          const bIsToday = bKey === todayKey;
          const aIsUpcoming = a.status === 'upcoming' && !aIsToday;
          const bIsUpcoming = b.status === 'upcoming' && !bIsToday;

          const rank = (m, isLive, isToday, isUpcoming) => {
            if (isLive) return 0;
            if (isToday) return 1;
            if (isUpcoming) return 2;
            return 3; // completed
          };

          const aRank = rank(a, aIsLive, aIsToday, aIsUpcoming);
          const bRank = rank(b, bIsLive, bIsToday, bIsUpcoming);
          if (aRank !== bRank) return aRank - bRank;

          // Within completed, show most recent first
          if (aRank === 3) return bKey.localeCompare(aKey);
          // Otherwise ascending by date
          return aKey.localeCompare(bKey);
        });
      }
    }
  }, [matches, activeTab, todayKey]);

  const groupedMatches = useMemo(() => {
    const groups = {};
    filteredMatches.forEach((m) => {
      const key = getDateKey(m.match_date);
      if (!groups[key]) groups[key] = { label: formatDateGroup(m.match_date), dateKey: key, matches: [] };
      groups[key].matches.push(m);
    });
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [filteredMatches]);

  // Auto-scroll to today's/nearest upcoming match on first load
  const hasAutoScrolled = useRef(false);
  useEffect(() => {
    if (hasAutoScrolled.current || matches.length === 0) return;
    hasAutoScrolled.current = true;

    // Find first live match, or today's match, or nearest upcoming match
    const target =
      matches.find((m) => m.status === 'live') ||
      matches.find((m) => getDateKey(m.match_date) === todayKey) ||
      matches.find((m) => m.status === 'upcoming' && !isMatchLocked(m.match_date));

    if (target) {
      setTimeout(() => {
        const el = cardRefs.current[target.match_number];
        if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 300);
    }
  }, [matches, todayKey]);

  const handleTickerNavigate = useCallback((matchNumber) => {
    setActiveTab('All');
    setTimeout(() => {
      const el = cardRefs.current[matchNumber];
      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }, 100);
  }, []);

  const loading = matchesLoading || predsLoading || lbLoading;
  const error = matchesError || predsError;

  return (
    <div className="pb-[72px]">
      <Header userName={userName} stats={userStats} readOnly={readOnly} />

      {/* Read-only banner */}
      {readOnly && claimedName && (
        <div className="px-4 py-2" style={{ backgroundColor: '#EEF3FF', borderBottom: '1px solid #D5DDF5' }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold" style={{ color: '#1B2A6B' }}>
              Viewing {userName}'s predictions (read-only)
            </span>
            <button
              onClick={() => navigate(buildUrl('/', claimedName))}
              className="text-xs font-bold"
              style={{ color: '#E8458B', minHeight: 'auto' }}
            >
              Switch to your profile →
            </button>
          </div>
          <button
            onClick={() => {
              if (window.confirm('Reset your identity? You\'ll need to pick your name again.')) {
                clearIdentity();
                navigate('/');
              }
            }}
            className="text-[10px] mt-0.5"
            style={{ color: '#8890A6', minHeight: 'auto' }}
          >
            Not {claimedName}? Reset identity
          </button>
        </div>
      )}

      {/* Sticky zone: tabs + ticker (stays dark) */}
      <div className="sticky top-0 z-40" style={{ backgroundColor: '#0E1842' }}>
        <div className="flex px-4 pt-3 pb-0" style={{ borderBottom: '1px solid rgba(200, 230, 41, 0.08)' }}>
          {TABS.map((tab) => {
            const isActive = activeTab === tab;
            return (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className="flex-1 pb-2.5 text-xs relative transition-colors"
                style={{ fontWeight: isActive ? 700 : 600, color: isActive ? '#C8E629' : '#6B7EB0' }}>
                {tab}
                {isActive && <motion.div layoutId="tab-underline" className="absolute bottom-0 left-1/2 -translate-x-1/2" style={{ width: '60%', height: 2.5, backgroundColor: '#C8E629', borderRadius: 2 }} />}
              </button>
            );
          })}
        </div>
        {!loading && <MatchTicker matches={matches} onNavigate={handleTickerNavigate} />}
      </div>

      {loading && (
        <div className="px-4 pt-4 space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="rounded-[14px] h-[160px] animate-pulse" style={{ backgroundColor: '#E8EAF0' }} />)}
        </div>
      )}

      {error && (
        <div className="mx-4 mt-4 p-3 rounded-lg text-center" style={{ backgroundColor: '#FEE7E7' }}>
          <p className="text-sm" style={{ color: '#E24B4A' }}>Couldn't load data</p>
          <button onClick={() => window.location.reload()} className="text-xs mt-1 underline" style={{ color: '#4A5068' }}>Retry</button>
        </div>
      )}

      {!loading && !error && (
        <AnimatePresence mode="wait">
          <motion.div key={activeTab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="px-4 pt-2 space-y-4">
            {groupedMatches.length === 0 && <p className="text-center py-12 text-sm" style={{ color: '#8890A6' }}>No matches to show</p>}

            {groupedMatches.map(([dateKey, group]) => (
              <div key={dateKey}>
                <h3 className="font-bold uppercase mb-2.5 mt-4 px-1" style={{ color: '#8890A6', fontSize: 11, fontWeight: 700, letterSpacing: '1.5px' }}>
                  {group.label.toUpperCase()}
                  {dateKey === OPENING_DAY && <span style={{ color: '#1B2A6B' }}> · OPENING DAY</span>}
                </h3>
                <motion.div className="space-y-3" initial="hidden" animate="visible"
                  variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}>
                  {group.matches.map((match) => (
                    <motion.div key={match.match_number} ref={(el) => { cardRefs.current[match.match_number] = el; }}
                      variants={{ hidden: { opacity: 0, y: 12 }, visible: { opacity: 1, y: 0, transition: { duration: 0.25 } } }}>
                      <MatchCard match={match} prediction={predictions[match.match_number]} onPredict={savePrediction} readOnly={readOnly} />
                    </motion.div>
                  ))}
                </motion.div>
              </div>
            ))}
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  );
}
