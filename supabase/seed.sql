-- IPL Predictions 2026 - Seed Data

-- Players
INSERT INTO players (name, display_name) VALUES
  ('Arun', 'Arun'),
  ('Sai', 'Sai'),
  ('Abhi', 'Abhi'),
  ('Dinesh', 'Dinesh');

-- First 20 matches (all times in IST = UTC+05:30)
INSERT INTO matches (match_number, espn_match_id, team1, team2, venue, match_date, stage, status) VALUES
  (1,  1527674, 'RCB',  'SRH',  'M Chinnaswamy Stadium, Bengaluru',     '2026-03-28T19:30:00+05:30', 'league', 'upcoming'),
  (2,  1527675, 'MI',   'KKR',  'Wankhede Stadium, Mumbai',              '2026-03-29T19:30:00+05:30', 'league', 'upcoming'),
  (3,  1527676, 'RR',   'CSK',  'Barsapara Cricket Stadium, Guwahati',   '2026-03-30T19:30:00+05:30', 'league', 'upcoming'),
  (4,  1527677, 'PBKS', 'GT',   'PCA Stadium, New Chandigarh',           '2026-03-31T19:30:00+05:30', 'league', 'upcoming'),
  (5,  1527678, 'LSG',  'DC',   'BRSABV Ekana Stadium, Lucknow',         '2026-04-01T19:30:00+05:30', 'league', 'upcoming'),
  (6,  1527679, 'KKR',  'SRH',  'Eden Gardens, Kolkata',                 '2026-04-02T19:30:00+05:30', 'league', 'upcoming'),
  (7,  1527680, 'CSK',  'PBKS', 'MA Chidambaram Stadium, Chennai',       '2026-04-03T19:30:00+05:30', 'league', 'upcoming'),
  (8,  1527681, 'DC',   'MI',   'Arun Jaitley Stadium, Delhi',           '2026-04-04T15:30:00+05:30', 'league', 'upcoming'),
  (9,  1527682, 'GT',   'RR',   'Narendra Modi Stadium, Ahmedabad',      '2026-04-04T19:30:00+05:30', 'league', 'upcoming'),
  (10, 1527683, 'SRH',  'LSG',  'Rajiv Gandhi Intl Stadium, Hyderabad',  '2026-04-05T15:30:00+05:30', 'league', 'upcoming'),
  (11, 1527684, 'RCB',  'CSK',  'M Chinnaswamy Stadium, Bengaluru',      '2026-04-05T19:30:00+05:30', 'league', 'upcoming'),
  (12, 1527685, 'KKR',  'PBKS', 'Eden Gardens, Kolkata',                 '2026-04-06T19:30:00+05:30', 'league', 'upcoming'),
  (13, 1527686, 'RR',   'MI',   'Barsapara Cricket Stadium, Guwahati',   '2026-04-07T19:30:00+05:30', 'league', 'upcoming'),
  (14, 1527687, 'DC',   'GT',   'Arun Jaitley Stadium, Delhi',           '2026-04-08T19:30:00+05:30', 'league', 'upcoming'),
  (15, 1527688, 'KKR',  'LSG',  'Eden Gardens, Kolkata',                 '2026-04-09T19:30:00+05:30', 'league', 'upcoming'),
  (16, 1527689, 'RR',   'RCB',  'Barsapara Cricket Stadium, Guwahati',   '2026-04-10T19:30:00+05:30', 'league', 'upcoming'),
  (17, 1527690, 'PBKS', 'SRH',  'PCA Stadium, New Chandigarh',           '2026-04-11T15:30:00+05:30', 'league', 'upcoming'),
  (18, 1527691, 'CSK',  'DC',   'MA Chidambaram Stadium, Chennai',       '2026-04-11T19:30:00+05:30', 'league', 'upcoming'),
  (19, 1527692, 'LSG',  'GT',   'BRSABV Ekana Stadium, Lucknow',         '2026-04-12T15:30:00+05:30', 'league', 'upcoming'),
  (20, 1527693, 'MI',   'RCB',  'Wankhede Stadium, Mumbai',              '2026-04-12T19:30:00+05:30', 'league', 'upcoming');
