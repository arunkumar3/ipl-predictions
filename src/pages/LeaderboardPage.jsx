import { useMemo } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PLAYERS, FULL_SEASON_MAX_POINTS } from '../lib/constants';
import { useLeaderboard } from '../hooks/useLeaderboard';
import { buildUrl } from '../lib/utils';

const PLAYER_COLORS = {
  Arun:  { bg: 'rgba(200,230,41,0.15)',  text: '#C8E629' },
  Sai:   { bg: 'rgba(96,165,250,0.12)',   text: '#60A5FA' },
  Abhi:  { bg: 'rgba(34,197,94,0.12)',    text: '#4ADE80' },
  Dinesh:{ bg: 'rgba(148,174,212,0.15)',   text: '#9CAED4' },
};

export default function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const userName = searchParams.get('user');
  const isValidUser = userName && PLAYERS.includes(userName);

  if (!isValidUser) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 pb-[72px]">
        <div className="text-center">
          <p className="text-lg font-bold mb-2" style={{ color: '#C8E629' }}>Leaderboard</p>
          <p className="text-sm mb-4" style={{ color: '#9CAED4' }}>Pick your name to continue</p>
          <div className="flex flex-col gap-2">
            {PLAYERS.map((name) => (
              <button
                key={name}
                onClick={() => setSearchParams({ user: name })}
                className="px-6 py-2 rounded-lg font-bold text-sm"
                style={{ backgroundColor: 'rgba(200,230,41,0.08)', color: '#C8E629', border: '1px solid rgba(200,230,41,0.15)' }}
              >
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
  // Podium order: 2nd, 1st, 3rd
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3;

  if (loading) {
    return (
      <div className="pb-[72px] px-4 pt-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-16 rounded-xl mb-3 animate-pulse" style={{ backgroundColor: '#142055' }} />
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
            <h1 className="text-xl font-extrabold" style={{ color: '#F1F5F9' }}>Leaderboard</h1>
            <p className="text-[10px] font-bold uppercase" style={{ color: '#C8E629', letterSpacing: '2px' }}>
              TATA IPL 2026
            </p>
          </div>
          <div className="text-right">
            <p className="font-mono-num text-lg font-bold" style={{ color: '#F1F5F9' }}>
              {completedCount} <span className="text-sm" style={{ color: '#6B7EB0' }}>/</span> {totalMatches}
            </p>
            <p className="text-[9px] font-bold uppercase" style={{ color: '#6B7EB0', letterSpacing: '1px' }}>
              matches played
            </p>
          </div>
        </div>
      </div>

      {/* Season progress bar */}
      <div className="px-4 mb-4">
        <div className="h-1 rounded-full" style={{ backgroundColor: 'rgba(200,230,41,0.08)' }}>
          <motion.div
            className="h-full rounded-full"
            style={{ background: 'linear-gradient(90deg, #C8E629, #E8458B)' }}
            initial={{ width: 0 }}
            animate={{ width: `${progressPct}%` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </div>
        <div className="flex justify-between mt-1.5">
          <span className="text-[9px] font-bold" style={{ color: '#6B7EB0' }}>League stage</span>
          <span className="text-[9px] font-bold" style={{ color: '#6B7EB0' }}>{remaining} remaining</span>
        </div>
      </div>

      {/* Podium */}
      {podiumOrder.length >= 3 && (
        <div className="px-4 mb-5">
          <div className="flex items-end justify-center gap-3">
            {podiumOrder.map((entry, idx) => {
              const actualRank = idx === 0 ? 2 : idx === 1 ? 1 : 3;
              return (
                <PodiumSlot
                  key={entry.name}
                  entry={entry}
                  rank={actualRank}
                  isCenter={idx === 1}
                />
              );
            })}
          </div>
          {/* Podium base line */}
          <div
            className="h-[2px] mt-0 rounded-full"
            style={{
              background: 'linear-gradient(90deg, transparent, rgba(200,230,41,0.15), #C8E629, rgba(200,230,41,0.15), transparent)',
            }}
          />
        </div>
      )}

      {/* Full table */}
      <div className="px-4 mb-4">
        {/* Table header */}
        <div
          className="grid items-center px-3 mb-2"
          style={{ gridTemplateColumns: '26px 1fr 46px 46px 46px 38px' }}
        >
          {['#', 'PLAYER', 'PTS', 'ACC', 'PRED', ''].map((h, i) => (
            <span
              key={i}
              className={i >= 2 ? 'text-center' : ''}
              style={{ fontSize: 8, color: '#6B7EB0', fontWeight: 800, letterSpacing: '1.2px' }}
            >
              {h}
            </span>
          ))}
        </div>

        {/* Table rows */}
        <div className="space-y-1.5">
          {leaderboard.map((entry) => (
            <PlayerRow key={entry.name} entry={entry} isCurrentUser={entry.name === userName} />
          ))}
        </div>
      </div>

      {/* Footer info */}
      <div className="px-4 mb-4 space-y-2">
        <div
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
          style={{
            backgroundColor: 'rgba(200,230,41,0.04)',
            border: '1px solid rgba(200,230,41,0.06)',
          }}
        >
          <span className="text-[11px]" style={{ color: '#6B7EB0' }}>
            Max points (seeded matches)
          </span>
          <span className="font-mono-num text-sm font-bold" style={{ color: '#C8E629' }}>
            {maxPointsSeeded}
          </span>
        </div>
        <div
          className="flex items-center justify-between px-3.5 py-2.5 rounded-xl"
          style={{
            backgroundColor: 'rgba(200,230,41,0.04)',
            border: '1px solid rgba(200,230,41,0.06)',
          }}
        >
          <span className="text-[11px]" style={{ color: '#6B7EB0' }}>
            Full season max
          </span>
          <span className="font-mono-num text-sm font-bold" style={{ color: '#9CAED4' }}>
            {FULL_SEASON_MAX_POINTS}
          </span>
        </div>
      </div>

      {/* View all matches link */}
      <div className="px-4 mb-6 text-center">
        <Link
          to={buildUrl('/', userName)}
          className="text-[13px] font-semibold inline-flex items-center gap-1"
          style={{ color: '#9CAED4' }}
        >
          View all matches →
        </Link>
      </div>
    </div>
  );
}

/* ─── Podium slot ─── */
function PodiumSlot({ entry, rank, isCenter }) {
  const colors = PLAYER_COLORS[entry.name] || { bg: 'rgba(148,174,212,0.15)', text: '#9CAED4' };
  const avatarSize = isCenter ? 58 : 46;
  const pointsSize = isCenter ? 22 : 16;
  const barHeight = rank === 1 ? 76 : rank === 2 ? 54 : 40;
  const barColor = rank === 1 ? '#C8E629' : rank === 2 ? '#E8458B' : '#9CAED4';

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.1 }}
      className="flex flex-col items-center flex-1"
      style={{ order: rank === 2 ? 0 : rank === 1 ? 1 : 2 }}
    >
      {/* Avatar */}
      <div className="relative mb-1.5">
        {rank === 1 && (
          <span className="absolute -top-4 left-1/2 -translate-x-1/2 text-base">👑</span>
        )}
        <div
          className="rounded-full flex items-center justify-center font-bold"
          style={{
            width: avatarSize,
            height: avatarSize,
            backgroundColor: colors.bg,
            color: colors.text,
            fontSize: avatarSize * 0.4,
          }}
        >
          {entry.name[0]}
        </div>
      </div>

      {/* Name */}
      <span className="text-xs font-bold mb-0.5" style={{ color: '#F1F5F9' }}>
        {entry.name}
      </span>

      {/* Points */}
      <span
        className="font-mono-num font-bold mb-2"
        style={{ fontSize: pointsSize, color: '#C8E629' }}
      >
        {entry.points}
      </span>

      {/* Bar */}
      <div
        className="w-full flex items-end justify-center rounded-t-[10px]"
        style={{
          height: barHeight,
          background: `linear-gradient(180deg, ${barColor}33, ${barColor}08)`,
          border: `1px solid ${barColor}40`,
          borderBottom: 'none',
        }}
      >
        <span
          className="font-mono-num font-bold pb-2"
          style={{ fontSize: 22, color: `${barColor}80` }}
        >
          {rank}
        </span>
      </div>
    </motion.div>
  );
}

/* ─── Player row ─── */
function PlayerRow({ entry, isCurrentUser }) {
  const colors = PLAYER_COLORS[entry.name] || { bg: 'rgba(148,174,212,0.15)', text: '#9CAED4' };
  const rankColor = entry.rank === 1 ? '#C8E629' : entry.rank === 2 ? '#E8458B' : entry.rank === 3 ? '#9CAED4' : '#6B7EB0';

  return (
    <div
      className="grid items-center px-3 py-2.5 rounded-xl"
      style={{
        gridTemplateColumns: '26px 1fr 46px 46px 46px 38px',
        backgroundColor: isCurrentUser ? 'rgba(200,230,41,0.06)' : 'transparent',
        border: isCurrentUser ? '1px solid rgba(200,230,41,0.1)' : '1px solid transparent',
      }}
    >
      {/* Rank */}
      <span className="font-mono-num font-bold" style={{ fontSize: 13, color: rankColor }}>
        {entry.rank}
      </span>

      {/* Player */}
      <div className="flex items-center gap-2 min-w-0">
        <div
          className="shrink-0 rounded-full flex items-center justify-center font-bold"
          style={{
            width: 32,
            height: 32,
            backgroundColor: colors.bg,
            color: colors.text,
            fontSize: 13,
          }}
        >
          {entry.name[0]}
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className="text-[13px] font-bold truncate" style={{ color: '#F1F5F9' }}>
              {entry.name}
            </span>
            {isCurrentUser && (
              <span
                className="shrink-0 font-extrabold uppercase"
                style={{
                  fontSize: 8,
                  color: '#C8E629',
                  backgroundColor: 'rgba(200,230,41,0.1)',
                  padding: '1px 6px',
                  borderRadius: 4,
                  letterSpacing: '1px',
                }}
              >
                YOU
              </span>
            )}
          </div>
          {/* Form dots */}
          <div className="flex items-center gap-[3px] mt-1">
            {entry.formLast5.map((result, i) => (
              <div
                key={i}
                className="rounded-full"
                style={{
                  width: 7,
                  height: 7,
                  backgroundColor: result ? '#22C55E' : '#EF4444',
                }}
              />
            ))}
            {entry.formLast5.length === 0 && (
              <span style={{ fontSize: 8, color: '#6B7EB0' }}>—</span>
            )}
          </div>
        </div>
      </div>

      {/* PTS */}
      <span className="font-mono-num font-bold text-center" style={{ fontSize: 14, color: '#C8E629' }}>
        {entry.points}
      </span>

      {/* ACC */}
      <span className="font-mono-num font-bold text-center" style={{ fontSize: 13, color: '#22C55E' }}>
        {entry.accuracy}%
      </span>

      {/* PRED */}
      <span className="font-mono-num font-bold text-center" style={{ fontSize: 13, color: '#9CAED4' }}>
        {entry.totalPredictions}
      </span>

      {/* Trend */}
      <span className="text-center font-extrabold" style={{ fontSize: 9 }}>
        {entry.trend > 0 && <span style={{ color: '#22C55E' }}>▲ {entry.trend}</span>}
        {entry.trend < 0 && <span style={{ color: '#EF4444' }}>▼ {Math.abs(entry.trend)}</span>}
        {entry.trend === 0 && <span style={{ color: '#6B7EB0' }}>—</span>}
      </span>
    </div>
  );
}
