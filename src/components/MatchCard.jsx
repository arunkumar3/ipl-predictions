import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TEAM_BRANDING, getMatchPoints } from '../lib/constants';
import { formatMatchDate, formatMatchTime, isMatchLocked, buildUrl } from '../lib/utils';
import TeamBadge from './TeamBadge';

export default function MatchCard({ match, prediction, onPredict }) {
  const [searchParams] = useSearchParams();
  const currentUser = searchParams.get('user');
  const team1Brand = TEAM_BRANDING[match.team1] || {};
  const team2Brand = TEAM_BRANDING[match.team2] || {};
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const locked = isMatchLocked(match.match_date) || isCompleted || isLive;
  const predictedTeam = prediction?.predicted_team;
  const points = isCompleted && match.winner && predictedTeam === match.winner
    ? getMatchPoints(match.stage)
    : 0;
  const isCorrect = isCompleted && match.winner && predictedTeam === match.winner;
  const isWrong = isCompleted && match.winner && predictedTeam && predictedTeam !== match.winner;

  const stageLabel = match.stage === 'league' ? 'LEAGUE' : match.stage.toUpperCase();

  function handlePredict(team) {
    if (locked || !onPredict) return;
    onPredict(match.match_number, team);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] overflow-hidden transition-colors duration-200 hover:bg-[#1a2d6e]"
      style={{
        backgroundColor: '#142055',
        border: '1px solid rgba(200, 230, 41, 0.08)',
      }}
    >
      {/* Gradient top border — team colors */}
      <div
        className="h-[3px]"
        style={{
          background: `linear-gradient(to right, ${team1Brand.primary || '#333'} 50%, ${team2Brand.primary || '#333'} 50%)`,
        }}
      />

      <div className="px-4 pt-3 pb-3">
        {/* Top row: match info + status */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono-num text-[11px] font-bold" style={{ color: '#9CAED4' }}>
              #{match.match_number}
            </span>
            <span
              className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase tracking-wide"
              style={{
                backgroundColor: 'rgba(200, 230, 41, 0.12)',
                color: '#C8E629',
                letterSpacing: '0.5px',
              }}
            >
              {stageLabel}
            </span>
          </div>
          <StatusBadge status={match.status} locked={locked} isLive={isLive} />
        </div>

        {/* Teams row: 1fr auto 1fr grid */}
        <div
          className="grid items-center"
          style={{ gridTemplateColumns: '1fr auto 1fr' }}
        >
          <div className="flex justify-center">
            <TeamBadge
              team={match.team1}
              size="md"
              selected={predictedTeam === match.team1}
              onClick={() => handlePredict(match.team1)}
              disabled={locked}
            />
          </div>

          <div className="flex flex-col items-center px-2">
            <span
              className="text-xl font-black tracking-tight"
              style={{ color: '#E8458B' }}
            >
              VS
            </span>
          </div>

          <div className="flex justify-center">
            <TeamBadge
              team={match.team2}
              size="md"
              selected={predictedTeam === match.team2}
              onClick={() => handlePredict(match.team2)}
              disabled={locked}
            />
          </div>
        </div>

        {/* Venue + date */}
        <div className="mt-2 text-center">
          <p className="text-[11px]" style={{ color: '#6B7EB0' }}>
            {match.venue}
          </p>
          <p className="text-[11px] font-mono-num mt-0.5" style={{ color: '#9CAED4' }}>
            {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_date)} IST
          </p>
        </div>

        {/* Countdown timer */}
        {!isCompleted && !isLive && (
          <CountdownPill matchDate={match.match_date} locked={locked} />
        )}

        {/* Prediction hint */}
        {!locked && !predictedTeam && (
          <p className="text-center text-[11px] font-semibold mt-2" style={{ color: '#E8458B' }}>
            Tap a team to predict
          </p>
        )}

        {/* Result banner */}
        {isCompleted && match.winner && predictedTeam && (
          <div
            className="mt-2.5 rounded-lg px-3 py-2 flex items-center justify-between"
            style={{
              backgroundColor: isCorrect
                ? 'rgba(34, 197, 94, 0.12)'
                : 'rgba(239, 68, 68, 0.12)',
            }}
          >
            <span className="text-xs font-semibold" style={{ color: isCorrect ? '#22C55E' : '#EF4444' }}>
              {isCorrect
                ? `You predicted ${predictedTeam} — Correct!`
                : `You predicted ${predictedTeam} — Wrong`}
            </span>
            {isCorrect && (
              <span
                className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ backgroundColor: 'rgba(200, 230, 41, 0.15)', color: '#C8E629' }}
              >
                +{points}
              </span>
            )}
          </div>
        )}

        {isCompleted && match.result_text && (
          <p className="text-[10px] text-center mt-1.5" style={{ color: '#9CAED4' }}>
            {match.result_text}
          </p>
        )}

        {/* View details link */}
        <Link
          to={buildUrl(`/match/${match.match_number}`, currentUser)}
          className="block text-center text-[10px] font-semibold mt-2 pt-2"
          style={{ color: '#6B7EB0', borderTop: '1px solid rgba(200,230,41,0.06)', minHeight: 'auto' }}
        >
          View details →
        </Link>
      </div>
    </motion.div>
  );
}

