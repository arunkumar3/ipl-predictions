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
          <p className="text-lg font-bold" style={{ color: '#E24B4A' }}>Unauthorized</p>
          <p className="text-sm mt-2" style={{ color: '#8890A6' }}>Add ?key=... to access admin</p>
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
  const [memeMatch, setMemeMatch] = useState(null);
  const [memeStatus, setMemeStatus] = useState('');
  const [regeneratingAll, setRegeneratingAll] = useState(false);
  const [regenProgress, setRegenProgress] = useState([]);

  const pendingMatches = useMemo(() => matches.filter((m) => m.status !== 'completed'), [matches]);
  const completedMatches = useMemo(() => matches.filter((m) => m.status === 'completed'), [matches]);
  const match = matches.find((m) => m.match_number === selectedMatch);

  async function setWinner(winnerCode) {
    if (!match || processing) return;
    if (!window.confirm(`Set ${winnerCode} as winner of Match #${match.match_number}?`)) return;
    setProcessing(true); setStatus('');
    const { error } = await supabase.rpc('set_match_result', { p_match_number: match.match_number, p_winner: winnerCode, p_result_text: `${winnerCode} won` });
    if (error) {
      setStatus(`Error: ${error.message}`);
    } else {
      setStatus(`✓ Match #${match.match_number}: ${winnerCode} wins — generating memes...`);
      setSelectedMatch(null);
      // Auto-trigger meme generation
      try {
        const res = await supabase.functions.invoke('generate-memes', { body: { match_number: match.match_number } });
        if (res.error) throw res.error;
        const data = res.data;
        setStatus(`✓ Match #${match.match_number}: ${winnerCode} wins — ${data.generated} memes generated`);
      } catch (err) {
        setStatus(`✓ Match #${match.match_number}: ${winnerCode} wins (meme generation failed: ${err.message || err})`);
      }
    }
    setProcessing(false);
  }

  async function setMatchStatus(matchNumber, newStatus) {
    if (processing) return; setProcessing(true); setStatus('');
    const updates = { status: newStatus, updated_at: new Date().toISOString() };
    if (newStatus === 'upcoming') { updates.winner = null; updates.result_text = null; }
    const { error } = await supabase.from('matches').update(updates).eq('match_number', matchNumber);
    setStatus(error ? `Error: ${error.message}` : `✓ Match #${matchNumber} → ${newStatus}`);
    setProcessing(false);
  }

  async function simulateAll() {
    if (!window.confirm('Randomly assign winners to all upcoming matches?')) return;
    setProcessing(true); setStatus('Simulating...');
    for (const m of matches.filter((m) => m.status === 'upcoming')) {
      const winner = Math.random() > 0.5 ? m.team1 : m.team2;
      await supabase.rpc('set_match_result', { p_match_number: m.match_number, p_winner: winner, p_result_text: `${winner} won` });
    }
    setStatus('✓ All matches simulated'); setProcessing(false);
  }

  async function clearAll() {
    if (!window.confirm('Reset ALL matches to upcoming?')) return;
    setProcessing(true); setStatus('Clearing...');
    const { error } = await supabase.from('matches').update({ status: 'upcoming', winner: null, result_text: null, updated_at: new Date().toISOString() }).neq('match_number', 0);
    setStatus(error ? `Error: ${error.message}` : '✓ All results cleared'); setProcessing(false);
  }

  async function generateMemes(model) {
    if (!memeMatch) return;
    setMemeStatus(`Generating ${model === 'both' ? 'Grok + Gemini' : model} memes...`);
    try {
      // If regenerating a specific model, delete existing memes for that model first
      if (model !== 'both') {
        await supabase.from('memes').delete().eq('match_number', memeMatch).eq('model', model);
      }
      const res = await supabase.functions.invoke('generate-memes', { body: { match_number: memeMatch, regenerate: true } });
      if (res.error) throw res.error;
      const data = res.data;
      setMemeStatus(`✓ Generated ${data.generated} memes: ${data.results.map(r => `${r.model}(${r.count})`).join(', ')}`);
    } catch (err) {
      setMemeStatus(`Error: ${err.message || err}`);
    }
  }

  async function regenerateAllMemes() {
    if (!confirm('This will DELETE all existing memes and regenerate for every completed match. Are you sure?')) return;

    setRegeneratingAll(true);
    setRegenProgress([]);

    // 1. Delete all existing memes
    const { error: deleteError } = await supabase.from('memes').delete().neq('id', '00000000-0000-0000-0000-000000000000');
    if (deleteError) {
      console.error('Delete failed:', deleteError);
    }

    // 2. Get all completed matches
    const { data: completedMatchList } = await supabase
      .from('matches')
      .select('match_number, team1, team2, winner')
      .eq('status', 'completed')
      .order('match_number', { ascending: true });

    if (!completedMatchList?.length) {
      alert('No completed matches found');
      setRegeneratingAll(false);
      return;
    }

    // 3. Generate memes for each match sequentially
    const results = [];
    for (const m of completedMatchList) {
      setRegenProgress(prev => [...prev, { match: m.match_number, status: 'generating', detail: `${m.team1} vs ${m.team2}` }]);

      try {
        const { data, error } = await supabase.functions.invoke('generate-memes', {
          body: { match_number: m.match_number, regenerate: true },
        });

        if (error) throw error;

        setRegenProgress(prev => prev.map(p =>
          p.match === m.match_number
            ? { ...p, status: 'done', detail: `${m.team1} vs ${m.team2} — ${data?.generated || 0} memes` }
            : p
        ));
        results.push({ match: m.match_number, success: true, count: data?.generated || 0 });
      } catch (err) {
        setRegenProgress(prev => prev.map(p =>
          p.match === m.match_number
            ? { ...p, status: 'error', detail: `${m.team1} vs ${m.team2} — FAILED: ${err.message}` }
            : p
        ));
        results.push({ match: m.match_number, success: false, error: err.message });
      }

      // Small delay between calls to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    }

    setRegeneratingAll(false);
    const total = results.reduce((sum, r) => sum + (r.count || 0), 0);
    alert(`Done! Generated ${total} memes across ${results.filter(r => r.success).length} matches.`);
  }

  async function deleteMemes() {
    if (!memeMatch || !window.confirm(`Delete all memes for Match #${memeMatch}?`)) return;
    const { error } = await supabase.from('memes').delete().eq('match_number', memeMatch);
    setMemeStatus(error ? `Error: ${error.message}` : `✓ All memes deleted for Match #${memeMatch}`);
  }

  if (loading) return <div className="p-6"><div className="h-8 w-32 rounded animate-pulse mb-4" style={{ backgroundColor: '#E8EAF0' }} /><div className="h-48 rounded-xl animate-pulse" style={{ backgroundColor: '#E8EAF0' }} /></div>;

  return (
    <div className="min-h-screen p-4">
      <h1 className="text-xl font-extrabold mb-1" style={{ color: '#1A1A2E' }}>Admin Panel</h1>
      <p className="text-xs mb-6" style={{ color: '#8890A6' }}>Manual result entry & testing tools</p>

      {status && <div className="mb-4 px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: status.startsWith('Error') ? '#FEE7E7' : '#E8F8EE', color: status.startsWith('Error') ? '#E24B4A' : '#16A34A' }}>{status}</div>}

      <div className="mb-6">
        <label className="text-xs font-bold uppercase mb-2 block" style={{ color: '#4A5068', letterSpacing: '1px' }}>Select Match</label>
        <select value={selectedMatch || ''} onChange={(e) => setSelectedMatch(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold appearance-none" style={{ backgroundColor: '#FFFFFF', color: '#1A1A2E', border: '1px solid #E8EAF0', outline: 'none' }}>
          <option value="">— Choose a match —</option>
          {pendingMatches.map((m) => <option key={m.match_number} value={m.match_number}>Match #{m.match_number}: {m.team1} vs {m.team2} - {formatMatchDate(m.match_date)} [{m.status}]</option>)}
        </select>
      </div>

      {match && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
          <p className="text-xs font-bold mb-3" style={{ color: '#4A5068' }}>Set winner for Match #{match.match_number}</p>
          <div className="flex gap-4 justify-center mb-4">
            <button onClick={() => setWinner(match.team1)} disabled={processing}><TeamBadge team={match.team1} size="lg" /></button>
            <button onClick={() => setWinner(match.team2)} disabled={processing}><TeamBadge team={match.team2} size="lg" /></button>
          </div>
          <div className="flex gap-2 flex-wrap">
            <AdminBtn label="Set LIVE" color="#E24B4A" onClick={() => setMatchStatus(match.match_number, 'live')} disabled={processing} />
            <AdminBtn label="Set No Result" color="#8890A6" onClick={() => setMatchStatus(match.match_number, 'no_result')} disabled={processing} />
            <AdminBtn label="Reset to Upcoming" color="#3B82F6" onClick={() => setMatchStatus(match.match_number, 'upcoming')} disabled={processing} />
          </div>
        </motion.div>
      )}

      {/* Meme Generation */}
      <div className="mb-6 p-4 rounded-xl" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
        <p className="text-xs font-bold uppercase mb-3" style={{ color: '#4A5068', letterSpacing: '1px' }}>Generate Memes</p>
        {memeStatus && <div className="mb-3 px-3 py-2 rounded-lg text-xs font-semibold" style={{ backgroundColor: memeStatus.startsWith('Error') ? '#FEE7E7' : '#E8F8EE', color: memeStatus.startsWith('Error') ? '#E24B4A' : '#16A34A' }}>{memeStatus}</div>}
        <select value={memeMatch || ''} onChange={(e) => setMemeMatch(e.target.value ? parseInt(e.target.value) : null)}
          className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold appearance-none mb-3" style={{ backgroundColor: '#FFFFFF', color: '#1A1A2E', border: '1px solid #E8EAF0', outline: 'none' }}>
          <option value="">— Select completed match —</option>
          {completedMatches.map((m) => <option key={m.match_number} value={m.match_number}>Match #{m.match_number}: {m.team1} vs {m.team2} — {m.winner} won</option>)}
        </select>
        {memeMatch && (
          <div className="flex gap-2 flex-wrap">
            <AdminBtn label="Generate Both" color="#1B2A6B" onClick={() => generateMemes('both')} disabled={processing} />
            <AdminBtn label="Regen Grok" color="#4A5068" onClick={() => generateMemes('grok')} disabled={processing} />
            <AdminBtn label="Regen Gemini" color="#3B82F6" onClick={() => generateMemes('gemini')} disabled={processing} />
            <AdminBtn label="Delete All Memes" color="#E24B4A" onClick={deleteMemes} disabled={processing} />
          </div>
        )}

        <div style={{ borderTop: '1px solid #E8EAF0', marginTop: 16, paddingTop: 16 }}>
          <button
            onClick={regenerateAllMemes}
            disabled={regeneratingAll || processing}
            className="w-full px-4 py-3 rounded-xl text-sm font-bold"
            style={{
              backgroundColor: regeneratingAll ? '#FEF3C7' : '#FFF7ED',
              color: '#D97706',
              border: '1px solid #FBBF24',
              opacity: (regeneratingAll || processing) ? 0.6 : 1,
            }}
          >
            {regeneratingAll ? '⏳ Regenerating...' : '🔄 Regenerate ALL Matches'}
          </button>
          <p className="text-[10px] mt-1.5" style={{ color: '#8890A6' }}>
            Deletes all existing memes and regenerates for every completed match.
          </p>

          {regeneratingAll && regenProgress.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#1A1A2E' }}>
                Progress: {regenProgress.filter(p => p.status === 'done').length}/{regenProgress.length} matches...
              </p>
              {regenProgress.map(p => (
                <div key={p.match} style={{ fontSize: 12, padding: '4px 0', color: p.status === 'done' ? '#16a34a' : p.status === 'error' ? '#dc2626' : '#8890A6' }}>
                  {p.status === 'done' ? '✅' : p.status === 'error' ? '❌' : '⏳'} Match {p.match}: {p.detail}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="space-y-2">
        <p className="text-xs font-bold uppercase mb-2" style={{ color: '#4A5068', letterSpacing: '1px' }}>Bulk Actions</p>
        <button onClick={simulateAll} disabled={processing} className="w-full px-4 py-3 rounded-xl text-sm font-bold" style={{ backgroundColor: '#EEF3FF', color: '#1B2A6B', border: '1px solid #D5DDF5' }}>Simulate results for all matches</button>
        <button onClick={clearAll} disabled={processing} className="w-full px-4 py-3 rounded-xl text-sm font-bold" style={{ backgroundColor: '#FEE7E7', color: '#E24B4A', border: '1px solid #F5B5B5' }}>Clear all results</button>
      </div>
    </div>
  );
}

function AdminBtn({ label, color, onClick, disabled }) {
  return <button onClick={onClick} disabled={disabled} className="px-3 py-1.5 rounded-lg text-[10px] font-bold" style={{ backgroundColor: `${color}15`, color, border: `1px solid ${color}30`, opacity: disabled ? 0.5 : 1 }}>{label}</button>;
}
