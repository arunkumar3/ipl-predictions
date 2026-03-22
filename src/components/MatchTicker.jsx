import { useState, useEffect, useMemo } from 'react';
import { TEAM_BRANDING } from '../lib/constants';

export default function MatchTicker({ matches, onNavigate }) {
  const nextMatch = useMemo(() => {
    const now = new Date();
    return matches.find(
      (m) => (m.status === 'upcoming' || m.status === 'live') && new Date(m.match_date) > now
    ) || matches.find((m) => m.status === 'live');
  }, [matches]);

  const [timeLeft, setTimeLeft] = useState(() =>
    nextMatch ? getTimeLeft(nextMatch.match_date) : null
  );

  useEffect(() => {
    if (!nextMatch) return;
    setTimeLeft(getTimeLeft(nextMatch.match_date));
    const id = setInterval(() => setTimeLeft(getTimeLeft(nextMatch.match_date)), 60_000);
    return () => clearInterval(id);
  }, [nextMatch]);

  if (!nextMatch) return null;

  const isLive = nextMatch.status === 'live';
  const isUrgent = timeLeft && timeLeft.totalMinutes < 60 && !isLive;
  const team1 = TEAM_BRANDING[nextMatch.team1] || {};
  const team2 = TEAM_BRANDING[nextMatch.team2] || {};

  return (
    <div
      className="flex items-center gap-2.5 px-4 py-2"
      style={{
        background: 'linear-gradient(90deg, #142055, #1a2868)',
        borderBottom: '1px solid rgba(200, 230, 41, 0.06)',
      }}
    >
      {/* NEXT / LIVE badge */}
      {isLive ? (
        <span
          className="status-live shrink-0 font-extrabold uppercase px-2 py-[3px] rounded"
          style={{
            backgroundColor: 'rgba(239, 68, 68, 0.2)',
            color: '#F87171',
            fontSize: 8,
            letterSpacing: '1px',
          }}
        >
          LIVE
        </span>
      ) : (
        <span
          className="shrink-0 font-extrabold uppercase px-2 py-[3px] rounded"
          style={{
            backgroundColor: 'rgba(200, 230, 41, 0.12)',
            color: '#C8E629',
            fontSize: 8,
            letterSpacing: '1px',
          }}
        >
          NEXT
        </span>
      )}

      {/* Team 1 mini logo */}
      <MiniTeamBadge team={nextMatch.team1} branding={team1} />

      {/* Team names + VS */}
      <div className="flex items-center gap-1.5 min-w-0">
        <span className="text-[11px] font-bold truncate" style={{ color: '#F1F5F9' }}>
          {nextMatch.team1}
        </span>
        <span
          className="font-extrabold shrink-0"
          style={{ color: '#E8458B', fontSize: 9, letterSpacing: '1px' }}
        >
          VS
        </span>
        <span className="text-[11px] font-bold truncate" style={{ color: '#F1F5F9' }}>
          {nextMatch.team2}
        </span>
      </div>

      {/* Team 2 mini logo */}
      <MiniTeamBadge team={nextMatch.team2} branding={team2} />

      {/* Spacer */}
      <div className="flex-1" />

      {/* Countdown */}
      <span
        className="font-mono-num font-bold shrink-0"
        style={{
          fontSize: 10,
          color: isLive ? '#F87171' : isUrgent ? '#EF4444' : '#C8E629',
        }}
      >
        {isLive ? 'IN PROGRESS' : timeLeft?.text || '—'}
      </span>

      {/* PREDICT → button */}
      <button
        onClick={() => onNavigate?.(nextMatch.match_number)}
        className="shrink-0 font-bold"
        style={{
          color: '#E8458B',
          fontSize: 9,
          minHeight: 'auto',
        }}
      >
        PREDICT →
      </button>
    </div>
  );
}

function MiniTeamBadge({ team, branding }) {
  return (
    <div
      className="shrink-0 rounded-full flex items-center justify-center"
      style={{
        width: 20,
        height: 20,
        backgroundColor: `${branding.primary || '#333'}CC`,
      }}
    >
      <span
        className="font-extrabold leading-none"
        style={{
          fontSize: 7,
          color: branding.textOnPrimary || '#fff',
        }}
      >
        {team.slice(0, 3)}
      </span>
    </div>
  );
}

function getTimeLeft(matchDate) {
  const diff = new Date(matchDate) - new Date();
  if (diff <= 0) return { text: '0m', totalMinutes: 0 };

  const totalMinutes = Math.floor(diff / 60_000);
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const mins = totalMinutes % 60;

  let text = '';
  if (days > 0) text += `${days}d `;
  if (hours > 0 || days > 0) text += `${hours}h`;
  if (days === 0) text += ` ${mins}m`;

  return { text: text.trim(), totalMinutes };
}
