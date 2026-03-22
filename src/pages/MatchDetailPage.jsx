import { useMemo } from 'react';
import { useParams, useSearchParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { TEAM_BRANDING, PLAYERS, getMatchPoints } from '../lib/constants';
import { useMatches } from '../hooks/useMatches';
import { usePredictions } from '../hooks/usePredictions';
import { formatMatchDate, formatMatchTime, buildUrl } from '../lib/utils';
import TeamBadge from '../components/TeamBadge';
import { supabase } from '../lib/supabase';
import { useState, useEffect } from 'react';

const PLAYER_COLORS = {
  Arun:  { bg: 'rgba(200,230,41,0.15)',  text: '#C8E629' },
  Sai:   { bg: 'rgba(96,165,250,0.12)',   text: '#60A5FA' },
  Abhi:  { bg: 'rgba(34,197,94,0.12)',    text: '#4ADE80' },
  Dinesh:{ bg: 'rgba(148,174,212,0.15)',   text: '#9CAED4' },
};

export default function MatchDetailPage() {
  const { matchNumber } = useParams();
  const [searchParams] = useSearchParams();
  const userName = searchParams.get('user');
  const matchNum = parseInt(matchNumber, 10);

  const { matches, loading: matchesLoading } = useMatches();
  const { predictions: userPredictions } = usePredictions(userName);
  const [allPredictions, setAllPredictions] = useState([]);
  const [predsLoading, setPredsLoading] = useState(true);

  // Fetch all predictions for this match
  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from('predictions')
        .select('*')
        .eq('match_number', matchNum);
      if (data) setAllPredictions(data);
      setPredsLoading(false);
    }
    fetch();
  }, [matchNum]);

  const match = matches.find((m) => m.match_number === matchNum);
  const prevMatch = matches.find((m) => m.match_number === matchNum - 1);
  const nextMatch = matches.find((m) => m.match_number === matchNum + 1);

  if (matchesLoading || predsLoading) {
    return (
      <div className="pb-[72px] px-4 pt-6">
        <div className="h-48 rounded-xl animate-pulse mb-4" style={{ backgroundColor: '#142055' }} />
        <div className="h-32 rounded-xl animate-pulse" style={{ backgroundColor: '#142055' }} />
      </div>
    );
  }

  if (!match) {
    return (
      <div className="min-h-screen flex items-center justify-center pb-[72px]">
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: '#EF4444' }}>Match not found</p>
          <Link to={buildUrl('/', userName)} className="text-sm mt-2 inline-block" style={{ color: '#C8E629' }}>
            ← Back to matches
          </Link>
        </div>
      </div>
    );
  }

  const team1Brand = TEAM_BRANDING[match.team1] || {};
  const team2Brand = TEAM_BRANDING[match.team2] || {};
  const isCompleted = match.status === 'completed';

  return (
    <div className="pb-[72px]">
      {/* Back link */}
      <div className="px-4 pt-4 pb-2">
        <Link to={buildUrl('/', userName)} className="text-xs font-semibold" style={{ color: '#9CAED4' }}>
          ← Back to matches
        </Link>
      </div>

      {/* Match info card */}
      <div className="mx-4 rounded-[14px] overflow-hidden" style={{ backgroundColor: '#142055', border: '1px solid rgba(200,230,41,0.08)' }}>
        <div className="h-[3px]" style={{ background: `linear-gradient(to right, ${team1Brand.primary || '#333'} 50%, ${team2Brand.primary || '#333'} 50%)` }} />

        <div className="px-4 pt-4 pb-4">
          {/* Match number + status */}
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <span className="font-mono-num text-xs font-bold" style={{ color: '#9CAED4' }}>
                Match #{match.match_number}
              </span>
              <span className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase" style={{ backgroundColor: 'rgba(200,230,41,0.12)', color: '#C8E629' }}>
                {match.stage.toUpperCase()}
              </span>
            </div>
            <StatusBadge status={match.status} />
          </div>

          {/* Teams — large */}
          <div className="grid items-center" style={{ gridTemplateColumns: '1fr auto 1fr' }}>
            <div className="flex justify-center">
              <TeamBadge team={match.team1} size="lg" />
            </div>
            <div className="flex flex-col items-center px-3">
              <span className="text-2xl font-black" style={{ color: '#E8458B' }}>VS</span>
            </div>
            <div className="flex justify-center">
              <TeamBadge team={match.team2} size="lg" />
            </div>
          </div>

          {/* Venue + date */}
          <div className="mt-3 text-center">
            <p className="text-xs" style={{ color: '#6B7EB0' }}>{match.venue}</p>
            <p className="text-xs font-mono-num mt-0.5" style={{ color: '#9CAED4' }}>
              {formatMatchDate(match.match_date)} · {formatMatchTime(match.match_date)} IST
            </p>
          </div>

          {/* Result banner */}
          {isCompleted && match.result_text && (
            <div className="mt-3 rounded-lg px-3 py-2 text-center" style={{ backgroundColor: 'rgba(34,197,94,0.12)' }}>
              <span className="text-xs font-semibold" style={{ color: '#22C55E' }}>
                {match.result_text}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Group consensus */}
      <ConsensusBar match={match} predictions={allPredictions} />

      {/* All predictions */}
      <div className="px-4 mt-5">
        <h2 className="text-[15px] font-bold mb-3" style={{ color: '#F1F5F9' }}>Predictions</h2>

        <div className="space-y-2">
          {PLAYERS.map((player) => {
            const pred = allPredictions.find((p) => p.user_name === player);
            return (
              <PredictionRow
                key={player}
                player={player}
                prediction={pred}
                match={match}
                isCurrentUser={player === userName}
              />
            );
          })}
        </div>
      </div>

      {/* Match navigation */}
      <div className="px-4 mt-6 flex items-center justify-between">
        {prevMatch ? (
          <Link
            to={buildUrl(`/match/${prevMatch.match_number}`, userName)}
            className="text-[13px] font-semibold"
            style={{ color: '#9CAED4' }}
          >
            ← Match {prevMatch.match_number}
          </Link>
        ) : <span />}
        {nextMatch ? (
          <Link
            to={buildUrl(`/match/${nextMatch.match_number}`, userName)}
            className="text-[13px] font-semibold"
            style={{ color: '#9CAED4' }}
          >
            Match {nextMatch.match_number} →
          </Link>
        ) : <span />}
      </div>
    </div>
  );
}

