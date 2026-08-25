import React from 'react';
import { BarChart3 } from 'lucide-react';

export default function ChartEmptyState({
  title = 'No analytics data available yet.',
  description,
  icon: Icon = BarChart3,
  height = 260,
}) {
  return (
    <div
      className="w-full rounded-xl bg-slate-50/50 border border-dashed border-slate-200/80 flex flex-col items-center justify-center p-6 text-center"
      style={{ minHeight: `${height}px` }}
    >
      <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 mb-2.5">
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs font-bold text-slate-700">{title}</p>
      {description && <p className="text-[11px] text-slate-400 mt-0.5 max-w-xs">{description}</p>}
    </div>
  );
}
