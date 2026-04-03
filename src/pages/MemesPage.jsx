import { useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useMemes } from '../hooks/useMemes';
import { getClaimedIdentity } from '../lib/identity';
import { TEAM_BRANDING, PLAYERS } from '../lib/constants';

const MEME_TYPE_CONFIG = {
  roast: { icon: '\uD83D\uDD25', label: 'Roast of the Day', bg: 'linear-gradient(135deg, #FFF5F5, #FEE7E7)', iconBg: '#FEE7E7' },
  hype: { icon: '\uD83D\uDC51', label: 'Streak King', bg: 'linear-gradient(135deg, #F0FFF4, #E8F8EE)', iconBg: '#E8F8EE' },
  group_fail: { icon: '\uD83E\uDD21', label: 'Group Fail', bg: 'linear-gradient(135deg, #EEF3FF, #E6EEFF)', iconBg: '#EEF3FF' },
  match_moment: { icon: '\uD83C\uDFCF', label: 'Match Moment', bg: 'linear-gradient(135deg, #FFFBEB, #FEF3C7)', iconBg: '#FFFBEB' },
};

const REACTION_EMOJIS = ['\uD83D\uDE02', '\uD83D\uDD25', '\uD83D\uDC80', '\uD83D\uDC51', '\uD83E\uDD21'];

function formatMatchDate(dateString) {
  if (!dateString) return '';
  const date = new Date(dateString);
  return new Intl.DateTimeFormat('en-IN', { day: 'numeric', month: 'short' }).format(date).toUpperCase();
}

function highlightText(text) {
  // Highlight player names and team codes in meme text
  const teamCodes = Object.keys(TEAM_BRANDING);
  let parts = [text];

  // Split by player names
  for (const player of PLAYERS) {
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return [part];
      const regex = new RegExp(`(${player})`, 'gi');
      return part.split(regex).map((seg, i) =>
        regex.test(seg) ? { type: 'player', text: seg, key: `p-${player}-${i}` } : seg
      );
    });
  }

  // Split by team codes
  for (const code of teamCodes) {
    parts = parts.flatMap((part) => {
      if (typeof part !== 'string') return [part];
      const regex = new RegExp(`\\b(${code})\\b`, 'g');
      return part.split(regex).map((seg, i) =>
        regex.test(seg) ? { type: 'team', text: seg, code: seg, key: `t-${code}-${i}` } : seg
      );
    });
  }

  return parts.map((part, i) => {
    if (typeof part === 'string') return <span key={i}>{part}</span>;
    if (part.type === 'player') {
      return <span key={part.key} style={{ color: '#1B2A6B', fontWeight: 800 }}>{part.text}</span>;
    }
    if (part.type === 'team') {
      const brand = TEAM_BRANDING[part.code];
      return <span key={part.key} style={{ color: brand?.primary || '#1B2A6B', fontWeight: 800 }}>{part.text}</span>;
    }
    return <span key={i}>{part}</span>;
  });
}

