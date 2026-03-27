// Supabase Edge Function — Deno runtime
// Generates memes using Grok and Gemini APIs after match results

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const GROK_API_URL = 'https://api.x.ai/v1/chat/completions';
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent';

Deno.serve(async (req) => {
  const { match_number } = await req.json();

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  );

  // 1. Get match details
  const { data: match } = await supabase
    .from('matches')
    .select('*')
    .eq('match_number', match_number)
    .single();

  if (!match || !match.winner) {
    return new Response(JSON.stringify({ error: 'Match not completed' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // 2. Check for existing memes (avoid duplicates per model)
  const { data: existingMemes } = await supabase
    .from('memes')
    .select('model')
    .eq('match_number', match_number);

  const existingModels = [...new Set(existingMemes?.map((m: any) => m.model) || [])];

  // 3. Get predictions for this match
  const { data: predictions } = await supabase
    .from('predictions')
    .select('*')
    .eq('match_number', match_number);

  // 4. Get leaderboard context
  const { data: allPredictions } = await supabase
    .from('predictions')
    .select('*');

  const { data: allMatches } = await supabase
    .from('matches')
    .select('*')
    .eq('status', 'completed');

  // 5. Build rich context
  const players = ['Arun', 'Sai', 'Abhi', 'Dinesh'];

  const matchPredictions = players.map(player => {
    const pred = predictions?.find((p: any) => p.user_name === player);
    return {
      player,
      predicted: pred?.predicted_team || 'NO PREDICTION',
      correct: pred ? pred.predicted_team === match.winner : false,
    };
  });

  const correctPlayers = matchPredictions.filter(p => p.correct).map(p => p.player);
  const wrongPlayers = matchPredictions.filter(p => !p.correct && p.predicted !== 'NO PREDICTION').map(p => p.player);
  const noPrediction = matchPredictions.filter(p => p.predicted === 'NO PREDICTION').map(p => p.player);

  const playerStats = players.map(player => {
    const playerPreds = allPredictions?.filter((p: any) => p.user_name === player) || [];
    const completedPreds = playerPreds.filter((p: any) => {
      const m = allMatches?.find((m: any) => m.match_number === p.match_number);
      return m && m.winner;
    });
    const correctCount = completedPreds.filter((p: any) => {
      const m = allMatches?.find((m: any) => m.match_number === p.match_number);
      return m && m.winner === p.predicted_team;
    }).length;
    return {
      player,
      points: correctCount,
      totalPredicted: completedPreds.length,
      accuracy: completedPreds.length > 0 ? Math.round(correctCount / completedPreds.length * 100) : 0,
    };
  }).sort((a, b) => b.points - a.points);

  const team1Picks = matchPredictions.filter(p => p.predicted === match.team1).length;
  const team2Picks = matchPredictions.filter(p => p.predicted === match.team2).length;

  const contextBlock = `
MATCH RESULT:
Match #${match.match_number}: ${match.team1} vs ${match.team2}
Winner: ${match.winner}
Result: ${match.result_text}
Venue: ${match.venue}

PREDICTIONS:
${matchPredictions.map(p => `- ${p.player}: predicted ${p.predicted} → ${p.correct ? '✅ CORRECT' : '❌ WRONG'}`).join('\n')}

GROUP CONSENSUS:
- ${team1Picks} picked ${match.team1}, ${team2Picks} picked ${match.team2}, ${noPrediction.length} didn't predict

CURRENT STANDINGS:
${playerStats.map((p, i) => `${i + 1}. ${p.player}: ${p.points} pts, ${p.accuracy}% accuracy`).join('\n')}

CORRECT: ${correctPlayers.join(', ') || 'Nobody'}
WRONG: ${wrongPlayers.join(', ') || 'Nobody'}
MISSED: ${noPrediction.join(', ') || 'Nobody'}
`;

  const systemPrompt = `You are a meme writer for a friend group's IPL prediction league. The group has 4 friends: Arun, Sai, Abhi, Dinesh. They're Telugu guys who talk in Tenglish (Telugu-English mix).

Your job: Generate 2-3 SHORT memes based on the match result and prediction data. Each meme should be one of these types:

1. ROAST — Target the worst predictor. Savage but friendly. Use Telugu movie references (Brahmanandam, Venky, Pushpa, Mahesh Babu), cricket memes, Tenglish slang.
2. HYPE — Celebrate the best predictor / streak king. Gas them up Telugu style.
3. GROUP_FAIL — When majority predicted wrong. Mock the herd mentality.
4. MATCH_MOMENT — Reference the actual match result in a funny way.

RULES:
- Tenglish only (Telugu words in English script + English). NOT pure Telugu, NOT pure English.
- 2-4 lines max per meme. Short and punchy.
- Use real player names. Reference Telugu movie dialogues and meme formats.
- Savage roasts but never mean — friends roasting friends.
- 1-2 emojis per meme max.
- Include a "template_ref" — short vibe note (e.g., "Brahmanandam enti ra energy", "Pushpa swag")

RESPOND ONLY IN JSON — no markdown, no preamble, no backticks:
[
  {
    "meme_type": "roast|hype|group_fail|match_moment",
    "target_player": "PlayerName or null",
    "meme_text": "The meme text in Tenglish",
    "template_ref": "Short vibe description"
  }
]`;

  const results: { model: string; memes: any[]; error?: string }[] = [];

  // 6. Call GROK (xAI API — OpenAI-compatible format)
  if (!existingModels.includes('grok')) {
    try {
      const grokRes = await fetch(GROK_API_URL, {
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
          max_tokens: 1000,
          temperature: 0.9,
        }),
      });
      const grokData = await grokRes.json();
      const grokText = grokData.choices?.[0]?.message?.content || '[]';
      const cleaned = grokText.replace(/```json|```/g, '').trim();
      const grokMemes = JSON.parse(cleaned);
      results.push({ model: 'grok', memes: grokMemes });
    } catch (err) {
      console.error('Grok failed:', err);
      results.push({ model: 'grok', memes: [], error: String(err) });
    }
  }

  // 7. Call GEMINI (Google AI API)
  if (!existingModels.includes('gemini')) {
    try {
      const geminiRes = await fetch(
        `${GEMINI_API_URL}?key=${Deno.env.get('GEMINI_API_KEY')}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            system_instruction: { parts: [{ text: systemPrompt }] },
            contents: [{ parts: [{ text: contextBlock }] }],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 1000,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
      const geminiData = await geminiRes.json();
      const geminiText = geminiData.candidates?.[0]?.content?.parts?.[0]?.text || '[]';
      const cleaned = geminiText.replace(/```json|```/g, '').trim();
      const geminiMemes = JSON.parse(cleaned);
      results.push({ model: 'gemini', memes: geminiMemes });
    } catch (err) {
      console.error('Gemini failed:', err);
      results.push({ model: 'gemini', memes: [], error: String(err) });
    }
  }

  // 8. Insert all memes with their model tag
  const allInserts = results.flatMap(r =>
    r.memes.map((meme: any) => ({
      match_number: match.match_number,
      meme_type: meme.meme_type,
      target_player: meme.target_player || null,
      meme_text: meme.meme_text,
      template_ref: meme.template_ref || null,
      model: r.model,
      reactions: {},
    }))
  );

  if (allInserts.length > 0) {
    const { error } = await supabase.from('memes').insert(allInserts);
    if (error) console.error('Insert error:', error);
  }

  return new Response(JSON.stringify({
    generated: allInserts.length,
    results: results.map(r => ({ model: r.model, count: r.memes.length, error: r.error })),
  }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
