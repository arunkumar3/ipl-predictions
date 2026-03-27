# Meme Zone — AI-Generated Match Day Memes

## Overview
After every match result, the app auto-generates 2-3 memes using the Claude API. Memes are personalized roasts, hype posts, and group-fail callouts in Telugu-English mix (Tenglish) — the way the friend group actually talks. Displayed on a `/memes` page as a scrollable feed.

## Step 1: Database — `memes` table

Add migration `supabase/migrations/002_memes_table.sql`:

```sql
CREATE TABLE memes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number INT NOT NULL REFERENCES matches(match_number),
  meme_type VARCHAR(20) NOT NULL CHECK (meme_type IN ('roast', 'hype', 'group_fail', 'match_moment')),
  target_player VARCHAR(20),          -- who's being roasted/hyped (null for group/match memes)
  meme_text TEXT NOT NULL,             -- the generated meme content
  template_ref TEXT,                   -- style reference (e.g., "Brahmanandam energy", "Pushpa swag")
  model VARCHAR(20) NOT NULL DEFAULT 'gemini' CHECK (model IN ('grok', 'gemini')),  -- which LLM generated this
  reactions JSONB DEFAULT '{}',        -- {"😂": ["Arun", "Sai"], "🔥": ["Dinesh"]}
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: everyone can read, only service role can insert (via Edge Function)
ALTER TABLE memes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read memes" ON memes FOR SELECT USING (true);

-- Enable realtime so meme cards appear live
ALTER PUBLICATION supabase_realtime ADD TABLE memes;

-- Index for fast lookups
CREATE INDEX idx_memes_match ON memes(match_number);
CREATE INDEX idx_memes_model ON memes(model);
```

## Step 2: Meme Generation Edge Function

Create `supabase/functions/generate-memes/index.ts`:

This function is called AFTER a match result is set. It calls BOTH Grok and Gemini with the same context, generating separate meme sets for A/B comparison.