export default function MemesPage() {
  const [searchParams] = useSearchParams();
  const urlUser = searchParams.get('user');
  const currentUser = urlUser || getClaimedIdentity();
  const [activeModel, setActiveModel] = useState('grok');

  const { memes: groupedMemes, loading, modelStats, reactToMeme } = useMemes(activeModel);

  return (
    <div className="pb-[72px]" style={{ backgroundColor: '#F5F6FA', minHeight: '100vh' }}>
      {/* Header */}
      <div className="px-4 pt-5 pb-2">
        <h1 className="font-extrabold" style={{ fontSize: 18, color: '#1A1A2E' }}>
          Meme Zone <span style={{ fontSize: 16 }}>{'\uD83D\uDD25'}</span>
        </h1>
        <p className="text-xs mt-0.5" style={{ color: '#8890A6' }}>Auto-generated after every match</p>
      </div>

      {/* Model Tabs */}
      <div className="mx-4 mt-3 mb-3">
        <div className="flex p-[3px] rounded-[10px]" style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}>
          <button
            onClick={() => setActiveModel('grok')}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{
              backgroundColor: activeModel === 'grok' ? '#1B2A6B' : 'transparent',
              color: activeModel === 'grok' ? '#FFFFFF' : '#8890A6',
              minHeight: 36,
            }}
          >
            {'\uD83E\uDD16'} Grok
          </button>
          <button
            onClick={() => setActiveModel('gemini')}
            className="flex-1 py-2 rounded-lg text-xs font-bold transition-colors"
            style={{
              backgroundColor: activeModel === 'gemini' ? '#1B2A6B' : 'transparent',
              color: activeModel === 'gemini' ? '#FFFFFF' : '#8890A6',
              minHeight: 36,
            }}
          >
            {'\u2728'} Gemini
          </button>
        </div>
      </div>

      {/* Model Score Banner */}
      <div className="mx-4 mb-3 px-3.5 py-2 rounded-lg flex items-center justify-center gap-3" style={{ backgroundColor: '#EEF3FF', fontSize: 11, fontWeight: 600, color: '#1B2A6B' }}>
        <span style={{ fontWeight: modelStats.grok.totalReactions >= modelStats.gemini.totalReactions ? 800 : 600 }}>
          {'\uD83E\uDD16'} Grok: {modelStats.grok.totalReactions} reactions
        </span>
        <span style={{ color: '#8890A6' }}>vs</span>
        <span style={{ fontWeight: modelStats.gemini.totalReactions >= modelStats.grok.totalReactions ? 800 : 600 }}>
          {'\u2728'} Gemini: {modelStats.gemini.totalReactions} reactions
        </span>
      </div>

      {/* Content */}
      {loading ? (
        <LoadingSkeleton />
      ) : groupedMemes.length === 0 ? (
        <EmptyState />
      ) : (
        <div className="px-4 space-y-5 pb-4">
          <AnimatePresence>
            {groupedMemes.map((group) => (
              <MatchGroup
                key={group.match_number}
                group={group}
                currentUser={currentUser}
                reactToMeme={reactToMeme}
                activeModel={activeModel}
              />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  );
}

function MatchGroup({ group, currentUser, reactToMeme, activeModel }) {
  const match = group.match;
  const team1Brand = TEAM_BRANDING[match?.team1] || {};
  const team2Brand = TEAM_BRANDING[match?.team2] || {};

  return (
    <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3 }}>
      {/* Match header */}
      <div className="flex items-center gap-2 mb-2.5">
        <div className="w-2 h-2 rounded-full" style={{ backgroundColor: '#16A34A' }} />
        <span className="text-[10px] font-bold tracking-wider" style={{ color: '#4A5068' }}>
          MATCH {group.match_number}
        </span>
        <span className="text-[10px] font-bold" style={{ color: '#1A1A2E' }}>
          {match?.team1} vs {match?.team2}
        </span>
        <span className="text-[10px] font-semibold uppercase" style={{ color: '#16A34A' }}>
          {match?.winner} won
        </span>
        <span className="ml-auto text-[9px] font-bold px-1.5 py-0.5 rounded" style={{ backgroundColor: '#F0F1F5', color: '#4A5068' }}>
          {formatMatchDate(match?.match_date)}
        </span>
      </div>

      {/* Meme cards */}
      <div className="space-y-3">
        {group.memes.map((meme) => (
          <MemeCard key={meme.id} meme={meme} currentUser={currentUser} reactToMeme={reactToMeme} />
        ))}
      </div>
    </motion.div>
  );
}

function MemeCard({ meme, currentUser, reactToMeme }) {
  const config = MEME_TYPE_CONFIG[meme.meme_type] || MEME_TYPE_CONFIG.match_moment;
  const reactions = meme.reactions || {};
  const modelBadge = meme.model === 'grok'
    ? { label: '\uD83E\uDD16 GROK', bg: '#F0F1F5', color: '#4A5068' }
    : { label: '\u2728 GEMINI', bg: '#EEF3FF', color: '#1B2A6B' };

  function handleShare() {
    const shareText = `\uD83C\uDFCF IPL Predict - Match #${meme.match_number}\n\n${meme.meme_text}\n\n\u2014 ${meme.template_ref || ''}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.97 }}
      animate={{ opacity: 1, scale: 1 }}
      className="rounded-xl overflow-hidden"
      style={{ backgroundColor: '#FFFFFF', border: '1px solid #E8EAF0' }}
    >
      {/* Card header */}
      <div className="px-3.5 py-2.5 flex items-center gap-2" style={{ borderBottom: '1px solid #F0F1F5' }}>
        <span className="w-6 h-6 rounded-lg flex items-center justify-center text-sm" style={{ backgroundColor: config.iconBg }}>
          {config.icon}
        </span>
        <span className="text-xs font-bold" style={{ color: '#1A1A2E' }}>{config.label}</span>
        <span className="text-[8px] font-bold px-1.5 py-0.5 rounded-full" style={{ backgroundColor: modelBadge.bg, color: modelBadge.color }}>
          {modelBadge.label}
        </span>
        {meme.target_player && (
          <span className="ml-auto text-[10px] font-semibold" style={{ color: '#8890A6' }}>
            Target: {meme.target_player}
          </span>
        )}
      </div>

      {/* Card body */}
      <div className="px-4 py-4" style={{ background: config.bg }}>
        <p className="font-bold leading-relaxed" style={{ fontSize: 15 }}>
          {highlightText(meme.meme_text)}
        </p>
        {meme.template_ref && (
          <p className="mt-2.5" style={{ fontSize: 11, color: '#8890A6' }}>
            {'\u2014'} {(() => {
              const match = meme.template_ref.match(/^(\w+)\s+energy\s*[—-]\s*(.*)$/i);
              if (match) {
                return (
                  <>
                    <span style={{ fontWeight: 700, color: '#4A5068' }}>{match[1]} energy</span>
                    {match[2] && <span style={{ fontStyle: 'italic' }}> {match[2]}</span>}
                  </>
                );
              }
              return <span style={{ fontStyle: 'italic' }}>{meme.template_ref}</span>;
            })()}
          </p>
        )}
      </div>

      {/* Card footer */}
      <div className="px-3.5 py-2 flex items-center justify-between" style={{ borderTop: '1px solid #F0F1F5' }}>
        <div className="flex items-center gap-2.5">
          {REACTION_EMOJIS.map((emoji) => {
            const users = reactions[emoji] || [];
            const hasReacted = currentUser && users.includes(currentUser);
            if (users.length === 0 && !hasReacted) {
              // Show emoji button even with 0 count for interaction
              return (
                <button
                  key={emoji}
                  onClick={() => currentUser && reactToMeme(meme.id, emoji, currentUser)}
                  className="flex items-center gap-0.5 px-1.5 py-1 rounded-full transition-colors"
                  style={{
                    backgroundColor: 'transparent',
                    minHeight: 28,
                    opacity: 0.5,
                  }}
                >
                  <span style={{ fontSize: 14 }}>{emoji}</span>
                </button>
              );
            }
            return (
              <button
                key={emoji}
                onClick={() => currentUser && reactToMeme(meme.id, emoji, currentUser)}
                className="flex items-center gap-0.5 px-1.5 py-1 rounded-full transition-colors"
                style={{
                  backgroundColor: hasReacted ? '#EEF3FF' : '#F5F6FA',
                  border: hasReacted ? '1px solid #D5DDF5' : '1px solid transparent',
                  minHeight: 28,
                }}
              >
                <span style={{ fontSize: 14 }}>{emoji}</span>
                <span className="font-bold" style={{ fontSize: 11, color: hasReacted ? '#1B2A6B' : '#8890A6' }}>
                  {users.length}
                </span>
              </button>
            );
          })}
        </div>
        <button
          onClick={handleShare}
          className="text-[10px] font-bold px-2.5 py-1.5 rounded-lg"
          style={{ backgroundColor: '#E8F8EE', color: '#16A34A', minHeight: 28 }}
        >
          Share to WA
        </button>
      </div>
    </motion.div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="px-4 space-y-4">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl overflow-hidden" style={{ border: '1px solid #E8EAF0' }}>
          <div className="h-10 animate-pulse" style={{ backgroundColor: '#F0F1F5' }} />
          <div className="h-24 animate-pulse" style={{ background: 'linear-gradient(135deg, #FFF5F5, #FEE7E7)' }} />
          <div className="h-10 animate-pulse" style={{ backgroundColor: '#F0F1F5' }} />
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
      <span style={{ fontSize: 40 }}>{'\uD83C\uDFCF'}</span>
      <p className="text-sm font-bold mt-3" style={{ color: '#1A1A2E' }}>No memes yet</p>
      <p className="text-xs mt-1" style={{ color: '#8890A6' }}>
        They'll appear after the first match result!
      </p>
    </div>
  );
}
