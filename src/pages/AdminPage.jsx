import { useState, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { supabase } from '../lib/supabase';
import { useMatches } from '../hooks/useMatches';
import { TEAM_BRANDING } from '../lib/constants';
import { formatMatchDate } from '../lib/utils';
import TeamBadge from '../components/TeamBadge';

const ADMIN_KEY = 'ipl2026admin';

export default function AdminPage() {
  const [searchParams] = useSearchParams();
  const key = searchParams.get('key');

  if (key !== ADMIN_KEY) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center">
          <p className="text-lg font-bold" style={{ color: '#EF4444' }}>Unauthorized</p>
          <p className="text-sm mt-2" style={{ color: '#6B7EB0' }}>
            Add ?key=... to access admin
          </p>
        </div>
      </div>
    );
  }

  return <AdminView />;
}

function AdminView() {
  const { matches, loading } = useMatches();
  const [selectedMatch, setSelectedMatch] = useState(null);
  const [status, setStatus] = useState('');
  const [processing, setProcessing] = useState(false);

  const pendingMatches = useMemo(
    () => matches.filter((m) => m.status !== 'completed'),
    [matches]
  );

  const match = matches.find((m) => m.match_number === selectedMatch);

  async function setWinner(winnerCode) {
    if (!match || processing) return;
    const confirmed = window.confirm(
      `Set ${winnerCode} as winner of Match #${match.match_number}?`
    );
    if (!confirmed) return;

    setProcessing(true);
    setStatus('');
    const { error } = await supabase.rpc('set_match_result', {
      p_match_number: match.match_number,
      p_winner: winnerCode,
      p_result_text: `${winnerCode} won`,
    });

    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus(`✓ Match #${match.match_number}: ${winnerCode} wins`);
      setSelectedMatch(null);
    }
    setProcessing(false);
  }

  async function setMatchStatus(matchNumber, newStatus) {
    if (processing) return;
    setProcessing(true);
    setStatus('');

    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'upcoming') {
      updates.winner = null;
      updates.result_text = null;
    }

    const { error } = await supabase
      .from('matches')
      .update(updates)
      .eq('match_number', matchNumber);

    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus(`✓ Match #${matchNumber} → ${newStatus}`);
    }
    setProcessing(false);
  }

  async function simulateAll() {
    if (!window.confirm('Randomly assign winners to all upcoming matches?')) return;
    setProcessing(true);
    setStatus('Simulating...');

    for (const m of matches.filter((m) => m.status === 'upcoming')) {
      const winner = Math.random() > 0.5 ? m.team1 : m.team2;
      await supabase.rpc('set_match_result', {
        p_match_number: m.match_number,
        p_winner: winner,
        p_result_text: `${winner} won`,
      });
    }

    setStatus('✓ All matches simulated');
    setProcessing(false);
  }

  async function clearAll() {
    if (!window.confirm('Reset ALL matches to upcoming? This cannot be undone.')) return;
    setProcessing(true);
    setStatus('Clearing...');

    const { error } = await supabase
      .from('matches')
      .update({ status: 'upcoming', winner: null, result_text: null, updated_at: new Date().toISOString() })
      .neq('match_number', 0); // update all

    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus('✓ All results cleared');
    }
    setProcessing(false);
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-8 w-32 rounded animate-pulse mb-4" style={{ backgroundColor: '#142055' }} />
        <div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: '#142055' }} />
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-xl font-extrabold mb-1" style={{ color: '#F1F5F9' }}>
        Admin Panel
      </h1>
      <p className="text-xs mb-6" style={{ color: '#6B7EB0' }}>
        Manual result entry & testing tools
      </p>

      {/* Status message */}
      {status && (
        <div
          className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold"
          style={{
            backgroundColor: status.startsWith('Error')
              ? 'rgba(239,68,68,0.12)' : 'rgba(34,197,94,0.12)',
            color: status.startsWith('Error') ? '#EF4444' : '#22C55E',
          }}
        >
          {status}
        </div>
      )}

      {/* Match selector */}
      <div className="mb-6">
        <label className="text-xs font-bold uppercase mb-2 block" style={{ color: '#9CAED4', letterSpacing: '1px' }}>
          Select Match
        </label>
        <select
          value={selectedMatch || ''}
          onChange={(e) => setSelectedMatch(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold appearance-none"
          style={{
            backgroundColor: '#142055',
            color: '#F1F5F9',
            border: '1px solid rgba(200,230,41,0.1)',
            outline: 'none',
          }}
        >
          <option value="">— Choose a match —</option>
          {pendingMatches.map((m) => (
            <option key={m.match_number} value={m.match_number}>
              Match #{m.match_number}: {m.team1} vs {m.team2} - {formatMatchDate(m.match_date)} [{m.status}]
            </option>
          ))}
        </select>
      </div>

      {/* Winner selection */}
      {match && (
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6 p-4 rounded-xl"
          style={{ backgroundColor: '#142055', border: '1px solid rgba(200,230,41,0.08)' }}
        >
          <p className="text-xs font-bold mb-3" style={{ color: '#9CAED4' }}>
            Set winner for Match #{match.match_number}
          </p>
          <div className="flex gap-4 justify-center mb-4">
            <button onClick={() => setWinner(match.team1)} disabled={processing}>
              <TeamBadge team={match.team1} size="lg" />
            </button>
            <button onClick={() => setWinner(match.team2)} disabled={processing}>
              <TeamBadge team={match.team2} size="lg" />
            </button>
          </div>

          {/* Status controls */}
          <div className="flex gap-2 flex-wrap">
            <AdminBtn label="Set LIVE" color="#F87171" onClick={() => setMatchStatus(match.match_number, 'live')} disabled={processing} />
            <AdminBtn label="Set No Result" color="#6B7EB0" onClick={() => setMatchStatus(match.match_number, 'no_result')} disabled={processing} />
            <AdminBtn label="Reset to Upcoming" color="#60A5FA" onClick={() => setMatchStatus(match.match_number, 'upcoming')} disabled={processing} />
          </div>
        </motion.div>
      )}

      {/* Bulk actions */}
      <div className="space-y-2">
        <p className="text-xs font-bold uppercase mb-2" style={{ color: '#9CAED4', letterSpacing: '1px' }}>
          Bulk Actions
        </p>
        <button
          onClick={simulateAll}
          disabled={processing}
          className="w-full px-4 py-3 rounded-xl text-sm font-bold"
          style={{ backgroundColor: 'rgba(200,230,41,0.08)', color: '#C8E629', border: '1px solid rgba(200,230,41,0.15)' }}
        >
          Simulate results for all matches
        </button>
        <button
          onClick={clearAll}
          disabled={processing}
          className="w-full px-4 py-3 rounded-xl text-sm font-bold"
          style={{ backgroundColor: 'rgba(239,68,68,0.08)', color: '#EF4444', border: '1px solid rgba(239,68,68,0.15)' }}
        >
          Clear all results
        </button>
      </div>
    </div>
  );
}

function AdminBtn({ label, color, onClick, disabled }) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="px-3 py-1.5 rounded-lg text-[10px] font-bold"
      style={{
        backgroundColor: `${color}15`,
        color,
        border: `1px solid ${color}30`,
        opacity: disabled ? 0.5 : 1,
      }}
    >
      {label}
    </button>
  );
}
