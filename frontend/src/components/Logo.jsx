import React from 'react';

const Logo = ({ size = 'md', showText = true, className = '' }) => {
  const sizeMap = {
    sm: { icon: 'w-7 h-7', text: 'text-base', badge: 'text-[9px] px-1.5 py-0.5' },
    md: { icon: 'w-9 h-9', text: 'text-xl', badge: 'text-[10px] px-2 py-0.5' },
    lg: { icon: 'w-11 h-11', text: 'text-2xl', badge: 'text-xs px-2.5 py-1' },
    xl: { icon: 'w-14 h-14', text: 'text-4xl', badge: 'text-sm px-3 py-1' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-3 select-none group ${className}`}>
      {/* Emblem */}
      <div className={`relative flex items-center justify-center flex-shrink-0 ${currentSize.icon}`}>
        {/* Glow backdrop */}
        <div className="absolute -inset-1 bg-gradient-to-r from-teal-400 via-purple-500 to-indigo-500 rounded-2xl blur-md opacity-75 group-hover:opacity-100 transition-opacity duration-300 animate-pulse"></div>
        
        {/* SVG Container */}
        <div className="relative w-full h-full bg-slate-950 rounded-2xl p-1 border border-white/20 flex items-center justify-center shadow-xl overflow-hidden">
          <svg
            viewBox="0 0 100 100"
            className="w-full h-full fill-none"
            xmlns="http://www.w3.org/2000/svg"
          >
            <defs>
              <linearGradient id="logoGradPrimary" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#14b8a6" />
                <stop offset="50%" stopColor="#8b5cf6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="logoGradSpark" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#2dd4bf" />
                <stop offset="100%" stopColor="#a855f7" />
              </linearGradient>
            </defs>

            {/* Academic Cap / Book Base */}
            <path
              d="M20 62 L50 78 L80 62 L80 42 L50 58 L20 42 Z"
              fill="url(#logoGradPrimary)"
              opacity="0.85"
            />
            
            {/* Open Book Wings */}
            <path
              d="M15 48 C 30 38, 45 42, 50 48 C 55 42, 70 38, 85 48 L 85 70 C 70 60, 55 64, 50 70 C 45 64, 30 60, 15 70 Z"
              fill="url(#logoGradPrimary)"
              stroke="#ffffff"
              strokeWidth="3.5"
              strokeLinejoin="round"
            />

            {/* Center AI Sparkle */}
            <path
              d="M50 15 Q50 32 67 32 Q50 32 50 49 Q50 32 33 32 Q50 32 50 15 Z"
              fill="url(#logoGradSpark)"
            />
            
            {/* Outer Orbital Ring */}
            <circle
              cx="50"
              cy="50"
              r="44"
              stroke="url(#logoGradSpark)"
              strokeWidth="4"
              strokeDasharray="14 10"
              opacity="0.75"
            />
          </svg>
        </div>
      </div>

      {/* Brand Name & Tagline */}
      {showText && (
        <div className="flex flex-col">
          <div className="flex items-center gap-1.5">
            <span className={`font-black tracking-tight text-white ${currentSize.text}`}>
              Study<span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-400 via-purple-400 to-indigo-400">Planner</span>
            </span>
            <span className={`font-mono font-extrabold rounded-lg bg-gradient-to-r from-teal-500 to-purple-600 text-white shadow-md uppercase tracking-wider ${currentSize.badge}`}>
              AI
            </span>
          </div>
          <span className="text-[10px] text-slate-400 font-semibold tracking-widest uppercase">
            Smart Learning Assistant
          </span>
        </div>
      )}
    </div>
  );
};

export default Logo;
