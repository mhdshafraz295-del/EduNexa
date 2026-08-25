import React from 'react';

export default function EmptyState({
  icon: Icon,
  title = 'No Data Found',
  description = 'There are no records to display at this moment.',
  action,
  className = '',
}) {
  return (
    <div className={`p-8 md:p-12 text-center glass-card border border-dashed border-slate-200 flex flex-col items-center justify-center ${className}`}>
      {Icon && (
        <div className="w-12 h-12 rounded-2xl bg-slate-100 text-slate-400 flex items-center justify-center mb-3.5 shadow-xs">
          <Icon className="w-6 h-6" />
        </div>
      )}
      <h4 className="text-base font-bold text-slate-800 tracking-tight">
        {title}
      </h4>
      <p className="text-xs md:text-sm text-slate-500 max-w-md mt-1 leading-relaxed">
        {description}
      </p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
