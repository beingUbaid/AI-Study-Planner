import React from 'react';
import { Brain } from 'lucide-react';

const Logo = ({ size = 'md', showText = true, className = '' }) => {
  const sizeMap = {
    sm: { iconContainer: 'p-1.5 rounded-lg', icon: 'w-4 h-4', text: 'text-base', subtext: 'text-[8px]' },
    md: { iconContainer: 'p-2.5 rounded-xl shadow-lg', icon: 'w-6 h-6', text: 'text-lg', subtext: 'text-[10px]' },
    lg: { iconContainer: 'p-3 rounded-xl shadow-lg', icon: 'w-8 h-8', text: 'text-2xl', subtext: 'text-xs' },
    xl: { iconContainer: 'p-4 rounded-2xl shadow-xl', icon: 'w-10 h-10', text: 'text-4xl', subtext: 'text-sm' }
  };

  const currentSize = sizeMap[size] || sizeMap.md;

  return (
    <div className={`flex items-center gap-3 select-none group ${className}`}>
      {/* Emblem (Old Brain Logo) */}
      <div className={`bg-gradient-to-tr from-primary-500 to-purple-600 flex items-center justify-center flex-shrink-0 text-white transition-transform group-hover:scale-105 duration-300 ${currentSize.iconContainer}`}>
        <Brain className={`${currentSize.icon}`} />
      </div>

      {/* Brand Name & Tagline */}
      {showText && (
        <div className="flex flex-col">
          <h1 className={`font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-primary-400 to-purple-400 leading-none ${currentSize.text}`}>
            StudyPlanner
          </h1>
          <p className={`text-slate-400 tracking-wider uppercase font-bold mt-1 ${currentSize.subtext}`}>
            AI Assistant Enabled
          </p>
        </div>
      )}
    </div>
  );
};

export default Logo;
