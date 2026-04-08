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

// Some APIs block requests without a User-Agent
const FETCH_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (compatible; IPLPredictor/1.0)',
};

type MatchResult = { completed: boolean; live: boolean; winner: string | null; resultText: string };

// Parse a single scoreboard/summary competition node into a MatchResult
function parseCompetition(competition: any, logPrefix: string, eventId: string): MatchResult {
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
    console.log(`${logPrefix} event=${eventId} raw:`, JSON.stringify({
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
      console.log(`${logPrefix} event=${eventId} winner abbrev: ${abbrev} → ${winner}`);
    }

    // Fallback: parse winner from result text ("SRH won by 23 runs")
    if (!winner && resultText) {
      for (const [abbrev, code] of Object.entries(ABBREV_MAP)) {
        if (resultText.startsWith(abbrev + ' ') || resultText.includes(abbrev + ' won')) {
          winner = code;
          console.log(`${logPrefix} event=${eventId} winner from text: ${resultText} → ${winner}`);
          break;
        }
      }
    }
  }

  return { completed, live, winner, resultText };
}

// ============================================================
// ESPN Scoreboard API (Approach 1 — PRIMARY, single call for all matches)
// ============================================================
async function fetchScoreboard(): Promise<Map<string, MatchResult> | null> {
  const url = 'https://site.api.espn.com/apis/site/v2/sports/cricket/8048/scoreboard';
  console.log(`[Scoreboard] Fetching: ${url}`);

  try {
    const res = await fetch(url, { headers: FETCH_HEADERS });
    if (!res.ok) {
      console.log(`[Scoreboard] HTTP ${res.status}`);
      return null;
    }

    const data = await res.json();
    const events = data?.events || [];
    console.log(`[Scoreboard] Found ${events.length} events`);

    const resultsByEventId = new Map<string, MatchResult>();
    for (const event of events) {
      const eventId = String(event.id || '');
      const competition = event.competitions?.[0];
      if (!eventId || !competition) continue;
      resultsByEventId.set(eventId, parseCompetition(competition, '[Scoreboard]', eventId));
    }
    return resultsByEventId;
  } catch (err) {
    console.log(`[Scoreboard] Fetch failed:`, err);
    return null;
  }
}

// ============================================================
// ESPN Summary API (Approach 2 — per-match fallback)
// ============================================================
async function fetchFromESPN(espnMatchId: string): Promise<MatchResult | null> {
  const url = `https://site.api.espn.com/apis/site/v2/sports/cricket/8048/summary?event=${espnMatchId}`;
  console.log(`[ESPN] Fetching: ${url}`);

  const res = await fetch(url, { headers: FETCH_HEADERS });
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

  const result = parseCompetition(competition, '[ESPN]', espnMatchId);
  console.log(`[ESPN] event=${espnMatchId} completed=${result.completed} live=${result.live} winner=${result.winner}`);
  return result;
}

// ============================================================
// ESPNCricinfo API (Approach 2 — fallback)
// ============================================================
async function fetchFromCricinfo(espnMatchId: string): Promise<MatchResult | null> {
  const url = `https://hs-consumer-api.espncricinfo.com/v1/pages/match/details?lang=en&seriesId=1510719&matchId=${espnMatchId}`;
  console.log(`[CricInfo] Fetching: ${url}`);

  const res = await fetch(url, { headers: FETCH_HEADERS });
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
    // Normal: all upcoming + live matches. No date filter — the scoreboard
    // only returns today's/recent matches anyway, so we just intersect it
    // against our full pending list.
    const { data } = await supabase
      .from('matches')
      .select('*')
      .in('status', ['upcoming', 'live'])
      .order('match_number', { ascending: true });
    pendingMatches = data;
  }

  if (!pendingMatches?.length) {
    return new Response(
      JSON.stringify({ message: 'No pending matches', checked: 0, updated: 0, matches: [] }),
      { headers: corsHeaders },
    );
  }

  console.log(`[fetch-results] Checking ${pendingMatches.length} matches...`);

  // PRIMARY: Fetch scoreboard ONCE — contains all current/recent matches in a single call
  const scoreboard = await fetchScoreboard();
  if (scoreboard) {
    console.log(`[fetch-results] Scoreboard loaded with ${scoreboard.size} events`);
  } else {
    console.log(`[fetch-results] Scoreboard unavailable, will fall back to per-match APIs`);
  }

  const results: any[] = [];

  for (const match of pendingMatches) {
    const espnId = match.espn_match_id;
    if (!espnId) {
      console.log(`[fetch-results] Match #${match.match_number} has no espn_match_id, skipping`);
      results.push({ match: match.match_number, skipped: true, reason: 'no espn_match_id' });
      continue;
    }

    try {
      // Try scoreboard first (already fetched), then per-match summary, then CricInfo
      let result: MatchResult | null = scoreboard?.get(String(espnId)) || null;
      let source = result ? 'scoreboard' : '';

      if (!result) {
        console.log(`[fetch-results] Match #${match.match_number} not in scoreboard, trying ESPN summary...`);
        result = await fetchFromESPN(espnId);
        source = 'espn';
      }

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

    // Scoreboard was fetched once up front, so no throttling needed between matches
  }

  const updated = results.filter((r) => r.winner || r.status === 'live').length;
  console.log(`[fetch-results] Done. Checked ${pendingMatches.length}, updated ${updated}`);

  return new Response(
    JSON.stringify({ checked: pendingMatches.length, updated, matches: results }),
    { headers: corsHeaders },
  );
});
