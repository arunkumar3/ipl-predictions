import { useState, useEffect, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getClaimedIdentity } from '../lib/identity';

export function usePredictions(userName) {
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!userName) { setLoading(false); return; }

    async function fetchPredictions() {
      const { data, error: fetchError } = await supabase
        .from('predictions').select('*').eq('user_name', userName);
      if (fetchError) { setError(fetchError.message); }
      else {
        const map = {};
        data.forEach((p) => { map[p.match_number] = p; });
        setPredictions(map);
      }
      setLoading(false);
    }
    fetchPredictions();
  }, [userName]);

  useEffect(() => {
    if (!userName) return;
    const channel = supabase
      .channel(`predictions-${userName}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions', filter: `user_name=eq.${userName}` },
        (payload) => {
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            setPredictions((prev) => ({ ...prev, [payload.new.match_number]: payload.new }));
          } else if (payload.eventType === 'DELETE') {
            setPredictions((prev) => { const next = { ...prev }; delete next[payload.old.match_number]; return next; });
          }
        }
      ).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [userName]);

  const savePrediction = useCallback(
    async (matchNumber, team) => {
      if (!userName) return;

      // Identity guard: only allow saving for own profile
      const claimed = getClaimedIdentity();
      if (claimed !== userName) {
        console.warn('Cannot modify another user\'s predictions');
        return;
      }

      // Optimistic update
      const previous = predictions[matchNumber];
      setPredictions((prev) => ({
        ...prev,
        [matchNumber]: { ...prev[matchNumber], user_name: userName, match_number: matchNumber, predicted_team: team },
      }));
      setError(null);

      const { error: upsertError } = await supabase
        .from('predictions')
        .upsert({ user_name: userName, match_number: matchNumber, predicted_team: team }, { onConflict: 'user_name,match_number' });

      if (upsertError) {
        if (previous) setPredictions((prev) => ({ ...prev, [matchNumber]: previous }));
        else setPredictions((prev) => { const next = { ...prev }; delete next[matchNumber]; return next; });
        setError(upsertError.message);
      }
    },
    [userName, predictions]
  );

  return { predictions, savePrediction, loading, error };
}
