import React from 'react';
import officialLogo from '../../assets/logo.png';

export default function EduNexaLogo({
  size = 'md',
  className = '',
  showTagline = false,
  variant = 'default',
}) {
  const sizeClasses = {
    xs: 'h-6',
    sm: 'h-8',
    md: 'h-10',
    lg: 'h-14',
    xl: 'h-20',
  };

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <img
        src={officialLogo}
        alt="EduNexa Official Logo"
        className={`${sizeClasses[size] || 'h-10'} w-auto object-contain transition-transform duration-200 select-none`}
        onError={(e) => {
          // fallback to public path if bundled asset has issue, with loop prevention
          if (!e.target.dataset.fallbackTriggered) {
            e.target.dataset.fallbackTriggered = 'true';
            e.target.src = '/logo.png';
          }
        }}
      />
      {showTagline && (
        <div className="flex flex-col">
          <span className="text-xs font-semibold uppercase tracking-wider text-amber-800 bg-amber-100 px-2 py-0.5 rounded-md border border-amber-200">
            Multi-Institute SaaS
          </span>
        </div>
      )}
    </div>
  );
}
