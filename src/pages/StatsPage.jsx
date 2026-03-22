import { useState, useMemo, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PLAYERS, TEAM_BRANDING, TEAM_LOGOS, getMatchPoints } from '../lib/constants';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { supabase } from '../lib/supabase';

const PLAYER_COLORS = {
  Arun:   { bg: 'rgba(27,42,107,0.08)',  text: '#1B2A6B' },
  Sai:    { bg: 'rgba(96,165,250,0.1)',   text: '#3B82F6' },
  Abhi:   { bg: 'rgba(22,163,74,0.08)',   text: '#16A34A' },
  Dinesh: { bg: 'rgba(136,144,166,0.1)',   text: '#4A5068' },
};

export default function StatsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userName = searchParams.get('user');
  const isValidUser = userName && PLAYERS.includes(userName);

  if (!isValidUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pb-[72px]">
        <div className="text-center">
          <p className="text-lg font-bold mb-2" style={{ color: '#1B2A6B' }}>Stats</p>
          <p className="text-sm mb-4" style={{ color: '#4A5068' }}>Pick your name to view stats</p>
          <div className="flex flex-col gap-2">
            {PLAYERS.map((name) => (
              <button key={name} onClick={() => setSearchParams({ user: name })}
                className="px-6 py-2 rounded-lg font-bold text-sm"
                style={{ backgroundColor: '#EEF3FF', color: '#1B2A6B', border: '1px solid #D5DDF5' }}>
                {name}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }
  return <StatsView userName={userName} />;
}

function StatsView({ userName }) {
  const { leaderboard, completedCount, loading } = useLeaderboard();
  const [allPredictions, setAllPredictions] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [dataLoading, setDataLoading] = useState(true);
  const [compareWith, setCompareWith] = useState(null);

  useEffect(() => {
    async function fetch() {
      const [predsRes, matchesRes] = await Promise.all([
        supabase.from('predictions').select('*'),
        supabase.from('matches').select('*').order('match_number'),
      ]);
      if (predsRes.data) setAllPredictions(predsRes.data);
      if (matchesRes.data) setAllMatches(matchesRes.data);
      setDataLoading(false);
    }
    fetch();
  }, []);

  const userEntry = leaderboard.find((e) => e.name === userName);
  const completedMatches = useMemo(() => allMatches.filter((m) => m.status === 'completed' && m.winner).sort((a, b) => a.match_number - b.match_number), [allMatches]);
  const userPredictions = useMemo(() => allPredictions.filter((p) => p.user_name === userName), [allPredictions, userName]);
  const predsByMatch = useMemo(() => { const m = {}; userPredictions.forEach((p) => { m[p.match_number] = p; }); return m; }, [userPredictions]);
  const pointsAvailable = useMemo(() => completedMatches.reduce((sum, m) => sum + getMatchPoints(m.stage), 0), [completedMatches]);

  const teamAccuracy = useMemo(() => {
    const teams = {};
    for (const match of completedMatches) { const pred = predsByMatch[match.match_number]; if (!pred) continue; const team = pred.predicted_team; if (!teams[team]) teams[team] = { correct: 0, total: 0 }; teams[team].total++; if (pred.predicted_team === match.winner) teams[team].correct++; }
    return Object.entries(teams).map(([team, data]) => ({ team, ...data, accuracy: Math.round((data.correct / data.total) * 100) })).sort((a, b) => b.accuracy - a.accuracy);
  }, [completedMatches, predsByMatch]);

  const recentForm = useMemo(() => {
    const items = [];
    for (let i = completedMatches.length - 1; i >= 0 && items.length < 20; i--) { const match = completedMatches[i]; const pred = predsByMatch[match.match_number]; if (!pred) continue; items.push({ matchNumber: match.match_number, team: pred.predicted_team, correct: pred.predicted_team === match.winner }); }
    return items;
  }, [completedMatches, predsByMatch]);

  const teamLoyalty = useMemo(() => {
    const counts = {}; userPredictions.forEach((p) => { counts[p.predicted_team] = (counts[p.predicted_team] || 0) + 1; });
    const total = userPredictions.length || 1;
    return Object.entries(counts).map(([team, count]) => ({ team, count, pct: Math.round((count / total) * 100) })).sort((a, b) => b.count - a.count);
  }, [userPredictions]);

  const h2hData = useMemo(() => {
    if (!compareWith) return null;
    const otherEntry = leaderboard.find((e) => e.name === compareWith);
    if (!otherEntry) return null;
    const otherPreds = allPredictions.filter((p) => p.user_name === compareWith);
    const otherByMatch = {}; otherPreds.forEach((p) => { otherByMatch[p.match_number] = p; });
    const disagreements = [];
    for (const match of completedMatches) { const myPred = predsByMatch[match.match_number]; const theirPred = otherByMatch[match.match_number]; if (myPred && theirPred && myPred.predicted_team !== theirPred.predicted_team) { disagreements.push({ matchNumber: match.match_number, myPick: myPred.predicted_team, myCorrect: myPred.predicted_team === match.winner, theirPick: theirPred.predicted_team, theirCorrect: theirPred.predicted_team === match.winner }); } }
    return { other: otherEntry, disagreements: disagreements.slice(-5).reverse() };
  }, [compareWith, leaderboard, allPredictions, completedMatches, predsByMatch]);

  const boldCalls = useMemo(() => {
    const calls = [];
    for (const match of completedMatches) { const myPred = predsByMatch[match.match_number]; if (!myPred) continue; const otherPreds = allPredictions.filter((p) => p.match_number === match.match_number && p.user_name !== userName); const othersSameTeam = otherPreds.filter((p) => p.predicted_team === myPred.predicted_team).length; const othersTotal = otherPreds.length; if (othersTotal >= 2 && othersSameTeam === 0) { const majorityTeam = myPred.predicted_team === match.team1 ? match.team2 : match.team1; calls.push({ matchNumber: match.match_number, myPick: myPred.predicted_team, majorityPick: majorityTeam, correct: myPred.predicted_team === match.winner, othersCount: othersTotal }); } }
    return calls.reverse();
  }, [completedMatches, predsByMatch, allPredictions, userName]);

  if (loading || dataLoading) return <div className="pb-[72px] px-4 pt-6">{[1, 2, 3].map((i) => <div key={i} className="h-28 rounded-xl mb-3 animate-pulse" style={{ backgroundColor: '#E8EAF0' }} />)}</div>;

  if (!userEntry || userPredictions.length === 0) return (
    <div className="min-h-screen flex items-center justify-center p-4 pb-[72px]">
      <div className="text-center">
        <p className="text-3xl mb-3">📊</p>
        <p className="text-base font-bold mb-1" style={{ color: '#1A1A2E' }}>No stats yet</p>
        <p className="text-sm" style={{ color: '#8890A6' }}>Play some matches first! Stats will appear after your first prediction.</p>
      </div>
    </div>
  );

  const ordinal = (n) => { const s = ['th', 'st', 'nd', 'rd']; const v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); };

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pb-[72px]">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-extrabold" style={{ color: '#1A1A2E' }}>Stats</h1>
        <p className="text-[10px] font-bold uppercase" style={{ color: '#1B2A6B', letterSpacing: '2px' }}>{userName}'s Dashboard</p>
      </div>

      {/* Season overview */}
      <div className="mx-4 mb-4 p-5 rounded-[14px]" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' }}>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <span className="font-mono-num font-bold block" style={{ fontSize: 32, color: '#1B2A6B', lineHeight: 1 }}>{userEntry.points}</span>
            <span className="text-[11px] mt-1 block" style={{ color: '#8890A6' }}>out of {pointsAvailable} possible</span>
          </div>
          <div className="flex flex-col items-center">
            <AccuracyRing percentage={userEntry.accuracy} size={64} />
            <span className="text-[11px] mt-1" style={{ color: '#8890A6' }}>{userEntry.correct} / {userEntry.completedPredicted} correct</span>
          </div>
          <div>
            <span className="font-mono-num font-bold block" style={{ fontSize: 24, color: '#E8458B', lineHeight: 1 }}>{userEntry.currentStreak}</span>
            <span className="text-[11px] mt-1 block" style={{ color: '#8890A6' }}>current streak</span>
            <span className="text-[10px] block" style={{ color: '#4A5068' }}>Best: {userEntry.bestStreak}</span>
          </div>
          <div>
            <span className="font-mono-num font-bold block" style={{ fontSize: 24, color: '#3B82F6', lineHeight: 1 }}>{ordinal(userEntry.rank)}</span>
            <span className="text-[11px] mt-1 block" style={{ color: '#8890A6' }}>of {PLAYERS.length} players</span>
            <span className="text-[10px] font-extrabold block" style={{ fontSize: 9 }}>
              {userEntry.trend > 0 && <span style={{ color: '#16A34A' }}>▲ {userEntry.trend}</span>}
              {userEntry.trend < 0 && <span style={{ color: '#E24B4A' }}>▼ {Math.abs(userEntry.trend)}</span>}
              {userEntry.trend === 0 && <span style={{ color: '#8890A6' }}>—</span>}
            </span>
          </div>
        </div>
      </div>

      {/* Accuracy by team */}
      {teamAccuracy.length > 0 && (
        <div className="px-4 mb-4">
          <SectionTitle>Prediction accuracy by team</SectionTitle>
          <div className="space-y-2">
            {teamAccuracy.map(({ team, correct, total, accuracy }) => {
              const branding = TEAM_BRANDING[team];
              return (
                <div key={team} className="flex items-center gap-2">
                  <div className="shrink-0 rounded-full flex items-center justify-center" style={{ width: 24, height: 24, backgroundColor: `${branding?.primary}18` }}>
                    <img src={TEAM_LOGOS[team]} alt={team} className="w-4 h-4 object-contain" loading="lazy" onError={(e) => { e.target.style.display = 'none'; }} />
                  </div>
                  <span className="shrink-0 w-10 text-[11px] font-bold" style={{ color: branding?.primary }}>{team}</span>
                  <div className="flex-1 h-6 rounded-md overflow-hidden" style={{ backgroundColor: '#F0F1F5' }}>
                    <motion.div className="h-full rounded-md flex items-center pl-2" style={{ backgroundColor: branding?.primary, minWidth: accuracy > 0 ? 20 : 0 }}
                      initial={{ width: 0 }} animate={{ width: `${accuracy}%` }} transition={{ duration: 0.6, delay: 0.1 }}>
                      {accuracy >= 30 && <span className="text-[10px] font-bold text-white">{accuracy}%</span>}
                    </motion.div>
                  </div>
                  <span className="shrink-0 font-mono-num text-[11px]" style={{ color: '#4A5068' }}>{correct}/{total}</span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent form */}
      {recentForm.length > 0 && (
        <div className="px-4 mb-4">
          <SectionTitle>Recent form</SectionTitle>
          <div className="overflow-x-auto pb-2 hide-scrollbar">
            <div className="flex gap-3" style={{ minWidth: 'max-content' }}>
              {recentForm.map((item) => (
                <div key={item.matchNumber} className="flex flex-col items-center gap-1">
                  <div className="rounded-full" style={{ width: 10, height: 10, backgroundColor: item.correct ? '#16A34A' : '#E24B4A' }} />
                  <span className="text-[7px] font-bold" style={{ color: TEAM_BRANDING[item.team]?.primary || '#4A5068' }}>{item.team}</span>
                  <span className="font-mono-num text-[7px]" style={{ color: '#8890A6' }}>#{item.matchNumber}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Team loyalty */}
      {teamLoyalty.length > 0 && (
        <div className="px-4 mb-4">
          <SectionTitle>Favorite teams to predict</SectionTitle>
          <div className="flex rounded-lg overflow-hidden" style={{ height: 32 }}>
            {teamLoyalty.slice(0, 5).map(({ team, pct }) => (
              <div key={team} className="flex items-center justify-center" style={{ width: `${pct}%`, backgroundColor: TEAM_BRANDING[team]?.primary || '#333', minWidth: pct > 0 ? 24 : 0 }}>
                {pct >= 15 && <span className="text-[9px] font-bold text-white">{team}</span>}
              </div>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mt-2">
            {teamLoyalty.slice(0, 3).map(({ team, pct }) => (
              <div key={team} className="flex items-center gap-1.5">
                <div className="rounded-full" style={{ width: 8, height: 8, backgroundColor: TEAM_BRANDING[team]?.primary }} />
                <span className="text-[11px]" style={{ color: '#4A5068' }}>{team} {pct}%</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Head-to-head */}
      <div className="px-4 mb-4">
        <SectionTitle>Head to head</SectionTitle>
        <div className="flex gap-2 mb-3">
          {PLAYERS.filter((p) => p !== userName).map((player) => (
            <button key={player} onClick={() => setCompareWith(compareWith === player ? null : player)}
              className="px-3 py-1.5 rounded-lg text-[11px] font-bold"
              style={{ backgroundColor: compareWith === player ? '#EEF3FF' : '#FFFFFF', border: compareWith === player ? '1px solid #D5DDF5' : '1px solid #E8EAF0', color: compareWith === player ? '#1B2A6B' : '#8890A6' }}>
              {player}
            </button>
          ))}
        </div>
        {h2hData && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="rounded-xl p-4" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
            <div className="grid grid-cols-3 gap-2 text-center mb-3">
              <div><Avatar name={userName} size={36} /><p className="text-[11px] font-bold mt-1" style={{ color: '#1A1A2E' }}>{userName}</p></div>
              <div className="flex items-center justify-center"><span className="text-[10px] font-bold" style={{ color: '#E8458B' }}>VS</span></div>
              <div><Avatar name={compareWith} size={36} /><p className="text-[11px] font-bold mt-1" style={{ color: '#1A1A2E' }}>{compareWith}</p></div>
            </div>
            {[{ label: 'Points', my: userEntry.points, their: h2hData.other.points }, { label: 'Accuracy', my: `${userEntry.accuracy}%`, their: `${h2hData.other.accuracy}%`, myNum: userEntry.accuracy, theirNum: h2hData.other.accuracy }, { label: 'Streak', my: userEntry.currentStreak, their: h2hData.other.currentStreak }].map(({ label, my, their, myNum, theirNum }) => {
              const myVal = myNum ?? my; const theirVal = theirNum ?? their;
              return (
                <div key={label} className="grid grid-cols-3 gap-2 text-center py-1.5" style={{ borderTop: '1px solid #F0F1F5' }}>
                  <span className="font-mono-num text-sm font-bold" style={{ color: myVal >= theirVal ? '#1B2A6B' : '#8890A6' }}>{my}</span>
                  <span className="text-[10px] font-semibold" style={{ color: '#8890A6' }}>{label}</span>
                  <span className="font-mono-num text-sm font-bold" style={{ color: theirVal >= myVal ? '#1B2A6B' : '#8890A6' }}>{their}</span>
                </div>
              );
            })}
            {h2hData.disagreements.length > 0 && (
              <div className="mt-3 pt-2" style={{ borderTop: '1px solid #F0F1F5' }}>
                <p className="text-[10px] font-bold uppercase mb-2" style={{ color: '#8890A6', letterSpacing: '1px' }}>Disagreements</p>
                {h2hData.disagreements.map((d) => (
                  <div key={d.matchNumber} className="flex items-center justify-between text-[10px] py-1">
                    <span className="font-mono-num" style={{ color: '#4A5068' }}>#{d.matchNumber}</span>
                    <span style={{ color: d.myCorrect ? '#16A34A' : '#E24B4A' }}>You → {d.myPick} {d.myCorrect ? '✓' : '✗'}</span>
                    <span style={{ color: d.theirCorrect ? '#16A34A' : '#E24B4A' }}>{compareWith} → {d.theirPick} {d.theirCorrect ? '✓' : '✗'}</span>
                  </div>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </div>

      {/* Bold calls */}
      <div className="px-4 mb-6">
        <SectionTitle>Bold calls</SectionTitle>
        {boldCalls.length === 0 ? <p className="text-[12px]" style={{ color: '#8890A6' }}>No bold calls yet — go against the crowd!</p> : (
          <div className="space-y-2">
            {boldCalls.map((call) => (
              <div key={call.matchNumber} className="rounded-xl px-3 py-2.5" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
                <div className="flex items-center justify-between">
                  <span className="text-[11px]" style={{ color: '#4A5068' }}>
                    Match #{call.matchNumber}: You picked <span style={{ color: TEAM_BRANDING[call.myPick]?.primary, fontWeight: 700 }}>{call.myPick}</span>
                    {' '}when {call.othersCount} others picked <span style={{ color: TEAM_BRANDING[call.majorityPick]?.primary, fontWeight: 700 }}>{call.majorityPick}</span>
                  </span>
                  {call.correct && <span className="text-[9px] font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E8F8EE', color: '#16A34A' }}>Bold & correct!</span>}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}

function AccuracyRing({ percentage, size = 64 }) {
  const strokeWidth = 5; const radius = (size - strokeWidth) / 2; const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;
  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#E8EAF0" strokeWidth={strokeWidth} />
        <motion.circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#16A34A" strokeWidth={strokeWidth}
          strokeLinecap="round" strokeDasharray={circumference} initial={{ strokeDashoffset: circumference }} animate={{ strokeDashoffset: offset }} transition={{ duration: 1, ease: 'easeOut' }} />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-mono-num font-bold" style={{ fontSize: 18, color: '#16A34A' }}>{percentage}%</span>
    </div>
  );
}

function SectionTitle({ children }) { return <h2 className="text-[14px] font-bold mb-3" style={{ color: '#1A1A2E' }}>{children}</h2>; }

function Avatar({ name, size = 36 }) {
  const colors = PLAYER_COLORS[name] || { bg: 'rgba(136,144,166,0.1)', text: '#4A5068' };
  return <div className="rounded-full flex items-center justify-center font-bold mx-auto" style={{ width: size, height: size, backgroundColor: colors.bg, color: colors.text, fontSize: size * 0.4 }}>{name?.[0]}</div>;
}
