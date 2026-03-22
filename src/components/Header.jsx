export default function Header({ userName, stats }) {
  return (
    <header
      className="px-4 pt-4 pb-3 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0E1842 0%, #1B2A6B 50%, #2A1858 100%)',
        borderBottom: '1px solid rgba(200, 230, 41, 0.08)',
      }}
    >
      {/* Decorative circles — very subtle */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -40,
          right: -30,
          width: 160,
          height: 160,
          border: '3px solid rgba(200, 230, 41, 0.06)',
          borderRadius: '50%',
        }}
      />
      <div
        className="absolute pointer-events-none"
        style={{
          top: 20,
          right: 30,
          width: 100,
          height: 100,
          border: '2px solid rgba(232, 69, 139, 0.05)',
          borderRadius: '50%',
        }}
      />

      {/* Brand + user */}
      <div className="flex items-center justify-between mb-3 relative z-10">
        <div className="flex items-center gap-2.5">
          <img
            src="https://www.iplt20.com/assets/images/IPL_LOGO_CORPORATE_2024.png"
            alt="IPL"
            className="w-9 h-auto object-contain"
            style={{ filter: 'drop-shadow(0 0 8px rgba(200, 230, 41, 0.15))' }}
          />
          <div>
            <h1 className="text-lg font-black tracking-tight leading-tight" style={{ color: '#F1F5F9' }}>
              IPL <span style={{ color: '#C8E629' }}>PREDICT</span>
            </h1>
            <p
              className="font-bold uppercase leading-none"
              style={{
                color: '#C8E629',
                fontSize: 8,
                letterSpacing: '3px',
              }}
            >
              PREDICTION LEAGUE 2026
            </p>
          </div>
        </div>
        {userName && (
          <div
            className="px-3.5 py-1.5 rounded-full text-sm font-bold"
            style={{ backgroundColor: 'rgba(200, 230, 41, 0.1)', color: '#C8E629' }}
          >
            {userName}
          </div>
        )}
      </div>

      {/* Stat pills */}
      {stats && (
        <div className="flex gap-1.5 relative z-10">
          <StatPill label="POINTS" value={stats.points} color="#C8E629" />
          <StatPill label="ACCURACY" value={`${stats.accuracy}%`} color="#22C55E" />
          <StatPill label="STREAK" value={stats.currentStreak} color="#E8458B" />
          <StatPill label="RANK" value={`#${stats.rank}`} color="#60A5FA" />
        </div>
      )}
    </header>
  );
}

function StatPill({ label, value, color }) {
  return (
    <div
      className="flex-1 flex flex-col items-center py-2.5 px-2 rounded-xl"
      style={{
        backgroundColor: 'rgba(200, 230, 41, 0.05)',
        border: '1px solid rgba(200, 230, 41, 0.08)',
      }}
    >
      <span
        className="font-mono-num font-bold leading-none"
        style={{ color, fontSize: 20 }}
      >
        {value}
      </span>
      <span
        className="mt-1 font-bold leading-none uppercase"
        style={{
          color: '#6B7EB0',
          fontSize: 8,
          letterSpacing: '1.2px',
          fontWeight: 700,
        }}
      >
        {label}
      </span>
    </div>
  );
}
