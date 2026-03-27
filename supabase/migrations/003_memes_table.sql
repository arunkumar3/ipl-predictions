-- Meme Zone: AI-generated match day memes (Grok vs Gemini A/B test)

CREATE TABLE memes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_number INT NOT NULL REFERENCES matches(match_number),
  meme_type VARCHAR(20) NOT NULL CHECK (meme_type IN ('roast', 'hype', 'group_fail', 'match_moment')),
  target_player VARCHAR(20),
  meme_text TEXT NOT NULL,
  template_ref TEXT,
  model VARCHAR(20) NOT NULL DEFAULT 'gemini' CHECK (model IN ('grok', 'gemini')),
  reactions JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- RLS: everyone can read, only service role can insert
ALTER TABLE memes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read memes" ON memes FOR SELECT USING (true);
CREATE POLICY "Anyone can react to memes" ON memes FOR UPDATE
  USING (true)
  WITH CHECK (true);

-- Enable realtime so meme cards appear live
ALTER PUBLICATION supabase_realtime ADD TABLE memes;

-- Indexes for fast lookups
CREATE INDEX idx_memes_match ON memes(match_number);
CREATE INDEX idx_memes_model ON memes(model);
