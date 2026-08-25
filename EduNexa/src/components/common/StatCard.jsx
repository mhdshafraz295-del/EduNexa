import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';

export default function StatCard({
  title,
  value,
  icon: Icon,
  subtitle,
  linkTo,
  linkLabel = 'View Details',
  className = '',
}) {
  return (
    <div className={`glass-card p-5 md:p-6 flex flex-col justify-between glass-card-hover ${className}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold uppercase tracking-wider text-slate-400 truncate">
            {title}
          </p>
          <h3 className="text-2xl md:text-3xl font-black text-slate-900 mt-1 tracking-tight">
            {value}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium mt-0.5 truncate">{subtitle}</p>
          )}
        </div>

        {Icon && (
          <div className="w-11 h-11 rounded-2xl bg-[#FFD978]/30 border border-[#FFD978]/60 text-slate-900 flex items-center justify-center shrink-0 shadow-xs">
            <Icon className="w-5 h-5" />
          </div>
        )}
      </div>

      {linkTo && (
        <div className="mt-4 pt-3 border-t border-slate-100/80">
          <Link
            to={linkTo}
            className="inline-flex items-center gap-1 text-xs font-bold text-slate-700 hover:text-slate-900 transition-colors"
          >
            <span>{linkLabel}</span>
            <ArrowRight className="w-3 h-3 text-[#FFD978]" />
          </Link>
        </div>
      )}
    </div>
  );
}
