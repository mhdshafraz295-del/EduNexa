import React from 'react';

export default function ChartSkeleton({ height = 260 }) {
  return (
    <div
      className="w-full rounded-xl bg-slate-100/70 animate-pulse flex flex-col justify-end p-4 gap-3"
      style={{ height: `${height}px` }}
    >
      <div className="flex items-end justify-between gap-2 h-3/4 w-full">
        <div className="w-full bg-slate-200/80 rounded-t-lg h-1/3" />
        <div className="w-full bg-slate-200/80 rounded-t-lg h-2/3" />
        <div className="w-full bg-slate-200/80 rounded-t-lg h-1/2" />
        <div className="w-full bg-slate-200/80 rounded-t-lg h-4/5" />
        <div className="w-full bg-slate-200/80 rounded-t-lg h-3/5" />
        <div className="w-full bg-slate-200/80 rounded-t-lg h-2/5" />
        <div className="w-full bg-slate-200/80 rounded-t-lg h-1/2" />
      </div>
      <div className="h-3 w-full bg-slate-200/60 rounded" />
    </div>
  );
}
