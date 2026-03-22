-- Admin RPC function for setting match results
-- Runs with elevated privileges (SECURITY DEFINER) to bypass RLS

CREATE OR REPLACE FUNCTION set_match_result(
  p_match_number INT,
  p_winner VARCHAR(4),
  p_result_text TEXT DEFAULT NULL
)
RETURNS VOID AS $$
BEGIN
  UPDATE matches
  SET winner = p_winner,
      status = 'completed',
      result_text = COALESCE(p_result_text, p_winner || ' won'),
      updated_at = NOW()
  WHERE match_number = p_match_number
    AND status != 'completed';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to anon and authenticated roles
GRANT EXECUTE ON FUNCTION set_match_result(INT, VARCHAR, TEXT) TO anon;
GRANT EXECUTE ON FUNCTION set_match_result(INT, VARCHAR, TEXT) TO authenticated;

-- Also add UPDATE policy on matches for the edge function (service role bypasses RLS anyway)
-- But for admin direct updates via anon key:
CREATE POLICY "Allow status updates on matches" ON matches
  FOR UPDATE USING (true)
  WITH CHECK (true);
