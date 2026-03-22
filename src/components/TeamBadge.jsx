import { useState } from 'react';
import { motion } from 'framer-motion';
import { TEAM_BRANDING, TEAM_LOGOS } from '../lib/constants';

const SIZES = {
  sm: { container: 32, logo: 22, abbr: 10, name: 7 },
  md: { container: 46, logo: 32, abbr: 13, name: 9 },
  lg: { container: 58, logo: 40, abbr: 15, name: 10 },
};

export default function TeamBadge({ team, size = 'md', selected = false, onClick, disabled = false }) {
  const [imgError, setImgError] = useState(false);
  const branding = TEAM_BRANDING[team];
  const logo = TEAM_LOGOS[team];
  const dims = SIZES[size] || SIZES.md;

  if (!branding) return null;

  const shortName = branding.name.split(' ').slice(0, 2).join(' ');

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={disabled}
      whileHover={!disabled ? { scale: 1.05 } : {}}
      whileTap={!disabled ? { scale: 0.95 } : {}}
      className="flex flex-col items-center gap-1.5 min-w-[80px] py-2 px-2 rounded-xl transition-all duration-200"
      style={{
        cursor: disabled ? 'default' : 'pointer',
        backgroundColor: selected ? 'rgba(200, 230, 41, 0.1)' : 'transparent',
        border: selected ? '1px solid rgba(200, 230, 41, 0.3)' : '1px solid transparent',
      }}
    >
      {/* Logo circle */}
      <div
        className="rounded-full flex items-center justify-center overflow-hidden transition-all duration-200"
        style={{
          width: dims.container,
          height: dims.container,
          backgroundColor: `${branding.primary}1F`,
          border: selected
            ? '2.5px solid #C8E629'
            : `2px solid ${branding.primary}40`,
          boxShadow: selected ? '0 0 12px rgba(200, 230, 41, 0.25)' : 'none',
        }}
      >
        {!imgError && logo ? (
          <img
            src={logo}
            alt={branding.name}
            style={{ width: dims.logo, height: dims.logo }}
            onError={() => setImgError(true)}
            className="object-contain"
          />
        ) : (
          <span
            className="font-bold flex items-center justify-center w-full h-full rounded-full"
            style={{
              color: branding.textOnPrimary,
              fontSize: dims.logo * 0.35,
              backgroundColor: branding.primary,
            }}
          >
            {team}
          </span>
        )}
      </div>

      {/* Team abbreviation */}
      <span
        className="font-bold leading-none"
        style={{
          color: branding.primary,
          fontSize: dims.abbr,
          fontWeight: 700,
        }}
      >
        {team}
      </span>

      {/* Short team name */}
      <span
        className="leading-none text-center"
        style={{
          color: '#6B7EB0',
          fontSize: dims.name,
          fontWeight: 500,
          maxWidth: 80,
        }}
      >
        {shortName}
      </span>
    </motion.button>
  );
}
