-- IPL Predictions 2026 - Initial Schema

-- ============================================
-- Tables
-- ============================================

CREATE TABLE matches (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  match_number int UNIQUE NOT NULL,
  espn_match_id bigint,
  team1 varchar(4) NOT NULL,
  team2 varchar(4) NOT NULL,
  venue varchar(100),
  match_date timestamptz NOT NULL,
  stage varchar(20) NOT NULL DEFAULT 'league',
  status varchar(20) NOT NULL DEFAULT 'upcoming'
    CHECK (status IN ('upcoming', 'live', 'completed', 'no_result', 'abandoned')),
  winner varchar(4),
  result_text text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE TABLE predictions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_name varchar(20) NOT NULL,
  match_number int NOT NULL REFERENCES matches(match_number),
  predicted_team varchar(4) NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  UNIQUE(user_name, match_number)
);

CREATE TABLE players (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name varchar(20) UNIQUE NOT NULL,
  display_name varchar(50) NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- ============================================
-- Indexes
-- ============================================

CREATE INDEX idx_predictions_user_name ON predictions(user_name);
CREATE INDEX idx_predictions_match_number ON predictions(match_number);

-- ============================================
-- Updated_at trigger
-- ============================================

CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER matches_updated_at
  BEFORE UPDATE ON matches
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER predictions_updated_at
  BEFORE UPDATE ON predictions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

-- ============================================
-- Row Level Security
-- ============================================

ALTER TABLE matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE players ENABLE ROW LEVEL SECURITY;

-- matches: read-only for anon
CREATE POLICY "matches_select" ON matches
  FOR SELECT TO anon USING (true);

-- predictions: read + write for anon
CREATE POLICY "predictions_select" ON predictions
  FOR SELECT TO anon USING (true);

CREATE POLICY "predictions_insert" ON predictions
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "predictions_update" ON predictions
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- players: read-only for anon
CREATE POLICY "players_select" ON players
  FOR SELECT TO anon USING (true);

-- ============================================
-- Realtime
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE matches, predictions;
