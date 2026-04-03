import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

const PLAYERS = ['Arun', 'Sai', 'Abhi', 'Dinesh', 'Kiran'];

const TEAM_NAMES: Record<string, string> = {
  RCB: 'Royal Challengers Bengaluru', MI: 'Mumbai Indians', CSK: 'Chennai Super Kings',
  KKR: 'Kolkata Knight Riders', RR: 'Rajasthan Royals', SRH: 'Sunrisers Hyderabad',
  DC: 'Delhi Capitals', PBKS: 'Punjab Kings', GT: 'Gujarat Titans', LSG: 'Lucknow Super Giants',
};

// ============================================================
// PATTERN DETECTION FUNCTIONS
// ============================================================

function getTeamBias(playerPreds: any[]) {
  const counts: Record<string, number> = {};
  playerPreds.forEach(p => {
    counts[p.predicted_team] = (counts[p.predicted_team] || 0) + 1;
  });
  return Object.entries(counts).sort((a, b) => b[1] - a[1]);
}

function getStreak(playerName: string, allPreds: any[], completedMatches: any[]) {
  const completed = completedMatches.sort((a: any, b: any) => b.match_number - a.match_number);
  let streak = 0;
  let type = '';
  for (const match of completed) {
    const pred = allPreds.find(p => p.user_name === playerName && p.match_number === match.match_number);
    if (!pred) continue;
    const correct = pred.predicted_team === match.winner;
    if (streak === 0) {
      type = correct ? 'W' : 'L';
      streak = 1;
    } else if ((correct && type === 'W') || (!correct && type === 'L')) {
      streak++;
    } else {
      break;
    }
  }
  return { streak, type };
}

function findPredictionTwins(allPreds: any[], completedMatches: any[]) {
  const results: any[] = [];
  for (let i = 0; i < PLAYERS.length; i++) {
    for (let j = i + 1; j < PLAYERS.length; j++) {
      let same = 0, total = 0, bothWrong = 0;
      completedMatches.forEach((m: any) => {
        const p1 = allPreds.find(p => p.user_name === PLAYERS[i] && p.match_number === m.match_number);
        const p2 = allPreds.find(p => p.user_name === PLAYERS[j] && p.match_number === m.match_number);
        if (p1 && p2) {
          total++;
          if (p1.predicted_team === p2.predicted_team) {
            same++;
            if (p1.predicted_team !== m.winner) bothWrong++;
          }
        }
      });
      if (total >= 3) {
        results.push({
          p1: PLAYERS[i], p2: PLAYERS[j],
          overlap: Math.round(same / total * 100), same, total, bothWrong
        });
      }
    }
  }
  return results.sort((a, b) => b.overlap - a.overlap);
}

function findContrarian(matchPreds: any[], winner: string) {
  const correct = matchPreds.filter(p => p.predicted === winner);
  if (correct.length === 1) return correct[0].player;
  return null;
}

function buildSeasonHistory(allPreds: any[], completedMatches: any[]) {
  const sorted = completedMatches.sort((a: any, b: any) => a.match_number - b.match_number);
  return sorted.map((m: any) => {
    const picks = PLAYERS.map(player => {
      const pred = allPreds.find(p => p.user_name === player && p.match_number === m.match_number);
      if (!pred) return `${player}: —`;
      return `${player}: ${pred.predicted_team} ${pred.predicted_team === m.winner ? '✅' : '❌'}`;
    });
    return `Match ${m.match_number}: ${m.team1} vs ${m.team2} → ${m.winner} won | ${picks.join(' | ')}`;
  }).join('\n');
}

// ============================================================
// MAIN HANDLER
// ============================================================

