import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PLAYERS, FULL_SEASON_MAX_POINTS } from '../lib/constants';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { buildUrl } from '../lib/utils';

const PLAYER_COLORS = {
  Arun:  { bg: 'rgba(27,42,107,0.08)',  text: '#1B2A6B' },
  Sai:   { bg: 'rgba(96,165,250,0.1)',   text: '#3B82F6' },
  Abhi:  { bg: 'rgba(22,163,74,0.08)',   text: '#16A34A' },
  Dinesh:{ bg: 'rgba(136,144,166,0.1)',   text: '#4A5068' },
};

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userName = searchParams.get('user');
  const isValidUser = userName && PLAYERS.includes(userName);

  if (!isValidUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pb-[72px]">
        <div className="text-center">
          <p className="text-lg font-bold mb-2" style={{ color: '#1B2A6B' }}>Leaderboard</p>
          <p className="text-sm mb-4" style={{ color: '#4A5068' }}>Pick your name to continue</p>
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

  return <LeaderboardView userName={userName} />;
}

function LeaderboardView({ userName }) {
  const { leaderboard, totalMatches, completedCount, maxPointsSeeded, loading } = useLeaderboard();

  const remaining = totalMatches - completedCount;
  const progressPct = totalMatches > 0 ? (completedCount / totalMatches) * 100 : 0;

  const top3 = leaderboard.slice(0, 3);
  const podiumOrder = top3.length >= 3 ? [top3[1], top3[0], top3[2]] : top3;

  if (loading) {
    return (
      <div className="pb-[72px] px-4 pt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl mb-3 animate-pulse" style={{ backgroundColor: '#E8EAF0' }} />
        ))}
      </div>
    );
  }

  return (
    <div className="pb-[72px]">
      {/* Page header */}
      <div className="px-4 pt-5 pb-3">
        <div className="flex items-end justify-between">
          <div>
            <h1 className="text-xl font-extrabold" style={{ color: '#1A1A2E' }}>Leaderboard</h1>
            <p className="text-[10px] font-bold uppercase" style={{ color: '#1B2A6B', letterSpacing: '2px' }}>TATA IPL 2026</p>
          </div>
          <div className="text-right">
            <p className="font-mono-num text-lg font-bold" style={{ color: '#1A1A2E' }}>
              {completedCount} <span className="text-sm" style={{ color: '#8890A6' }}>/</span> {totalMatches}
            </p>
            <p className="text-[9px] font-bold uppercase" style={{ color: '#8890A6', letterSpacing: '1px' }}>matches played</p>
          </div>
        </div>
      </div>

      {/* Season progress bar */}
      <div className="px-4 mb-4">
        <div className="h-1 rounded-full" style={{ backgroundColor: '#E8EAF0' }}>
          <motion.div className="h-full rounded-full" style={{ background: 'linear-gradient(90deg, #1B2A6B, #E8458B)' }}
            initial={{ width: 0 }} animate={{ width: `${progressPct}%` }} transition={{ duration: 1, ease: 'easeOut' }} />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] font-bold" style={{ color: '#8890A6' }}>League stage</span>
          <span className="text-[9px] font-bold" style={{ color: '#8890A6' }}>{remaining} remaining</span>
        </div>
      </div>

      {/* Podium */}
      {podiumOrder.length >= 3 && (
        <div className="px-4 mb-5">
          <div className="flex items-end justify-center gap-3">
            {podiumOrder.map((entry, idx) => {
              const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              return <PodiumSlot key={entry.name} entry={entry} rank={actualRank} isCenter={idx === 1} />;
            })}
          </div>
          <div className="h-[2px] mt-0 rounded-full" style={{ background: 'linear-gradient(90deg, transparent, rgba(27,42,107,0.1), #1B2A6B, rgba(27,42,107,0.1), transparent)' }} />
        </div>
      )}

      {/* Full table */}
      <div className="px-4 mb-4">
        <div className="grid items-center px-3 mb-2" style={{ gridTemplateColumns: '26px 1fr 46px 46px 46px 38px' }}>
          {['#', 'PLAYER', 'PTS', 'ACC', 'PRED', ''].map((h, i) => (
            <span key={i} className={i >= 2 ? 'text-center' : ''} style={{ fontSize: 8, color: '#8890A6', fontWeight: 800, letterSpacing: '1.2px' }}>{h}</span>
          ))}
        </div>
        <div className="space-y-1.5">
          {leaderboard.map((entry) => (
            <PlayerRow key={entry.name} entry={entry} isCurrentUser={entry.name === userName} />
          ))}
        </div>
      </div>

      {/* Footer info */}
      <div className="px-4 mb-4 space-y-2">
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
          <span className="text-[11px]" style={{ color: '#8890A6' }}>Max points (seeded matches)</span>
          <span className="font-mono-num text-sm font-bold" style={{ color: '#1B2A6B' }}>{maxPointsSeeded}</span>
        </div>
        <div className="flex items-center justify-between px-3.5 py-2.5 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
          <span className="text-[11px]" style={{ color: '#8890A6' }}>Full season max</span>
          <span className="font-mono-num text-sm font-bold" style={{ color: '#4A5068' }}>{FULL_SEASON_MAX_POINTS}</span>
        </div>
      </div>

      <div className="px-4 mb-6 text-center">
        <Link to={buildUrl('/', userName)} className="text-[13px] font-semibold inline-flex items-center gap-1" style={{ color: '#4A5068' }}>View all matches →</Link>
      </div>
    </div>
  );
}

