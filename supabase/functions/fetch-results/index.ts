// Supabase Edge Function — Deno runtime
// Fetches match results from ESPN / ESPNCricinfo APIs and updates the matches table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// ESPN sometimes uses different abbreviations than our database
const ABBREV_MAP: Record<string, string> = {
  PK: 'PBKS', PBKS: 'PBKS',
  LKN: 'LSG', LSG: 'LSG',
  HYD: 'SRH', SRH: 'SRH',
  BLR: 'RCB', RCB: 'RCB',
  DEL: 'DC', DC: 'DC',
  GUJ: 'GT', GT: 'GT',
  MI: 'MI', CSK: 'CSK', KKR: 'KKR', RR: 'RR',
};

function mapAbbrev(abbrev: string): string | null {
  return ABBREV_MAP[abbrev] || ABBREV_MAP[abbrev.toUpperCase()] || null;
}

// ============================================================
// ESPN Public API (Approach 1)
// ============================================================
async function fetchFromESPN(espnMatchId: string): Promise<{ completed: boolean; live: boolean; winner: string | null; resultText: string } | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/cricket/8048/summary?event=${espnMatchId}`;
  console.log(`[ESPN] Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.log(`[ESPN] HTTP ${res.status} for event ${espnMatchId}`);
    return null;
  }

  const data = await res.json();
  const competition = data?.header?.competitions?.[0];
  if (!competition) {
    console.log(`[ESPN] No competition data for event ${espnMatchId}`);
    return null;
  }

  const statusType = competition.status?.type || {};
  const state = statusType.state; // "pre", "in", "post"
  const resultText = statusType.detail || statusType.shortDetail || '';
  const completed = statusType.completed === true
    || state === 'post'
    || resultText === 'Final'
    || (resultText && resultText.includes('won by'));
  const live = !completed && state === 'in';

  let winner: string | null = null;
  if (completed) {
    const competitors = competition.competitors || [];
    console.log(`[ESPN] Raw response for event ${espnMatchId}:`, JSON.stringify({
      state: statusType.state,
      detail: statusType.detail,
      completed: statusType.completed,
      competitors: competitors.map((c: any) => (c.team?.abbreviation || '?') + ' winner=' + c.winner),
    }));

    // ESPN may return winner as boolean true OR string "true"
    const winnerTeam = competitors.find((c: any) => c.winner === true || c.winner === 'true');
    if (winnerTeam) {
      const abbrev = winnerTeam.team?.abbreviation || '';
      winner = mapAbbrev(abbrev);
      console.log(`[ESPN] Winner abbreviation: ${abbrev} → mapped: ${winner}`);
    }

    // Fallback: parse winner from result text ("SRH won by 23 runs")
    if (!winner && resultText) {
      for (const [abbrev, code] of Object.entries(ABBREV_MAP)) {
        if (resultText.startsWith(abbrev + ' ') || resultText.includes(abbrev + ' won')) {
          winner = code;
          console.log(`[ESPN] Winner parsed from resultText: ${resultText} → ${winner}`);
          break;
        }
      }
    }
  }

  console.log(`[ESPN] event=${espnMatchId} state=${state} completed=${completed} live=${live} winner=${winner}`);
  return { completed, live, winner, resultText };
}

// ============================================================
// ESPNCricinfo API (Approach 2 — fallback)
// ============================================================
async function fetchFromCricinfo(espnMatchId: string): Promise<{ completed: boolean; live: boolean; winner: string | null; resultText: string } | null> {
  const url = `https://hs-consumer-api.espncricinfo.com/v1/pages/match/details?lang=en&seriesId=1510719&matchId=${espnMatchId}`;
  console.log(`[CricInfo] Fetching: ${url}`);

  const res = await fetch(url);
  if (!res.ok) {
    console.log(`[CricInfo] HTTP ${res.status} for match ${espnMatchId}`);
    return null;
  }

  const data = await res.json();
  const match = data?.match;
  if (!match) {
    console.log(`[CricInfo] No match data for ${espnMatchId}`);
    return null;
  }

  const state = match.state; // "PRE", "LIVE", "POST"
  const completed = state === 'POST';
  const live = state === 'LIVE';
  const resultText = match.statusText || '';

  let winner: string | null = null;
  if (completed && match.teams) {
    const winnerTeam = match.teams.find((t: any) => t.isWinner === true);
    if (winnerTeam) {
      const abbrev = winnerTeam.team?.abbreviation || '';
      winner = mapAbbrev(abbrev);
      console.log(`[CricInfo] Winner abbreviation: ${abbrev} → mapped: ${winner}`);
    }
  }

  console.log(`[CricInfo] match=${espnMatchId} state=${state} completed=${completed} live=${live} winner=${winner}`);
  return { completed, live, winner, resultText };
}

