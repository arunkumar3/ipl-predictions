import { useState, useEffect } from 'react';
import { useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TEAM_BRANDING, getMatchPoints } from '../lib/constants';
import { formatMatchDate, formatMatchTime, isMatchLocked, buildUrl } from '../lib/utils';
import TeamBadge from './TeamBadge';

export default function MatchCard({ match, prediction, onPredict, readOnly = false }) {
  const [searchParams] = useSearchParams();
  const currentUser = searchParams.get('user');
  const team1Brand = TEAM_BRANDING[match.team1] || {};
  const team2Brand = TEAM_BRANDING[match.team2] || {};
  const isCompleted = match.status === 'completed';
  const isLive = match.status === 'live';
  const locked = isMatchLocked(match.match_date) || isCompleted || isLive;
  const predictedTeam = prediction?.predicted_team;
  const points = isCompleted && match.winner && predictedTeam === match.winner ? getMatchPoints(match.stage) : 0;
  const isCorrect = isCompleted && match.winner && predictedTeam === match.winner;
  const canInteract = !locked && !readOnly;

  const stageLabel = match.stage === 'league' ? 'LEAGUE' : match.stage.toUpperCase();

  function handlePredict(team) {
    if (!canInteract || !onPredict) return;
    onPredict(match.match_number, team);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-[14px] overflow-hidden transition-colors duration-200"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0', boxShadow: '0 1px 3px rgba(0, 0, 0, 0.04)' }}
    >
      <div className="h-[3px]" style={{ background: `linear-gradient(to right, ${team1Brand.primary || '#333'} 50%, ${team2Brand.primary || '#333'} 50%)` }} />

      <div className="px-4 pt-3 pb-3">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="font-mono-num text-[11px] font-bold" style={{ color: '#8890A6' }}>#{match.match_number}</span>
            <span className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase tracking-wide" style={{ backgroundColor: '#EEF3FF', color: '#1B2A6B', letterSpacing: '0.5px' }}>{stageLabel}</span>
          </div>
          <StatusBadge status={match.status} locked={locked} isLive={isLive} />
        </div>

        <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
          <div className="flex justify-center">
            <TeamBadge team={match.team1} size="md"
              selected={!readOnly && predictedTeam === match.team1}
              onClick={canInteract ? () => handlePredict(match.team1) : undefined}
              disabled={!canInteract} />
          </div>
          <div className="flex flex-col items-center px-2">
            <span className="text-xl font-black tracking-tight" style={{ color: '#E8458B' }}>VS</span>
          </div>
          <div className="flex justify-center">
            <TeamBadge team={match.team2} size="md"
              selected={!readOnly && predictedTeam === match.team2}
              onClick={canInteract ? () => handlePredict(match.team2) : undefined}
              disabled={!canInteract} />
          </div>
        </div>

        <div className="mt-2 text-center">
          <p className="text-[11px]" style={{ color: '#8890A6' }}>{match.venue}</p>
          <p className="text-[11px] font-mono-num mt-0.5" style={{ color: '#4A5068' }}>
            {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_date)} IST
          </p>
        </div>

        {!isCompleted && !isLive && <CountdownPill matchDate={match.match_date} locked={locked} />}

        {/* Prediction hint or read-only label */}
        {!locked && !predictedTeam && !readOnly && (
          <p className="text-center text-[11px] font-semibold mt-2" style={{ color: '#1B2A6B' }}>Tap a team to predict</p>
        )}
        {readOnly && predictedTeam && !isCompleted && (
          <p className="text-center text-[11px] mt-2" style={{ color: '#8890A6' }}>Predicted: {predictedTeam}</p>
        )}
        {readOnly && !predictedTeam && !isCompleted && (
          <p className="text-center text-[11px] mt-2" style={{ color: '#8890A6' }}>No prediction</p>
        )}

        {isCompleted && match.winner && predictedTeam && (
          <div className="mt-2.5 rounded-lg px-3 py-2 flex items-center justify-between" style={{ backgroundColor: isCorrect ? '#E8F8EE' : '#FEE7E7' }}>
            <span className="text-xs font-semibold" style={{ color: isCorrect ? '#16A34A' : '#E24B4A' }}>
              {isCorrect ? `Predicted ${predictedTeam} — Correct!` : `Predicted ${predictedTeam} — Wrong`}
            </span>
            {isCorrect && (
              <span className="font-mono-num text-xs font-bold px-2 py-0.5 rounded-full" style={{ backgroundColor: '#E8F8EE', color: '#16A34A', border: '1px solid #B6E8C8' }}>+{points}</span>
            )}
          </div>
        )}

        {isCompleted && match.result_text && (
          <p className="text-[10px] text-center mt-1.5" style={{ color: '#4A5068' }}>{match.result_text}</p>
        )}

        <Link to={buildUrl(`/match/${match.match_number}`, currentUser)}
          className="block text-center text-[10px] font-semibold mt-2 pt-2"
          style={{ color: '#8890A6', borderTop: '1px solid #F0F1F5', minHeight: 'auto' }}>
          View details →
        </Link>
      </div>
    </motion.div>
  );
}

function CountdownPill({ matchDate, locked }) {
  const [timeLeft, setTimeLeft] = useState(() => getTimeLeft(matchDate));
  useEffect(() => { const id = setInterval(() => setTimeLeft(getTimeLeft(matchDate)), 60_000); return () => clearInterval(id); }, [matchDate]);

  if (locked) return (
    <div className="flex justify-center mt-2">
      <span className="text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wide" style={{ backgroundColor: '#FEE7E7', color: '#E24B4A' }}>LOCKED</span>
    </div>
  );

  const isUrgent = timeLeft.totalMinutes < 60;
  return (
    <div className="flex justify-center mt-2">
      <span className="font-mono-num text-[10px] font-semibold px-3 py-1 rounded-full"
        style={{ backgroundColor: isUrgent ? '#FEE7E7' : '#EEF3FF', color: isUrgent ? '#E24B4A' : '#1B2A6B' }}>
        {isUrgent ? `Locks in ${timeLeft.totalMinutes}m!` : `Predictions lock in ${timeLeft.text}`}
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

function StatusBadge({ status, locked, isLive }) {
  if (isLive) return <span className="status-live flex items-center gap-1.5 text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase" style={{ backgroundColor: '#FEE7E7', color: '#E24B4A', letterSpacing: '0.5px' }}><span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: '#E24B4A' }} />LIVE</span>;
  if (status === 'completed') return <span className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase" style={{ backgroundColor: '#E8F8EE', color: '#16A34A', letterSpacing: '0.5px' }}>COMPLETED</span>;
  if (locked) return <span className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase" style={{ backgroundColor: '#FEE7E7', color: '#E24B4A', letterSpacing: '0.5px' }}>LOCKED</span>;
  return <span className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase" style={{ backgroundColor: '#EEF3FF', color: '#1B2A6B', letterSpacing: '0.5px' }}>UPCOMING</span>;
}
