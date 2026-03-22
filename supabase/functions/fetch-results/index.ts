// Supabase Edge Function — Deno runtime
// Fetches match results from ESPN API and updates the matches table

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const TEAM_MAP: Record<string, string> = {
  'Royal Challengers Bengaluru': 'RCB',
  'Royal Challengers Bangalore': 'RCB',
  'Mumbai Indians': 'MI',
  'Chennai Super Kings': 'CSK',
  'Kolkata Knight Riders': 'KKR',
  'Rajasthan Royals': 'RR',
  'Sunrisers Hyderabad': 'SRH',
  'Delhi Capitals': 'DC',
  'Punjab Kings': 'PBKS',
  'Gujarat Titans': 'GT',
  'Lucknow Super Giants': 'LSG',
}

Deno.serve(async (_req) => {
  // Create Supabase client with SERVICE ROLE key (needs write access to matches)
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  // 1. Get matches that should have started but don't have results yet
  const { data: pendingMatches } = await supabase
    .from('matches')
    .select('*')
    .in('status', ['upcoming', 'live'])
    .lt('match_date', new Date().toISOString())
    .order('match_number')

  if (!pendingMatches?.length) {
    return new Response(
      JSON.stringify({ message: 'No pending matches', updated: 0 }),
      { headers: { 'Content-Type': 'application/json' } }
    )
  }

  const updates: Array<{ match: number; winner?: string; status?: string; detail?: string }> = []

  for (const match of pendingMatches) {
    try {
      // 2. Call ESPN API
      const espnUrl = `https://site.api.espn.com/apis/site/v2/sports/cricket/8048/summary?event=${match.espn_match_id}`
      const res = await fetch(espnUrl)
      const data = await res.json()

      const competition = data?.header?.competitions?.[0]
      if (!competition) continue

      const stateStr = competition.status?.type?.state // "pre", "in", "post"
      const detail = competition.status?.type?.detail || ''

      if (stateStr === 'post') {
        // Match completed — find winner
        const competitors = competition.competitors || []
        const winnerTeam = competitors.find((c: any) => c.winner === true)

        let winnerCode: string | null = null
        if (winnerTeam) {
          const fullName = winnerTeam.team?.name || winnerTeam.team?.displayName || ''
          winnerCode = TEAM_MAP[fullName] || null
        }

        // Fallback: parse the detail text
        if (!winnerCode && detail) {
          for (const [name, code] of Object.entries(TEAM_MAP)) {
            if (detail.includes(name)) {
              winnerCode = code
              break
            }
          }
        }

        if (winnerCode) {
          await supabase
            .from('matches')
            .update({
              winner: winnerCode,
              result_text: detail,
              status: 'completed',
              updated_at: new Date().toISOString(),
            })
            .eq('match_number', match.match_number)

          updates.push({ match: match.match_number, winner: winnerCode, detail })
        }
      } else if (stateStr === 'in' && match.status !== 'live') {
        // Match is live — update status
        await supabase
          .from('matches')
          .update({ status: 'live', updated_at: new Date().toISOString() })
          .eq('match_number', match.match_number)

        updates.push({ match: match.match_number, status: 'live' })
      }

      // 3. Courtesy delay between API calls
      await new Promise((r) => setTimeout(r, 300))
    } catch (err) {
      console.error(`Error fetching match ${match.match_number}:`, err)
    }
  }

  return new Response(
    JSON.stringify({ updated: updates.length, results: updates }),
    { headers: { 'Content-Type': 'application/json' } }
  )
})