```typescript
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

// API endpoints
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
    return new Response(JSON.stringify({ error: 'Match not completed' }), { status: 400 });
  }

  // 2. Check if memes already exist for this match (avoid duplicates)
  const { data: existingMemes } = await supabase
    .from('memes')
    .select('model')
    .eq('match_number', match_number);

  const existingModels = [...new Set(existingMemes?.map(m => m.model) || [])];

  // 3. Get all predictions for this match
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
  const players = ['Arun', 'Sai', 'Abhi', 'Dinesh', 'Kiran'];

  const matchPredictions = players.map(player => {
    const pred = predictions?.find(p => p.user_name === player);
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
    const playerPreds = allPredictions?.filter(p => p.user_name === player) || [];
    const completedPreds = playerPreds.filter(p => {
      const m = allMatches?.find(m => m.match_number === p.match_number);
      return m && m.winner;
    });
    const correctCount = completedPreds.filter(p => {
      const m = allMatches?.find(m => m.match_number === p.match_number);
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

  const systemPrompt = `You are a meme writer for a friend group's IPL prediction league. The group has 5 friends: Arun, Sai, Abhi, Dinesh, Kiran. They're Telugu guys who talk in Tenglish (Telugu-English mix).

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
```

**Environment variables needed:**
Set these as Supabase Edge Function secrets:
```bash
supabase secrets set GROK_API_KEY=xai-...
supabase secrets set GEMINI_API_KEY=AIza...
```

**API details:**
- **Grok**: Uses xAI API at `api.x.ai/v1/chat/completions` — OpenAI-compatible format. Model: `grok-3`. Get API key from https://console.x.ai
- **Gemini**: Uses Google AI API at `generativelanguage.googleapis.com`. Model: `gemini-2.0-flash`. Get API key from https://aistudio.google.com/apikey

## Step 3: Trigger Meme Generation After Result

Update the existing `fetch-results` Edge Function. After successfully updating a match result, call the meme generator:

```typescript
// After updating a match as completed, trigger meme generation
if (winnerCode) {
  // ... existing update logic ...

  // Trigger meme generation
  try {
    await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/generate-memes`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ match_number: match.match_number }),
    });
  } catch (err) {
    console.error('Meme generation failed:', err);
    // Don't block result update if memes fail
  }
}
```

Also add a meme generation button on the admin page for manual triggering.

## Step 4: Memes Hook — `src/hooks/useMemes.js`

```js
// Fetch all memes, subscribe to realtime for new ones
// Returns { memes, loading, modelStats }
// memes grouped by match_number, sorted by most recent match first
// modelStats: { grok: { totalReactions: N }, gemini: { totalReactions: N } }
// Also expose: reactToMeme(memeId, emoji, userName) to add reactions
// Filter support: pass model ('grok' | 'gemini' | 'all') to filter memes
```

The reaction function should update the JSONB `reactions` field:
```js
async function reactToMeme(memeId, emoji, userName) {
  // Get current reactions
  const { data: meme } = await supabase
    .from('memes')
    .select('reactions')
    .eq('id', memeId)
    .single();

  const reactions = meme?.reactions || {};
  const emojiList = reactions[emoji] || [];

  // Toggle: add if not present, remove if already reacted
  if (emojiList.includes(userName)) {
    reactions[emoji] = emojiList.filter(n => n !== userName);
  } else {
    reactions[emoji] = [...emojiList, userName];
  }

  // Clean up empty arrays
  if (reactions[emoji]?.length === 0) delete reactions[emoji];

  await supabase
    .from('memes')
    .update({ reactions })
    .eq('id', memeId);
}
```

**RLS update for reactions:**
Add UPDATE policy for memes (reactions column only):
```sql
CREATE POLICY "Anyone can react to memes" ON memes FOR UPDATE
  USING (true)
  WITH CHECK (true);
```

## Step 5: MemesPage — `/memes?user=Name`

### Page Layout

Header area:
- Title: "Meme Zone" with fire emoji, font-size 18px, font-weight 800
- Subtitle: "Auto-generated after every match" in muted text

### Model Tabs — Grok vs Gemini A/B Test
Below the header, add a tab bar to switch between models:

```
[  🤖 Grok  |  ✨ Gemini  ]
```

**Tab styling:**
- Container: background #FFFFFF, border 1px solid #E8EAF0, border-radius 10px, padding 3px, display flex, margin 12px 16px
- Each tab: flex 1, text-align center, padding 8px 0, font-size 12px, font-weight 700, border-radius 8px, cursor pointer
- Active tab: background #1B2A6B, color #FFFFFF
- Inactive tab: background transparent, color #8890A6
- Grok tab label: "🤖 Grok"
- Gemini tab label: "✨ Gemini"

**Behavior:**
- Default to "Grok" tab on first load
- Switching tabs filters the meme feed to show only memes from that model
- Both tabs show the same match groups — just different meme content per match
- Store selected tab in local state (not persisted)

### Model Score Banner
Below the tabs, show a running score of which model is "winning" based on total reactions:

```
🤖 Grok: 47 reactions  vs  ✨ Gemini: 52 reactions
```

- Background: #EEF3FF, border-radius 8px, padding 8px 14px, margin 0 12px 12px
- Font-size 11px, font-weight 600, color #1B2A6B
- The model with more reactions gets a subtle highlight (bold + slightly larger number)
- This is computed from the reactions JSONB across all memes: count total individual reactions per model
- Updates in realtime as people react

### Meme Card — Model Badge
Each meme card gets a small model badge in the card header:
- Grok memes: small "🤖 GROK" pill, background #F0F1F5, color #4A5068, font-size 8px
- Gemini memes: small "✨ GEMINI" pill, background #EEF3FF, color #1B2A6B, font-size 8px
- Placed next to the meme type label (e.g., "Roast of the Day · 🤖 GROK")

Feed: scrollable list of meme cards from the selected model, grouped by match.

### Match Group Header
For each match day:
```
● MATCH 1 · RCB vs SRH · RCB WON BY 23 RUNS    [28 MAR]
```
- Green dot for completed, team names, result text, date pill

### Meme Card Design

Each meme card:
```
┌─────────────────────────────────────┐
│ [Icon] Roast of the Day            │
│        Target: Abhi                 │
├─────────────────────────────────────┤
│                                     │
│  [Meme text in large bold font]     │
│  [With Tenglish content]            │
│                                     │
│  — Brahmanandam energy              │
│                                     │
├─────────────────────────────────────┤
│ 😂 3   🔥 1          Share to WA   │
└─────────────────────────────────────┘
```

**Card header:**
- Icon: 🔥 for roast (red tint bg), 👑 for hype (green tint bg), 🤡 for group_fail (blue tint bg), 🏏 for match_moment (yellow tint bg)
- Meme type label: "Roast of the Day", "Streak King", "Group Fail", "Match Moment"
- Target player (if applicable): "Target: Abhi" in muted text

**Card body — colored backgrounds by type:**
- Roast: `background: linear-gradient(135deg, #FFF5F5, #FEE7E7)` (light red)
- Hype: `background: linear-gradient(135deg, #F0FFF4, #E8F8EE)` (light green)
- Group fail: `background: linear-gradient(135deg, #EEF3FF, #E6EEFF)` (light blue)
- Match moment: `background: linear-gradient(135deg, #FFFBEB, #FEF3C7)` (light yellow)

**Meme text styling:**
- Font-size: 15-16px, font-weight: 700, line-height: 1.5
- Player names: color #1B2A6B, font-weight 800
- Key roast phrases: color #E24B4A (red)
- Hype phrases: color #16A34A (green)
- Team names: team's primary color, font-weight 800

**Template reference:**
- Italic, 10px, color #8890A6
- Shows the vibe: "— Brahmanandam enti ra energy" or "— Pushpa swag mode"

**Card footer:**
- Reaction buttons: emoji + count. Available emojis: 😂 🔥 💀 👑 🤡
  - Tappable — toggles reaction for current user (uses identity from localStorage)
  - Reacted emojis show slightly bolder/highlighted
  - Count in font-size 11px next to each emoji
- "Share to WhatsApp" button on the right:
  ```js
  const shareText = `🏏 IPL Predict - Match #${matchNumber}\n\n${memeText}\n\n— ${templateRef}`;
  window.open(`https://wa.me/?text=${encodeURIComponent(shareText)}`);
  ```

### Empty State
If no memes yet:
"No memes yet — they'll appear after the first match result! 🏏"

### Loading State
Skeleton cards with the gradient backgrounds pulsing.

## Step 6: Bottom Nav Update

Add MEMES tab to the bottom nav. New nav order:
- ⚡ MATCHES
- 🏆 BOARD
- 🔥 MEMES (NEW)
- 📊 STATS
- ⚙ MORE

This makes it 5 tabs. If that feels crowded, you can combine STATS into MORE and keep 4 tabs:
- ⚡ MATCHES
- 🏆 BOARD
- 🔥 MEMES
- ⚙ MORE (with Stats as a section inside)

Go with whichever feels better on mobile at 360px width.

## Step 7: Admin Page — Manual Meme Generation

On the admin page, add a "Generate Memes" section:
- Dropdown to select a completed match
- Two buttons: "Generate Grok Memes" and "Generate Gemini Memes" — can generate for one or both
- "Generate Both" button that calls the Edge Function once (it handles both internally)
- Shows generated memes below as preview, with model labels
- "Regenerate [Model]" button to delete existing memes from that model for that match and regenerate
- "Delete All Memes for Match" button for cleanup
- Useful for testing and for re-rolling if a model's output isn't great

### Model Selection (Post A/B Test)
After the first week or so of testing, you'll want to pick a winner. When ready:
- Check the Model Score Banner — whichever model has more total reactions wins
- Or just ask the group which they prefer
- To switch to a single model: update the Edge Function to only call the winning model
- Optionally hide the model tabs and show all memes in a single feed
- The `model` column stays in the database for historical reference

## Step 8: Meme Notification

When new memes are generated (detected via Supabase Realtime subscription on the memes table):
- Show a toast on all pages: "🔥 New memes for Match #X are live!"
- Toast has a "View" button that navigates to `/memes?user=Name`

## Verification

- [ ] `supabase/migrations/002_memes_table.sql` creates the memes table with `model` column and check constraint
- [ ] `supabase/functions/generate-memes/index.ts` calls BOTH Grok and Gemini APIs
- [ ] Edge Function correctly builds context from match + predictions + standings
- [ ] Grok API call uses correct endpoint (`api.x.ai`) and format (OpenAI-compatible)
- [ ] Gemini API call uses correct endpoint and format (Google AI)
- [ ] Memes from both models are parsed and inserted with correct `model` tag
- [ ] Duplicate prevention: re-calling the function for a match doesn't create duplicate memes per model
- [ ] `fetch-results` Edge Function triggers meme generation after setting a result
- [ ] `/memes?user=Arun` shows the meme feed
- [ ] Grok / Gemini tabs work — switching filters memes by model
- [ ] Model score banner shows correct total reaction counts per model
- [ ] Model badge appears on each meme card ("🤖 GROK" or "✨ GEMINI")
- [ ] Meme cards have correct colored backgrounds per type (roast=red, hype=green, etc.)
- [ ] Player names are highlighted in meme text
- [ ] Reaction buttons work (tap to react, tap again to unreact)
- [ ] Reaction counts update in realtime across clients
- [ ] "Share to WhatsApp" opens WhatsApp with meme text
- [ ] Admin page can generate memes for each model separately or both at once
- [ ] Admin page can regenerate memes for a specific model
- [ ] New meme toast notification appears on other pages
- [ ] Bottom nav includes MEMES tab
- [ ] Empty state shows when no memes exist
- [ ] Memes are grouped by match, most recent first
- [ ] Mobile 360px: tabs + meme cards don't overflow, text readable
- [ ] Identity lock: reactions use claimed identity from localStorage
- [ ] If one API fails, the other still generates memes (independent error handling)
