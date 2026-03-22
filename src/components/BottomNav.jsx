import { useLocation, useSearchParams, Link } from 'react-router-dom';
import { Zap, Trophy, BarChart3, Settings } from 'lucide-react';
import { buildUrl } from '../lib/utils';
import { getClaimedIdentity } from '../lib/identity';

const TABS = [
  { path: '/', label: 'MATCHES', Icon: Zap },
  { path: '/leaderboard', label: 'BOARD', Icon: Trophy },
  { path: '/stats', label: 'STATS', Icon: BarChart3 },
  { path: '/more', label: 'MORE', Icon: Settings },
];

export default function BottomNav() {
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const user = searchParams.get('user');
  const claimed = getClaimedIdentity();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around py-2 safe-bottom"
      style={{ backgroundColor: '#FFFFFF', borderTop: '1px solid #E8EAF0' }}>
      {TABS.map((tab) => {
        const isActive = location.pathname === tab.path;
        const color = isActive ? '#1B2A6B' : '#8890A6';
        // MATCHES tab always goes to claimed identity's profile
        const targetUser = tab.path === '/' && claimed ? claimed : user;
        return (
          <Link key={tab.path} to={buildUrl(tab.path, targetUser)}
            className="flex flex-col items-center gap-1 min-w-[60px] py-1 relative">
            <tab.Icon size={20} color={color} strokeWidth={isActive ? 2.5 : 2} />
            <span className="text-[10px] font-bold tracking-wide" style={{ color }}>{tab.label}</span>
            {isActive && <div className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full" style={{ width: 20, height: 3, backgroundColor: '#1B2A6B', borderRadius: 2 }} />}
          </Link>
        );
      })}
    </nav>
  );
}
