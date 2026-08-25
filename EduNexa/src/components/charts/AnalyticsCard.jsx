import React from 'react';
import ChartSkeleton from './ChartSkeleton';
import ChartEmptyState from './ChartEmptyState';

export default function AnalyticsCard({
  title,
  subtitle,
  icon: Icon,
  badge,
  action,
  loading = false,
  error = null,
  isEmpty = false,
  emptyMessage = 'No analytics data available yet.',
  emptyDescription,
  height = 260,
  children,
  className = '',
}) {
  return (
    <div
      className={`glass-card p-5 md:p-6 flex flex-col justify-between transition-all hover:shadow-sm ${className}`}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3 pb-3.5 mb-2 border-b border-slate-100/90">
        <div className="flex items-center gap-2.5">
          {Icon && (
            <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700 shrink-0">
              <Icon className="w-4 h-4" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
              {badge && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#FFD978]/30 text-slate-900 border border-[#FFD978]/50">
                  {badge}
                </span>
              )}
            </div>
            {subtitle && <p className="text-xs text-slate-400 mt-0.5">{subtitle}</p>}
          </div>
        </div>

        {action && <div className="shrink-0">{action}</div>}
      </div>

      {/* Content Area */}
      <div className="flex-1 w-full flex items-center justify-center">
        {loading ? (
          <ChartSkeleton height={height} />
        ) : error ? (
          <div className="w-full py-8 text-center bg-rose-50/70 border border-rose-200/70 rounded-xl text-rose-700 text-xs font-semibold">
            {error}
          </div>
        ) : isEmpty ? (
          <ChartEmptyState
            title={emptyMessage}
            description={emptyDescription}
            height={height}
          />
        ) : (
          <div className="w-full">{children}</div>
        )}
      </div>
    </div>
  );
}
