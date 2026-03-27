import { useState, useEffect, useCallback, useMemo } from 'react';
import { supabase } from '../lib/supabase';

export function useMemes(modelFilter = 'grok') {
  const [memes, setMemes] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch all memes
  useEffect(() => {
    async function fetchMemes() {
      const { data } = await supabase
        .from('memes')
        .select('*, matches(team1, team2, winner, result_text, match_date, venue, status)')
        .order('match_number', { ascending: false })
        .order('created_at', { ascending: false });
      setMemes(data || []);
      setLoading(false);
    }
    fetchMemes();

    // Realtime subscription
    const channel = supabase
      .channel('memes-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'memes' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          // Fetch the full meme with join
          supabase
            .from('memes')
            .select('*, matches(team1, team2, winner, result_text, match_date, venue, status)')
            .eq('id', payload.new.id)
            .single()
            .then(({ data }) => {
              if (data) setMemes((prev) => [data, ...prev]);
            });
        } else if (payload.eventType === 'UPDATE') {
          setMemes((prev) => prev.map((m) => (m.id === payload.new.id ? { ...m, ...payload.new } : m)));
        } else if (payload.eventType === 'DELETE') {
          setMemes((prev) => prev.filter((m) => m.id !== payload.old.id));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Filter by model
  const filteredMemes = useMemo(() => {
    if (modelFilter === 'all') return memes;
    return memes.filter((m) => m.model === modelFilter);
  }, [memes, modelFilter]);

  // Group by match_number
  const groupedMemes = useMemo(() => {
    const groups = {};
    for (const meme of filteredMemes) {
      if (!groups[meme.match_number]) {
        groups[meme.match_number] = {
          match_number: meme.match_number,
          match: meme.matches,
          memes: [],
        };
      }
      groups[meme.match_number].memes.push(meme);
    }
    return Object.values(groups).sort((a, b) => b.match_number - a.match_number);
  }, [filteredMemes]);

  // Model stats — total reactions per model
  const modelStats = useMemo(() => {
    const stats = { grok: { totalReactions: 0 }, gemini: { totalReactions: 0 } };
    for (const meme of memes) {
      const reactions = meme.reactions || {};
      const count = Object.values(reactions).reduce((sum, arr) => sum + (Array.isArray(arr) ? arr.length : 0), 0);
      if (stats[meme.model]) {
        stats[meme.model].totalReactions += count;
      }
    }
    return stats;
  }, [memes]);

  // React to a meme
  const reactToMeme = useCallback(async (memeId, emoji, userName) => {
    const meme = memes.find((m) => m.id === memeId);
    if (!meme) return;

    const reactions = { ...(meme.reactions || {}) };
    const emojiList = reactions[emoji] || [];

    // Toggle
    if (emojiList.includes(userName)) {
      reactions[emoji] = emojiList.filter((n) => n !== userName);
    } else {
      reactions[emoji] = [...emojiList, userName];
    }

    // Clean up empty arrays
    if (reactions[emoji]?.length === 0) delete reactions[emoji];

    // Optimistic update
    setMemes((prev) => prev.map((m) => (m.id === memeId ? { ...m, reactions } : m)));

    await supabase.from('memes').update({ reactions }).eq('id', memeId);
  }, [memes]);

  return { memes: groupedMemes, allMemes: memes, loading, modelStats, reactToMeme };
}
