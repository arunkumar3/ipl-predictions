export const TEAM_BRANDING = {
  CSK:  { name: 'Chennai Super Kings',         primary: '#FCCA06', secondary: '#0081E9', textOnPrimary: '#0E1842' },
  RCB:  { name: 'Royal Challengers Bengaluru', primary: '#EC1C24', secondary: '#2B2A29', textOnPrimary: '#FFFFFF' },
  MI:   { name: 'Mumbai Indians',              primary: '#004BA0', secondary: '#D4A843', textOnPrimary: '#FFFFFF' },
  KKR:  { name: 'Kolkata Knight Riders',       primary: '#3A225D', secondary: '#D4A843', textOnPrimary: '#FFFFFF' },
  RR:   { name: 'Rajasthan Royals',            primary: '#E73895', secondary: '#254AA5', textOnPrimary: '#FFFFFF' },
  SRH:  { name: 'Sunrisers Hyderabad',         primary: '#FF822A', secondary: '#000000', textOnPrimary: '#FFFFFF' },
  DC:   { name: 'Delhi Capitals',              primary: '#004C93', secondary: '#EF1B23', textOnPrimary: '#FFFFFF' },
  PBKS: { name: 'Punjab Kings',                primary: '#ED1B24', secondary: '#A7A9AC', textOnPrimary: '#FFFFFF' },
  GT:   { name: 'Gujarat Titans',              primary: '#1C1C1C', secondary: '#0B4973', textOnPrimary: '#FFFFFF' },
  LSG:  { name: 'Lucknow Super Giants',        primary: '#A72056', secondary: '#FFCC00', textOnPrimary: '#FFFFFF' },
};

export const TEAM_LOGOS = {
  CSK:  'https://documents.iplt20.com/ipl/CSK/logos/Logooutline/CSKoutline.png',
  DC:   'https://documents.iplt20.com/ipl/DC/Logos/LogoOutline/DCoutline.png',
  GT:   'https://documents.iplt20.com/ipl/GT/Logos/Logooutline/GToutline.png',
  KKR:  'https://documents.iplt20.com/ipl/KKR/Logos/Logooutline/KKRoutline.png',
  LSG:  'https://documents.iplt20.com/ipl/LSG/Logos/Logooutline/LSGoutline.png',
  MI:   'https://documents.iplt20.com/ipl/MI/Logos/Logooutline/MIoutline.png',
  PBKS: 'https://documents.iplt20.com/ipl/PBKS/Logos/Logooutline/PBKSoutline.png',
  RR:   'https://documents.iplt20.com/ipl/RR/Logos/Logooutline/RRoutline.png',
  RCB:  'https://documents.iplt20.com/ipl/RCB/Logos/Logooutline/RCBoutline.png',
  SRH:  'https://documents.iplt20.com/ipl/SRH/Logos/Logooutline/SRHoutline.png',
};

export function getMatchPoints(stage) {
  switch (stage) {
    case 'league': return 1;
    case 'qualifier1': case 'eliminator': case 'qualifier2': return 2;
    case 'final': return 3;
    default: return 1;
  }
}

export const PLAYERS = ['Arun', 'Sai', 'Abhi', 'Dinesh', 'Kiran'];

// Full season: 84 league + 3 playoffs (Q1, Elim, Q2) + 1 final = 88 matches
// Max points: 84×1 + 3×2 + 1×3 = 93
export const FULL_SEASON_MAX_POINTS = 93;

// Dynamic max points from an array of matches
export function getMaxPoints(matches) {
  return matches.reduce((sum, m) => sum + getMatchPoints(m.stage), 0);
}