/* ─── Countdown pill ─── */
function CountdownPill({ matchDate, locked }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(matchDate));

  useEffect(() => {
    const id = setInterval(() => setTimeLeft(getTimeLeft(matchDate)), 60_000);
    return () => clearInterval(id);
  }, [matchDate]);

  if (locked) {
    return (
      <div className="flex justify-center mt-2">
        <span
          className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide"
          style={{ backgroundColor: 'rgba(232, 69, 139, 0.15)', color: '#E8458B' }}
        >
          LOCKED
        </span>
      </div>
    );
  }

  const isUrgent = timeLeft.totalMinutes < 60;

  return (
    <div className="flex justify-center mt-2">
      <span
        className="font-mono-num text-[10px] font-semibold px-3 py-1 rounded-full"
        style={{
          backgroundColor: isUrgent ? 'rgba(239, 68, 68, 0.12)' : 'rgba(200, 230, 41, 0.08)',
          color: isUrgent ? '#EF4444' : '#C8E629',
        }}
      >
        {isUrgent
          ? `Locks in ${timeLeft.totalMinutes}m!`
          : `Predictions lock in ${timeLeft.text}`}
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
  if (hours > 0) text += `${hours}h `;
  text += `${mins}m`;

  return { text: text.trim(), totalMinutes };
}

/* ─── Status badge ─── */
function StatusBadge({ status, locked, isLive }) {
  if (isLive) {
    return (
      <span
        className="status-live flex items-center gap-1.5 text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase"
        style={{
          backgroundColor: 'rgba(239, 68, 68, 0.2)',
          color: '#F87171',
          letterSpacing: '0.5px',
        }}
      >
        <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse" />
        LIVE
      </span>
    );
  }

  if (status === 'completed') {
    return (
      <span
        className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase"
        style={{
          backgroundColor: 'rgba(34, 197, 94, 0.15)',
          color: '#4ADE80',
          letterSpacing: '0.5px',
        }}
      >
        COMPLETED
      </span>
    );
  }

  if (locked) {
    return (
      <span
        className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase"
        style={{
          backgroundColor: 'rgba(232, 69, 139, 0.15)',
          color: '#E8458B',
          letterSpacing: '0.5px',
        }}
      >
        LOCKED
      </span>
    );
  }

  return (
    <span
      className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase"
      style={{
        backgroundColor: 'rgba(200, 230, 41, 0.12)',
        color: '#C8E629',
        letterSpacing: '0.5px',
      }}
    >
      UPCOMING
    </span>
  );
}
