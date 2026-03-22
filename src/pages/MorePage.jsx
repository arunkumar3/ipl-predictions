import { useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { PLAYERS, FULL_SEASON_MAX_POINTS } from '../lib/constants';
import { useToast } from '../components/Toast';
import { buildUrl } from '../lib/utils';

export default function MorePage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const userName = searchParams.get('user');
  const showToast = useToast();
  const [rulesOpen, setRulesOpen] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  function switchPlayer(name) {
    navigate(buildUrl('/', name));
  }

  function shareLink() {
    const url = `${window.location.origin}/?user=${userName}`;
    navigator.clipboard.writeText(url).then(() => {
      showToast('Link copied!', 'success');
    }).catch(() => {
      showToast('Could not copy link', 'error');
    });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="pb-[72px]"
    >
      <div className="px-4 pt-5 pb-3">
        <h1 className="text-xl font-extrabold" style={{ color: '#F1F5F9' }}>More</h1>
        <p className="text-[10px] font-bold uppercase" style={{ color: '#C8E629', letterSpacing: '2px' }}>
          Settings & Info
        </p>
      </div>

      {/* Switch player */}
      <Section title="Switch player">
        <div className="flex flex-wrap gap-2">
          {PLAYERS.map((name) => (
            <button
              key={name}
              onClick={() => switchPlayer(name)}
              className="px-4 py-2 rounded-lg text-sm font-bold"
              style={{
                backgroundColor: name === userName ? 'rgba(200,230,41,0.12)' : 'rgba(200,230,41,0.04)',
                color: name === userName ? '#C8E629' : '#6B7EB0',
                border: name === userName ? '1px solid rgba(200,230,41,0.25)' : '1px solid rgba(200,230,41,0.06)',
              }}
            >
              {name}
              {name === userName && ' ✓'}
            </button>
          ))}
        </div>
      </Section>

      {/* Scoring rules */}
      <Section title="Scoring rules" collapsible open={rulesOpen} onToggle={() => setRulesOpen(!rulesOpen)}>
        <div className="rounded-xl p-3" style={{ backgroundColor: '#142055' }}>
          <table className="w-full text-[12px]">
            <tbody>
              {[
                ['League matches', '+1 point'],
                ['Qualifier 1 & 2', '+2 points'],
                ['Eliminator', '+2 points'],
                ['Final', '+3 points'],
                ['Wrong prediction', '0 points'],
                ['No prediction', '0 points'],
                ['Max possible (full season)', `${FULL_SEASON_MAX_POINTS} points`],
              ].map(([label, value], i) => (
                <tr key={i} style={{ borderBottom: i < 6 ? '1px solid rgba(200,230,41,0.04)' : 'none' }}>
                  <td className="py-1.5" style={{ color: '#9CAED4' }}>{label}</td>
                  <td className="py-1.5 text-right font-mono-num font-bold" style={{ color: i === 6 ? '#C8E629' : '#F1F5F9' }}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Section>

      {/* How it works */}
      <Section title="How it works" collapsible open={howOpen} onToggle={() => setHowOpen(!howOpen)}>
        <div className="space-y-2.5">
          {[
            'Predict the winner of each IPL 2026 match',
            'Predictions lock when the match starts',
            'Points awarded when results come in',
            'Compete with your friends on the leaderboard',
          ].map((text, i) => (
            <div key={i} className="flex items-start gap-2">
              <span className="font-mono-num text-[10px] font-bold shrink-0 mt-0.5" style={{ color: '#C8E629' }}>{i + 1}.</span>
              <span className="text-[12px]" style={{ color: '#9CAED4' }}>{text}</span>
            </div>
          ))}
        </div>
      </Section>

      {/* Share link */}
      {userName && (
        <div className="px-4 mb-4">
          <button
            onClick={shareLink}
            className="w-full py-3 rounded-xl text-sm font-bold"
            style={{
              backgroundColor: 'rgba(200,230,41,0.08)',
              color: '#C8E629',
              border: '1px solid rgba(200,230,41,0.15)',
            }}
          >
            Share with friends
          </button>
        </div>
      )}

      {/* Credits */}
      <div className="px-4 mt-8 mb-4 text-center">
        <p className="text-[11px]" style={{ color: '#6B7EB0' }}>
          Built by Shalini with Claude AI
        </p>
        <p className="text-[9px] mt-1" style={{ color: '#4A5A8A' }}>
          IPL Predict 2026 v1.0
        </p>
      </div>
    </motion.div>
  );
}

function Section({ title, children, collapsible, open, onToggle }) {
  const isOpen = collapsible ? open : true;

  return (
    <div className="px-4 mb-4">
      {collapsible ? (
        <button
          onClick={onToggle}
          className="flex items-center justify-between w-full mb-2"
          style={{ minHeight: 'auto' }}
        >
          <span className="text-[14px] font-bold" style={{ color: '#F1F5F9' }}>{title}</span>
          <span className="text-[12px]" style={{ color: '#6B7EB0' }}>{isOpen ? '▲' : '▼'}</span>
        </button>
      ) : (
        <h2 className="text-[14px] font-bold mb-3" style={{ color: '#F1F5F9' }}>{title}</h2>
      )}
      {isOpen && children}
    </div>
  );
}
