import { useState, useEffect, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import { PLAYERS, getMatchPoints, getMaxPoints } from '../lib/constants';

export function useLeaderboard() {
  const [allPredictions, setAllPredictions] = useState([]);
  const [allMatches, setAllMatches] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchAll() {
      const [predsRes, matchesRes] = await Promise.all([
        supabase.from('predictions').select('*'),
        supabase.from('matches').select('*').order('match_number'),
      ]);

      if (predsRes.data) setAllPredictions(predsRes.data);
      if (matchesRes.data) setAllMatches(matchesRes.data);
      setLoading(false);
    }

    fetchAll();

    // Subscribe to real-time changes on both tables
    const predsChannel = supabase
      .channel('lb-predictions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'predictions' }, () => {
        supabase.from('predictions').select('*').then(({ data }) => {
          if (data) setAllPredictions(data);
        });
      })
      .subscribe();

    const matchesChannel = supabase
      .channel('lb-matches')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'matches' }, () => {
        supabase.from('matches').select('*').order('match_number').then(({ data }) => {
          if (data) setAllMatches(data);
        });
      })
      .subscribe();

    return () => {
      supabase.removeChannel(predsChannel);
      supabase.removeChannel(matchesChannel);
    };
  }, []);

  const leaderboard = useMemo(() => {
    const completedMatches = allMatches
      .filter((m) => m.status === 'completed' && m.winner)
      .sort((a, b) => a.match_number - b.match_number);

    const totalMatches = allMatches.length;
    const completedCount = completedMatches.length;

    // First pass: compute all stats
    const entries = PLAYERS.map((player) => {
      const playerPreds = allPredictions.filter((p) => p.user_name === player);
      const predsByMatch = {};
      playerPreds.forEach((p) => {
        predsByMatch[p.match_number] = p;
      });

      let points = 0;
      let correct = 0;
      let currentStreak = 0;
      let bestStreak = 0;

      const results = [];

      for (const match of completedMatches) {
        const pred = predsByMatch[match.match_number];
        if (pred) {
          const isCorrect = pred.predicted_team === match.winner;
          results.push(isCorrect);
          if (isCorrect) {
            correct++;
            points += getMatchPoints(match.stage);
          }
        } else {
          results.push(null);
        }
      }

      // Current streak (from most recent backwards, skip nulls/missing predictions)
      for (let i = results.length - 1; i >= 0; i--) {
        if (results[i] === null) continue; // skip matches with no prediction
        if (results[i] === true) currentStreak++;
        else break;
      }

      // Best streak (skip nulls)
      let tempStreak = 0;
      for (const r of results) {
        if (r === null) continue; // skip matches with no prediction
        if (r === true) {
          tempStreak++;
          if (tempStreak > bestStreak) bestStreak = tempStreak;
        } else {
          tempStreak = 0;
        }
      }

      const totalPredictions = playerPreds.length;
      const completedPredicted = completedMatches.filter(
        (m) => predsByMatch[m.match_number]
      ).length;
      const accuracy = completedPredicted > 0 ? Math.round((correct / completedPredicted) * 100) : 0;

      // Last 5 form
      const predictedResults = results.filter((r) => r !== null);
      const formLast5 = predictedResults.slice(-5);

      // Points excluding last completed match (for trend calculation)
      let pointsExcludingLast = 0;
      let accuracyExcludingLast = 0;
      if (completedMatches.length > 0) {
        let correctExcl = 0;
        let predExcl = 0;
        const allButLast = completedMatches.slice(0, -1);
        for (const match of allButLast) {
          const pred = predsByMatch[match.match_number];
          if (pred) {
            predExcl++;
            if (pred.predicted_team === match.winner) {
              correctExcl++;
              pointsExcludingLast += getMatchPoints(match.stage);
            }
          }
        }
        accuracyExcludingLast = predExcl > 0 ? Math.round((correctExcl / predExcl) * 100) : 0;
      }

      return {
        name: player,
        points,
        correct,
        totalPredictions,
        completedPredicted,
        accuracy,
        currentStreak,
        bestStreak,
        formLast5,
        pointsExcludingLast,
        accuracyExcludingLast,
      };
    });

    // Sort and assign ranks (different rank unless both points AND accuracy match)
    const sorted = entries
      .sort((a, b) => b.points - a.points || b.accuracy - a.accuracy || a.name.localeCompare(b.name))
      .map((entry, idx, arr) => ({
        ...entry,
        rank: idx === 0 || arr[idx - 1].points !== entry.points || arr[idx - 1].accuracy !== entry.accuracy
          ? idx + 1 : arr[idx - 1].rank,
      }));

    // Compute previous ranks for trend
    const prevSorted = [...entries]
      .sort((a, b) =>
        b.pointsExcludingLast - a.pointsExcludingLast ||
        b.accuracyExcludingLast - a.accuracyExcludingLast ||
        a.name.localeCompare(b.name)
      )
      .map((entry, idx, arr) => ({
        name: entry.name,
        prevRank: idx === 0 || arr[idx - 1]?.pointsExcludingLast !== entry.pointsExcludingLast
          ? idx + 1 : arr[idx - 1].prevRank,
      }));

    const prevRankMap = {};
    prevSorted.forEach((e) => { prevRankMap[e.name] = e.prevRank; });

    const withTrend = sorted.map((entry) => {
      const prevRank = prevRankMap[entry.name];
      let trend = 0;
      if (completedCount > 0 && prevRank !== undefined) {
        trend = prevRank - entry.rank;
      }
      return { ...entry, trend };
    });

    const maxPointsSoFar = getMaxPoints(completedMatches);
    const maxPointsSeeded = getMaxPoints(allMatches);

    return { entries: withTrend, totalMatches, completedCount, maxPointsSoFar, maxPointsSeeded };
  }, [allPredictions, allMatches]);

  return {
    leaderboard: leaderboard.entries,
    totalMatches: leaderboard.totalMatches,
    completedCount: leaderboard.completedCount,
    maxPointsSoFar: leaderboard.maxPointsSoFar,
    maxPointsSeeded: leaderboard.maxPointsSeeded,
    loading,
  };
}