// ============================================================
// MAIN HANDLER
// ============================================================
Deno.serve(async (req) => {
  // CORS must be FIRST
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      },
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  // Parse optional match_number from request body
  let match_number: number | null = null;
  try {
    const body = await req.json();
    match_number = body?.match_number || null;
  } catch {
    // No body or invalid JSON — that's fine, check all recent matches
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  // 1. Get matches that need checking
  let pendingMatches: any[] | null = null;

  if (match_number) {
    // Specific match requested — skip date filter
    const { data } = await supabase
      .from('matches')
      .select('*')
      .eq('match_number', match_number);
    pendingMatches = data;
    console.log(`[fetch-results] Manual check for match #${match_number}`);
  } else {
    // Normal: live matches always, upcoming only if scheduled in last 24h
    const now = new Date().toISOString();
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const { data } = await supabase
      .from('matches')
      .select('*')
      .or(`and(status.eq.upcoming,match_date.lte.${now},match_date.gte.${oneDayAgo}),status.eq.live`)
      .order('match_number');
    pendingMatches = data;
  }

  if (!pendingMatches?.length) {
    return new Response(
      JSON.stringify({ message: 'No pending matches', checked: 0, updated: 0, matches: [] }),
      { headers: corsHeaders },
    );
  }

  console.log(`[fetch-results] Checking ${pendingMatches.length} matches...`);

  const results: any[] = [];

  for (const match of pendingMatches) {
    const espnId = match.espn_match_id;
    if (!espnId) {
      console.log(`[fetch-results] Match #${match.match_number} has no espn_match_id, skipping`);
      results.push({ match: match.match_number, skipped: true, reason: 'no espn_match_id' });
      continue;
    }

    try {
      // Try ESPN first, then CricInfo fallback
      let result = await fetchFromESPN(espnId);
      let source = 'espn';

      if (!result) {
        console.log(`[fetch-results] ESPN failed for match #${match.match_number}, trying CricInfo...`);
        result = await fetchFromCricinfo(espnId);
        source = 'cricinfo';
      }

      if (!result) {
        console.log(`[fetch-results] Both APIs failed for match #${match.match_number}`);
        results.push({ match: match.match_number, error: 'Both APIs returned no data' });
        continue;
      }

      if (result.completed && result.winner) {
        // Match completed — update DB
        await supabase
          .from('matches')
          .update({
            winner: result.winner,
            result_text: result.resultText,
            status: 'completed',
            updated_at: new Date().toISOString(),
          })
          .eq('match_number', match.match_number);

        console.log(`[fetch-results] ✅ Match #${match.match_number}: ${result.winner} won (via ${source})`);

        // Trigger meme generation (fire-and-forget)
        try {
          await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-memes`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ match_number: match.match_number }),
          });
          console.log(`[fetch-results] Meme generation triggered for match #${match.match_number}`);
        } catch (err) {
          console.error(`[fetch-results] Meme generation failed for match #${match.match_number}:`, err);
        }

        results.push({ match: match.match_number, winner: result.winner, resultText: result.resultText, source });
      } else if (result.live && match.status !== 'live') {
        // Match is live — update status
        await supabase
          .from('matches')
          .update({ status: 'live', updated_at: new Date().toISOString() })
          .eq('match_number', match.match_number);

        console.log(`[fetch-results] 🔴 Match #${match.match_number} is now LIVE (via ${source})`);
        results.push({ match: match.match_number, status: 'live', source });
      } else {
        results.push({ match: match.match_number, status: 'no_change', source });
      }
    } catch (err) {
      console.error(`[fetch-results] Error on match #${match.match_number}:`, err);
      results.push({ match: match.match_number, error: String(err) });
    }

    // Courtesy delay between API calls
    await new Promise((r) => setTimeout(r, 500));
  }

  const updated = results.filter((r) => r.winner || r.status === 'live').length;
  console.log(`[fetch-results] Done. Checked ${pendingMatches.length}, updated ${updated}`);

  return new Response(
    JSON.stringify({ checked: pendingMatches.length, updated, matches: results }),
    { headers: corsHeaders },
  );
});
