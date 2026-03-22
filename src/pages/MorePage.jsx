import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PLAYERS, FULL_SEASON_MAX_POINTS } from '../lib/constants';
import { useToast } from '../components/Toast';
import { buildUrl } from '../lib/utils';
import { getClaimedIdentity, clearIdentity, hasClaimedIdentity } from '../lib/identity';

export default function MorePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get('user');
  const showToast = useToast();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);
  const claimed = getClaimedIdentity();

  function switchPlayer(name) { navigate(buildUrl('/', name)); }

  function shareLink() {
    const url = `${window.location.origin}/?user=${userName}`;
    navigator.clipboard.writeText(url).then(() => showToast('Link copied!', 'success')).catch(() => showToast('Could not copy link', 'error'));
  }

  function handleResetIdentity() {
    if (window.confirm('Are you sure? You\'ll need to pick your name again.')) {
      clearIdentity();
      navigate('/');
    }
  }

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="pb-[72px]">
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-extrabold" style={{ color: '#1A1A2E' }}>More</h1>
        <p className="text-[10px] font-bold uppercase" style={{ color: '#1B2A6B', letterSpacing: '2px' }}>Settings & Info</p>
      </div>

      {/* Identity section */}
      {hasClaimedIdentity() && (
        <Section title="Identity">
          <div className="rounded-xl p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold" style={{ color: '#1A1A2E' }}>You are: <span style={{ color: '#1B2A6B' }}>{claimed}</span></p>
                <p className="text-[10px] mt-0.5" style={{ color: '#8890A6' }}>Locked to this device</p>
              </div>
              <button onClick={handleResetIdentity} className="text-[11px] font-semibold" style={{ color: '#8890A6', minHeight: 'auto' }}>
                Reset identity
              </button>
            </div>
          </div>
        </Section>
      )}

      <Section title="View other players">
        <div className="flex flex-wrap gap-2">
          {PLAYERS.map((name) => {
            const isMe = name === claimed;
            return (
              <button key={name} onClick={() => switchPlayer(name)} className="px-4 py-2 rounded-lg text-sm font-bold"
                style={{ backgroundColor: isMe ? '#1B2A6B' : '#FFFFFF', color: isMe ? '#FFFFFF' : '#8890A6', border: isMe ? '1px solid #1B2A6B' : '1px solid #E8EAF0' }}>
                {isMe ? `${name} (You)` : name}
              </button>
            );
          })}
        </div>
      </Section>

      <Section title="Scoring rules" collapsible open={rulesOpen} onToggle={() => setRulesOpen(!rulesOpen)}>
        <div className="rounded-xl p-3" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
          <table className="w-full text-[12px]">
            <tbody>
              {[['League matches', '+1 point'], ['Qualifier 1 & 2', '+2 points'], ['Eliminator', '+2 points'], ['Final', '+3 points'], ['Wrong prediction', '0 points'], ['No prediction', '0 points'], ['Max possible (full season)', `${FULL_SEASON_MAX_POINTS} points`]].map(([label, value], i) => (
                <tr key={i} style={{ borderBottom: i < 6 ? '1px solid #F0F1F5' : 'none' }}>
                  <td className="py-1.5" style={{ color: '#4A5068' }}>{label}</td>
                  <td className="py-1.5 text-right font-mono-num font-bold" style={{ color: i === 6 ? '#1B2A6B' : '#1A1A2E' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      <Section title="How it works" collapsible open={howOpen} onToggle={() => setHowOpen(!howOpen)}>
        <div className="space-y-2.5">
          {['Predict the winner of each IPL 2026 match', 'Predictions lock when the match starts', 'Points awarded when results come in', 'Compete with your friends on the leaderboard'].map((text, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono-num text-[10px] font-bold shrink-0 mt-0.5" style={{ color: '#1B2A6B' }}>{i + 1}.</span>
              <span className="text-[12px]" style={{ color: '#4A5068' }}>{text}</span>
            </div>
          ))}
        </div>
      </Section>

      {userName && (
        <div className="px-4 mb-4">
          <button onClick={shareLink} className="w-full py-3 rounded-xl text-sm font-bold" style={{ backgroundColor: '#1B2A6B', color: '#FFFFFF' }}>
            Share with friends
          </button>
        </div>
      )}

      <div className="px-4 mt-8 mb-4 text-center">
        <p className="text-[11px]" style={{ color: '#8890A6' }}>Built by Shalini with Claude AI</p>
        <p className="text-[9px] mt-1" style={{ color: '#B0B6C8' }}>IPL Predict 2026 v1.0</p>
      </div>
    </motion.div>
  );
}

function Section({ title, children, collapsible, open, onToggle }) {
  const isOpen = collapsible ? open : true;
  return (
    <div className="px-4 mb-4">
      {collapsible ? (
        <button onClick={onToggle} className="flex items-center justify-between w-full mb-2" style={{ minHeight: 'auto' }}>
          <span className="text-[14px] font-bold" style={{ color: '#1A1A2E' }}>{title}</span>
          <span className="text-[12px]" style={{ color: '#8890A6' }}>{isOpen ? '▲' : '▼'}</span>
        </button>
      ) : (
        <h2 className="text-[14px] font-bold mb-3" style={{ color: '#1A1A2E' }}>{title}</h2>
      )}
      {isOpen && children}
    </div>
  );
}
