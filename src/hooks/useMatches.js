import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';

export function useMatches() {
  const [matches, setMatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    async function fetchMatches() {
      const { data, error: fetchError } = await supabase
        .from('matches')
        .select('*')
        .order('match_number');

      if (fetchError) {
        setError(fetchError.message);
      } else {
        setMatches(data);
      }
      setLoading(false);
    }

    fetchMatches();
  }, []);

  useEffect(() => {
    const channel = supabase
      .channel('matches-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'matches' },
        (payload) => {
          if (payload.eventType === 'INSERT') {
            setMatches((prev) => [...prev, payload.new].sort((a, b) => a.match_number - b.match_number));
          } else if (payload.eventType === 'UPDATE') {
            setMatches((prev) =>
              prev.map((m) => (m.id === payload.new.id ? payload.new : m))
            );
          } else if (payload.eventType === 'DELETE') {
            setMatches((prev) => prev.filter((m) => m.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return { matches, loading, error };
}