function PodiumSlot({ entry, rank, isCenter }) {
  const colors = PLAYER_COLORS[entry.name] || { bg: 'rgba(136,144,166,0.1)', text: '#4A5068' };
  const avatarSize = isCenter ? 58 : 46;
  const pointsSize = isCenter ? 22 : 16;
  const barHeight = rank === 1 ? 76 : rank === 2 ? 54 : 40;
  const barColor = rank === 1 ? '#C8E629' : rank === 2 ? '#E8458B' : '#8890A6';

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: rank * 0.1 }}
      className="flex flex-col items-center flex-1" style={{ order: rank === 2 ? 0 : rank === 1 ? 1 : 2 }}>
      <div className="relative mb-1.5">
        {rank === 1 && <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-base">👑</span>}
        <div className="rounded-full flex items-center justify-center font-bold"
          style={{ width: avatarSize, height: avatarSize, backgroundColor: colors.bg, color: colors.text, fontSize: avatarSize * 0.4 }}>
          {entry.name[0]}
        </div>
      </div>
      <span className="text-xs font-bold mb-0.5" style={{ color: '#1A1A2E' }}>{entry.name}</span>
      <span className="font-mono-num font-bold mb-2" style={{ fontSize: pointsSize, color: '#1B2A6B' }}>{entry.points}</span>
      <div className="w-full flex items-end justify-center rounded-t-[10px]"
        style={{ height: barHeight, background: `linear-gradient(180deg, ${barColor}33, ${barColor}08)`, border: `1px solid ${barColor}40`, borderBottom: 'none' }}>
        <span className="font-mono-num font-bold pb-2" style={{ fontSize: 22, color: `${barColor}80` }}>{rank}</span>
      </div>
    </motion.div>
  );
}

function PlayerRow({ entry, isCurrentUser }) {
  const colors = PLAYER_COLORS[entry.name] || { bg: 'rgba(136,144,166,0.1)', text: '#4A5068' };
  const rankColor = entry.rank === 1 ? '#C8E629' : entry.rank === 2 ? '#E8458B' : entry.rank === 3 ? '#8890A6' : '#A5ACC0';

  return (
    <div className="grid items-center px-3 py-2.5 rounded-xl"
      style={{
        gridTemplateColumns: '26px 1fr 46px 46px 46px 38px',
        backgroundColor: isCurrentUser ? '#EEF3FF' : '#FFFFFF',
        border: isCurrentUser ? '1px solid rgba(27,42,107,0.15)' : '1px solid #E8EAF0',
      }}>
      <span className="font-mono-num font-bold" style={{ fontSize: 13, color: rankColor }}>{entry.rank}</span>
      <div className="flex items-center gap-2 min-w-0">
        <div className="shrink-0 rounded-full flex items-center justify-center font-bold" style={{ width: 32, height: 32, backgroundColor: colors.bg, color: colors.text, fontSize: 13 }}>{entry.name[0]}</div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold truncate" style={{ color: '#1A1A2E' }}>{entry.name}</span>
            {isCurrentUser && <span className="shrink-0 font-extrabold uppercase" style={{ fontSize: 8, color: '#1B2A6B', backgroundColor: '#EEF3FF', padding: '1px 6px', borderRadius: 4, letterSpacing: '1px', border: '1px solid #D5DDF5' }}>YOU</span>}
          </div>
          <div className="flex items-center gap-[3px] mt-1">
            {entry.formLast5.map((result, i) => (
              <div key={i} className="rounded-full" style={{ width: 7, height: 7, backgroundColor: result ? '#16A34A' : '#E24B4A' }} />
            ))}
            {entry.formLast5.length === 0 && <span style={{ fontSize: 8, color: '#8890A6' }}>—</span>}
          </div>
        </div>
      </div>
      <span className="font-mono-num font-bold text-center" style={{ fontSize: 14, color: '#1B2A6B' }}>{entry.points}</span>
      <span className="font-mono-num font-bold text-center" style={{ fontSize: 13, color: '#16A34A' }}>{entry.accuracy}%</span>
      <span className="font-mono-num font-bold text-center" style={{ fontSize: 13, color: '#4A5068' }}>{entry.totalPredictions}</span>
      <span className="text-center font-extrabold" style={{ fontSize: 9 }}>
        {entry.trend > 0 && <span style={{ color: '#16A34A' }}>▲ {entry.trend}</span>}
        {entry.trend < 0 && <span style={{ color: '#E24B4A' }}>▼ {Math.abs(entry.trend)}</span>}
        {entry.trend === 0 && <span style={{ color: '#8890A6' }}>—</span>}
      </span>
    </div>
  );
}
