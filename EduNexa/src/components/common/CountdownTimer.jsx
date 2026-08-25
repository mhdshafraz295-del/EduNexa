import React, { useState, useEffect, useRef } from 'react';
import { Clock, AlertTriangle, AlertCircle } from 'lucide-react';

export default function CountdownTimer({
  remainingSeconds: initialRemainingSeconds,
  serverDeadline,
  onTimeout,
  className = '',
}) {
  const [secondsLeft, setSecondsLeft] = useState(initialRemainingSeconds || 0);
  const onTimeoutRef = useRef(onTimeout);
  onTimeoutRef.current = onTimeout;

  useEffect(() => {
    // If serverDeadline is provided, calculate remaining seconds accurately against client clock
    const calculateSeconds = () => {
      if (serverDeadline) {
        const diffMs = new Date(serverDeadline).getTime() - Date.now();
        return Math.max(0, Math.floor(diffMs / 1000));
      }
      return initialRemainingSeconds || 0;
    };

    setSecondsLeft(calculateSeconds());

    const interval = setInterval(() => {
      const remaining = calculateSeconds();
      setSecondsLeft(remaining);

      if (remaining <= 0) {
        clearInterval(interval);
        if (onTimeoutRef.current) {
          onTimeoutRef.current();
        }
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [serverDeadline, initialRemainingSeconds]);

  const hours = Math.floor(secondsLeft / 3600);
  const minutes = Math.floor((secondsLeft % 3600) / 60);
  const seconds = secondsLeft % 60;
  const pad = (n) => String(n).padStart(2, '0');
  const formattedTime = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;

  // Determine warning level:
  // <= 60s (1m): Pulsing strong red alert
  // <= 300s (5m): Strong red alert
  // <= 600s (10m): Warning orange
  // <= 900s (15m): Warning yellow
  // > 900s: Neutral dark
  const isOneMinute = secondsLeft > 0 && secondsLeft <= 60;
  const isFiveMinutes = secondsLeft > 60 && secondsLeft <= 300;
  const isTenMinutes = secondsLeft > 300 && secondsLeft <= 600;
  const isFifteenMinutes = secondsLeft > 600 && secondsLeft <= 900;

  let timerColorClass = 'bg-slate-900 text-white border-slate-800';
  let badgeColorClass = 'text-[#FFD978]';

  if (isOneMinute) {
    timerColorClass = 'bg-rose-600 text-white border-rose-700 animate-pulse shadow-lg shadow-rose-600/30';
    badgeColorClass = 'text-white';
  } else if (isFiveMinutes) {
    timerColorClass = 'bg-rose-500 text-white border-rose-600 shadow-md shadow-rose-500/20';
    badgeColorClass = 'text-white';
  } else if (isTenMinutes) {
    timerColorClass = 'bg-amber-600 text-white border-amber-700';
    badgeColorClass = 'text-amber-100';
  } else if (isFifteenMinutes) {
    timerColorClass = 'bg-amber-500/90 text-white border-amber-600';
    badgeColorClass = 'text-white';
  }

  return (
    <div className={`flex flex-col items-center sm:items-end ${className}`}>
      <div className={`flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-mono font-black text-sm tracking-wider shadow-sm transition-all duration-300 ${timerColorClass}`}>
        <Clock className={`w-4 h-4 ${badgeColorClass}`} />
        <span>{formattedTime}</span>
      </div>

      {/* Warning message boxes */}
      {isOneMinute && (
        <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1 animate-pulse">
          <AlertCircle className="w-3 h-3" />
          <span>Final minute! Auto-submitting at 00:00.</span>
        </p>
      )}

      {isFiveMinutes && (
        <p className="text-[10px] font-bold text-rose-600 mt-1 flex items-center gap-1">
          <AlertTriangle className="w-3 h-3" />
          <span>Under 5 mins left. Please review your answers.</span>
        </p>
      )}

      {(isTenMinutes || isFifteenMinutes) && (
        <p className="text-[10px] font-semibold text-amber-700 mt-0.5">
          {isTenMinutes ? '10 minutes remaining.' : '15 minutes remaining.'}
        </p>
      )}
    </div>
  );
}