/* ─── Consensus bar ─── */
function ConsensusBar({ match, predictions }) {
  const team1Votes = predictions.filter((p) => p.predicted_team === match.team1).length;
  const team2Votes = predictions.filter((p) => p.predicted_team === match.team2).length;
  const total = team1Votes + team2Votes;

  if (total === 0) return null;

  const team1Pct = Math.round((team1Votes / total) * 100);
  const team2Pct = 100 - team1Pct;
  const team1Brand = TEAM_BRANDING[match.team1] || {};
  const team2Brand = TEAM_BRANDING[match.team2] || {};

  return (
    <div className="px-4 mt-5">
      <p className="text-[11px] font-bold uppercase mb-2" style={{ color: '#6B7EB0', letterSpacing: '1.2px' }}>
        Group Consensus
      </p>
      <div className="flex rounded-lg overflow-hidden" style={{ height: 28 }}>
        <div
          className="flex items-center justify-center"
          style={{ width: `${team1Pct}%`, backgroundColor: team1Brand.primary || '#333', minWidth: 40 }}
        >
          <span className="text-xs font-bold text-white">{team1Pct}%</span>
        </div>
        <div
          className="flex items-center justify-center"
          style={{ width: `${team2Pct}%`, backgroundColor: team2Brand.primary || '#333', minWidth: 40 }}
        >
          <span className="text-xs font-bold text-white">{team2Pct}%</span>
        </div>
      </div>
      <p className="text-[10px] mt-1.5 text-center" style={{ color: '#6B7EB0' }}>
        {team1Votes} predicted {match.team1} · {team2Votes} predicted {match.team2}
      </p>
    </div>
  );
}

/* ─── Prediction row ─── */
function PredictionRow({ player, prediction, match, isCurrentUser }) {
  const colors = PLAYER_COLORS[player] || { bg: 'rgba(148,174,212,0.15)', text: '#9CAED4' };
  const isCompleted = match.status === 'completed' && match.winner;
  const predicted = prediction?.predicted_team;
  const isCorrect = isCompleted && predicted === match.winner;
  const isWrong = isCompleted && predicted && predicted !== match.winner;
  const points = isCorrect ? getMatchPoints(match.stage) : 0;

  return (
    <div
      className="flex items-center gap-3 px-3 py-2.5 rounded-xl"
      style={{
        backgroundColor: isCurrentUser ? 'rgba(200,230,41,0.06)' : '#142055',
        border: isCurrentUser ? '1px solid rgba(200,230,41,0.1)' : '1px solid rgba(200,230,41,0.04)',
      }}
    >
      {/* Avatar */}
      <div
        className="shrink-0 rounded-full flex items-center justify-center font-bold"
        style={{ width: 32, height: 32, backgroundColor: colors.bg, color: colors.text, fontSize: 13 }}
      >
        {player[0]}
      </div>

      {/* Name */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold truncate" style={{ color: '#F1F5F9' }}>{player}</span>
          {isCurrentUser && (
            <span className="shrink-0 text-[8px] font-extrabold uppercase" style={{ color: '#C8E629', backgroundColor: 'rgba(200,230,41,0.1)', padding: '1px 6px', borderRadius: 4, letterSpacing: '1px' }}>
              YOU
            </span>
          )}
        </div>
      </div>

      {/* Predicted team */}
      {predicted ? (
        <TeamBadge team={predicted} size="sm" />
      ) : (
        <span className="text-[11px]" style={{ color: '#6B7EB0' }}>No prediction</span>
      )}

      {/* Result icon */}
      <div className="shrink-0 w-6 text-center">
        {isCorrect && <span className="text-sm">✓</span>}
        {isWrong && <span className="text-sm" style={{ color: '#EF4444' }}>✗</span>}
        {!isCompleted && predicted && <span className="text-xs">⏳</span>}
      </div>

      {/* Points */}
      <span className="font-mono-num text-xs font-bold shrink-0 w-8 text-right" style={{ color: isCorrect ? '#C8E629' : '#6B7EB0' }}>
        {isCompleted ? (isCorrect ? `+${points}` : '0') : '—'}
      </span>
    </div>
  );
}

/* ─── Status badge (reused pattern) ─── */
function StatusBadge({ status }) {
  const styles = {
    completed: { bg: 'rgba(34,197,94,0.15)', color: '#4ADE80' },
    live: { bg: 'rgba(239,68,68,0.2)', color: '#F87171' },
    upcoming: { bg: 'rgba(200,230,41,0.12)', color: '#C8E629' },
  };
  const s = styles[status] || styles.upcoming;
  return (
    <span className="text-[9px] font-extrabold px-2.5 py-[3px] rounded-md uppercase" style={{ backgroundColor: s.bg, color: s.color, letterSpacing: '0.5px' }}>
      {status === 'live' ? 'LIVE' : status.toUpperCase()}
    </span>
  );
}