Deno.serve(async (req) => {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
      }
    });
  }

  const corsHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  const { match_number } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Get this match
  const { data: match } = await supabase
    .from('matches').select('*').eq('match_number', match_number).single();

  if (!match || !match.winner) {
    return new Response(JSON.stringify({ error: 'Match not completed' }), { status: 400, headers: corsHeaders });
  }

  // 2. Check for existing memes (duplicate prevention)
  const { data: existingMemes } = await supabase
    .from('memes').select('model').eq('match_number', match_number);
  const existingModels = [...new Set(existingMemes?.map(m => m.model) || [])];

  // 3. Get ALL data
  const { data: allPredictions } = await supabase.from('predictions').select('*');
  const { data: allMatches } = await supabase.from('matches').select('*').eq('status', 'completed');
  const { data: recentMemes } = await supabase
    .from('memes').select('meme_text, meme_type, target_player')
    .order('created_at', { ascending: false }).limit(10);

  // 4. Build this match's predictions
  const matchPredictions = PLAYERS.map(player => {
    const pred = allPredictions?.find(p => p.user_name === player && p.match_number === match_number);
    return {
      player,
      predicted: pred?.predicted_team || 'NO_PREDICTION',
      correct: pred ? pred.predicted_team === match.winner : false,
    };
  });

  const correctPlayers = matchPredictions.filter(p => p.correct).map(p => p.player);
  const wrongPlayers = matchPredictions.filter(p => !p.correct && p.predicted !== 'NO_PREDICTION').map(p => `${p.player} (picked ${p.predicted})`);
  const noPrediction = matchPredictions.filter(p => p.predicted === 'NO_PREDICTION').map(p => p.player);
  const team1Picks = matchPredictions.filter(p => p.predicted === match.team1).length;
  const team2Picks = matchPredictions.filter(p => p.predicted === match.team2).length;

  // 5. Compute standings
  const standings = PLAYERS.map(player => {
    const preds = allPredictions?.filter(p => p.user_name === player) || [];
    const completed = preds.filter(p => allMatches?.find(m => m.match_number === p.match_number));
    const correct = completed.filter(p => {
      const m = allMatches?.find(m => m.match_number === p.match_number);
      return m && m.winner === p.predicted_team;
    });
    const streak = getStreak(player, allPredictions || [], allMatches || []);
    return {
      player, points: correct.length,
      predicted: completed.length, correct: correct.length,
      accuracy: completed.length > 0 ? Math.round(correct.length / completed.length * 100) : 0,
      streak: streak,
    };
  }).sort((a, b) => b.points - a.points || b.accuracy - a.accuracy);

  // 6. Pattern detection
  const patterns: string[] = [];

  // Team biases
  PLAYERS.forEach(player => {
    const preds = allPredictions?.filter(p => p.user_name === player) || [];
    const bias = getTeamBias(preds);
    if (bias.length > 0 && preds.length >= 5) {
      const top = bias[0];
      const pct = Math.round((top[1] as number) / preds.length * 100);
      if (pct >= 30) {
        patterns.push(`${player} predicted ${top[0]} ${top[1]} times out of ${preds.length} matches (${pct}% — ${top[0]} superfan?)`);
      }
    }
  });

  // Prediction twins
  const twins = findPredictionTwins(allPredictions || [], allMatches || []);
  twins.slice(0, 3).forEach(t => {
    patterns.push(`${t.p1} and ${t.p2} picked the same team ${t.same}/${t.total} times (${t.overlap}% overlap). When they agree, they're wrong ${t.bothWrong} times.`);
  });

  // Contrarian call
  const contrarian = findContrarian(matchPredictions, match.winner);
  if (contrarian) {
    patterns.push(`${contrarian} was the ONLY person who picked ${match.winner} — and was RIGHT. Bold call king.`);
  }

  // Everyone wrong
  if (correctPlayers.length === 0) {
    patterns.push('NOBODY got this match right. Complete group fail. 0/5.');
  }

  // Rank battles
  for (let i = 0; i < standings.length - 1; i++) {
    const diff = standings[i].points - standings[i + 1].points;
    if (diff <= 2) {
      patterns.push(`Rank battle: ${standings[i].player} (${standings[i].points}pts) vs ${standings[i + 1].player} (${standings[i + 1].points}pts) — only ${diff} point${diff !== 1 ? 's' : ''} apart!`);
    }
  }

  // Streaks
  standings.forEach(s => {
    if (s.streak.streak >= 3 && s.streak.type === 'W') {
      patterns.push(`${s.player} is on a ${s.streak.streak}-match winning streak 🔥`);
    }
    if (s.streak.streak >= 3 && s.streak.type === 'L') {
      patterns.push(`${s.player} has gotten ${s.streak.streak} in a row WRONG 💀`);
    }
  });

  // 7. Build full season history
  const seasonHistory = buildSeasonHistory(allPredictions || [], allMatches || []);

  // 8. Build recent memes for anti-repetition
  const antiRepetition = recentMemes?.length
    ? recentMemes.map(m => `- [${m.meme_type}${m.target_player ? ` → ${m.target_player}` : ''}] ${m.meme_text}`).join('\n')
    : 'None yet';

  // 9. Assemble the MEGA context
  const contextBlock = `
=== MATCH RESULT ===
Match #${match.match_number}: ${match.team1} vs ${match.team2}
Winner: ${match.winner} — ${match.result_text || match.winner + ' won'}
Venue: ${match.venue}

=== THIS MATCH'S PREDICTIONS ===
${matchPredictions.map(p => `- ${p.player}: predicted ${p.predicted === 'NO_PREDICTION' ? 'NOTHING (forgot/lazy)' : p.predicted} → ${p.predicted === 'NO_PREDICTION' ? '⚠️ MISSED' : p.correct ? '✅ CORRECT' : '❌ WRONG'}`).join('\n')}
Split: ${team1Picks} picked ${match.team1}, ${team2Picks} picked ${match.team2}, ${noPrediction.length} didn't predict

=== CURRENT STANDINGS (after this match) ===
${standings.map((s, i) => `${i + 1}. ${s.player}: ${s.points}pts | ${s.accuracy}% accuracy | ${s.predicted} predicted | streak: ${s.streak.streak}${s.streak.type} | ${s.correct}/${s.predicted} correct`).join('\n')}

=== FULL SEASON HISTORY (every match, every prediction) ===
${seasonHistory || 'Only this match so far'}

=== DETECTED PATTERNS ===
${patterns.length > 0 ? patterns.join('\n') : 'Not enough data for patterns yet (early season)'}

=== RECENT MEMES (DO NOT repeat these angles or phrases) ===
${antiRepetition}
`;

  // 10. THE SYSTEM PROMPT
  const systemPrompt = `You write WhatsApp-style trash talk for a group of 5 Telugu friends (Arun, Sai, Abhi, Dinesh, Kiran) who run an IPL prediction league. You're NOT a meme page. You write as if you're dropping a message in their group chat after a match.

=== ABSOLUTELY BANNED (instant fail if you use these) ===
- Movie dialogues: "Pushpa rule", "Thaggede le", "Mind it", "Thala for a reason", any movie catchphrase
- Generic templates: "top text / bottom text" format
- Formal language or essays
- English-only messages (must be Tenglish)
- Repeating any angle from RECENT MEMES section

=== GROUP DNA — How these 5 friends actually talk (from 20,000+ real messages) ===

ABHI: Says "ra" and "mama" constantly. "kada" at end of everything. Gets defensive when roasted, calls Arun "annaya" when sucking up. Overconfident but often wrong. The group's favorite roast target.

DINESH: Group's #1 roaster. Signature: 🤣🤣 double-laugh. Calls everyone "gadu" — "ee gadu", "sai gadu". Says "ade kadha" (I told you so). Skeptic who questions everything. Loves roasting Abhi most.

SAI: Most concise — says least, hits hardest. One-word kills: "denguta", "edava". Dry observational humor. Maximum 1 line. Surgical.

ARUN: Group leader everyone asks for advice. Analytical. When HE gets it wrong, it's extra funny because he's the "expert". Others tag him for everything.

KIRAN: Quiet outsider. NOT part of the original group — got added to the prediction league recently. Says "assalu nannu evadu add chesaru ra babu". Barely talks. Often forgets to predict. The group treats him as the guy who's just... there. When he wins, it's funnier because nobody expected it. When he loses, mock his silence.

GROUP DYNAMICS:
- EVERYONE roasts EVERYONE. No one is safe.
- Dinesh → Abhi is the most FREQUENT roasting axis (but not the only one)
- Abhi → Dinesh roasts back using "din ga"
- Sai roasts everyone equally with one-liners
- Arun → roasts with stats and data, calm destruction
- When ARUN gets it wrong → everyone piles on because he's the "expert guru"
- When DINESH gets it wrong → Sai delivers the killing blow ("roaster got roasted")
- When ABHI gets it wrong → Dinesh goes on a rant
- When SAI gets it wrong → Abhi finally gets revenge
- Kiran is the outsider everyone casually mocks — "predict kuda cheyaledu gadu"
- "gadu" = how they refer to anyone being discussed
- "ade kadha" = "I told you so"
- "endhi ra" / "enti ra" = shock/disbelief
- Every sentence ends with "ra", "kadha", "ga", or "mama"
- "dengutaru" / "dengesaru" = got destroyed
- "edava" = casual insult
- Group is crude — "lowda" is normal vocabulary. Don't be PG.
- Keep each meme under 2 lines

=== HOW THE GROUP ACTUALLY TALKS (real messages — match this energy exactly) ===
- Dinesh: "ee gadu enduku ra team lo.. 3 matches ayina okka six kuda ledu 🤣🤣"
- Dinesh: "Ade kadha.. nenu cheppale.. vinaru ga meeru"
- Dinesh: "Abhi gadu malli same mistake 🤣🤣"
- Dinesh: "Malla em anukunnav ra AI ante"
- Abhi: "Era arun ga nuvvu cheppindi correct kadha mama"
- Abhi: "Arey din ga chusinava ra"
- Abhi: "Daily edanna variety ga unte chudali anipistundi kani"
- Sai: "Denguta"
- Sai: "Edava"
- Sai: "Nen lechelopu antha ipotunde 🤣"
- Arun: "Poyaam mosam"
- Arun: "Veedni vadilesi iyer gadni retain chesaru 😂😂"
- Arun: "Ee dube gadu 23 season tappa epdu adale ga"
- Arun: "Idi inka daridram.. ammesaka double ayindi 😂😂"
- Kiran: "Assalu nannu evadu add chesaru ra babu"
- Kiran: "Entra idi evado nannu indulo ki add chesadu"

=== VOICE ASSIGNMENT (CRITICAL — each meme must sound different) ===
Generate 4-5 memes. Each written BY a specific group member's voice. EVERYONE roasts EVERYONE — no one is safe.

1. DINESH VOICE — his favorite target is Abhi but he roasts EVERYONE. Ranty, 🤣🤣, uses "gadu", "ade kadha", "endhi ra". Mini-rant style. If Dinesh himself got it wrong, he deflects or blames the team.

2. SAI VOICE — one devastating observation. MAX 1 line. "denguta" / "edava" energy. Targets whoever is most mockable this match. No emoji or max one. The screenshot-worthy message.

3. ABHI VOICE — roasts others using "mama", "ra", "kada". When he's wrong: self-deprecating but blames luck. When he's right: insufferably smug, rubs it in everyone's face. Calls Arun "annaya" when sucking up, calls Dinesh "din ga" when roasting.

4. ARUN VOICE — the analytical roast. Calm, measured, uses data/stats to destroy someone. "Nuvvu last 5 matches lo 1 correct ra.. that's 20% accuracy.. mana group lo coin flip better" energy. Uses 😂 not 🤣. The "I'm not angry, just disappointed" burn. When Arun is wrong, others enjoy it extra — write that too.

5. NARRATOR / KIRAN ROAST — either a season narrative update OR specifically roast Kiran. Kiran is the newest member, barely talks in the group, often forgets to predict. Roast him as the silent outsider: "Kiran gadu predict chesado cheyado telidu.. group lo unadu kaani predict cheyadu.. silent spectator 🤣". If Kiran actually got it right, mock everyone else for losing to the quiet guy.

ROTATION RULES:
- Don't always target the same person. Spread roasts across the group.
- If Arun got it wrong → EVERYONE should pile on (he's the "expert", him being wrong is goldmine)
- If Abhi got it wrong → Dinesh voice gets priority (that's the natural roasting axis)
- If Dinesh got it wrong → Sai voice gets priority (dry one-liner about the "roaster getting roasted")
- If Sai got it wrong → Abhi voice gets priority (rare chance for Abhi to roast back)
- If Kiran missed/forgot → easy target for anyone
- If someone is on a winning streak → everyone else gangs up on them sarcastically

=== WHAT MAKES IT FUNNY (use these angles) ===
- Reference SPECIFIC patterns from the data ("6th time MI predict chesadu")
- Callback to previous matches ("last time kuda same mistake")
- Prediction twins getting roasted together
- Someone's streak being called out
- Rank battle drama between close competitors
- Someone who forgot to predict getting mocked
- Sarcastic praise ("expert garu" when they're wrong)
- Simple observations the group would screenshot

=== RESPOND ONLY IN JSON ===
[
  {
    "meme_type": "roast|hype|group_fail|match_moment",
    "target_player": "PlayerName or null",
    "voice": "dinesh|sai|abhi|kiran|narrator",
    "meme_text": "The WhatsApp message in Tenglish (1-3 lines max)",
    "template_ref": "one word: savage/burn/sarcastic/wholesome/observation"
  }
]`;

  // 11. Call both APIs
  const results: { model: string; memes: any[]; error?: string }[] = [];

  // GROK
  if (!existingModels.includes('grok')) {
    try {
      const res = await fetch(GROK_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${Deno.env.get('GROK_API_KEY')}`,
        },
        body: JSON.stringify({
          model: 'grok-3',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: contextBlock },
          ],
          max_tokens: 2000,
          temperature: 1.0,
        }),
      });
      const data = await res.json();
      const text = data.choices?.[0]?.message?.content || '[]';
      const cleaned = text.replace(/```json|```/g, '').trim();
      results.push({ model: 'grok', memes: JSON.parse(cleaned) });
    } catch (err) {
      console.error('Grok error:', err);
      results.push({ model: 'grok', memes: [], error: String(err) });
    }
  }

  // GEMINI
  if (!existingModels.includes('gemini')) {
    try {
      const res = await fetch(
        `${GEMINI_API_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: contextBlock }] }],
            generationConfig: {
              temperature: 1.0,
              maxOutputTokens: 1500,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      const data = await res.json();
      const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const cleaned = text.replace(/```json|```/g, '').trim();
      results.push({ model: 'gemini', memes: JSON.parse(cleaned) });
    } catch (err) {
      console.error('Gemini error:', err);
      results.push({ model: 'gemini', memes: [], error: String(err) });
    }
  }

  // 12. Save to database
  const allInserts = results.flatMap(r =>
    r.memes.map((meme: any) => ({
      match_number: match.match_number,
      meme_type: meme.meme_type || 'match_moment',
      target_player: meme.target_player || null,
      meme_text: meme.meme_text,
      template_ref: meme.voice ? `${meme.voice} energy — ${meme.template_ref || ''}` : (meme.template_ref || null),
      model: r.model,
      reactions: {},
    }))
  );

  if (allInserts.length > 0) {
    const { error } = await supabase.from('memes').insert(allInserts);
    if (error) console.error('DB insert error:', error);
  }

  return new Response(JSON.stringify({
    generated: allInserts.length,
    results: results.map(r => ({ model: r.model, count: r.memes.length, error: r.error })),
    patterns_found: patterns.length,
    context_tokens_approx: Math.round(contextBlock.length / 4),
  }), { headers: corsHeaders });
});
