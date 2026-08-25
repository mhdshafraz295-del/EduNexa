import React from 'react';

export default function PageHeader({
  title,
  description,
  subtitle,
  badge,
  action,
  secondaryAction,
  children,
  className = '',
}) {
  const effectiveDescription = description || subtitle;
  const effectiveAction = action || children;

  return (
    <div className={`flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 ${className}`}>
      <div>
        {badge && (
          <div className="mb-1.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold bg-[#FFD978]/40 text-slate-900 border border-[#FFD978]/60">
              {badge}
            </span>
          </div>
        )}
        <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
          {title}
        </h1>
        {effectiveDescription && (
          <p className="text-sm text-slate-500 mt-1 max-w-2xl leading-relaxed">
            {effectiveDescription}
          </p>
        )}
      </div>

      {(effectiveAction || secondaryAction) && (
        <div className="flex flex-wrap items-center gap-3 shrink-0">
          {secondaryAction}
          {effectiveAction}
        </div>
      )}
    </div>
  );
}
