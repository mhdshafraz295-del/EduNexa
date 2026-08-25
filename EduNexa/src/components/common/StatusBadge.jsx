import React from 'react';

export default function StatusBadge({ status, label, className = '' }) {
  const normalized = String(status || '').toUpperCase();
  const displayLabel = label || normalized;

  const styleMap = {
    ACTIVE: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    APPROVED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PAID: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    VERIFIED: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    PRIMARY: 'bg-emerald-50 text-emerald-800 border-emerald-200',

    PENDING: 'bg-amber-50 text-amber-900 border-amber-200',
    PENDING_PAYMENT: 'bg-amber-50 text-amber-900 border-amber-200',
    PAYMENT_SUBMITTED: 'bg-amber-50 text-amber-900 border-amber-200',
    EXPIRING_SOON: 'bg-amber-50 text-amber-900 border-amber-200',
    UNPAID: 'bg-amber-50 text-amber-900 border-amber-200',

    EXPIRED: 'bg-rose-50 text-rose-800 border-rose-200',
    REJECTED: 'bg-rose-50 text-rose-800 border-rose-200',
    CANCELLED: 'bg-rose-50 text-rose-800 border-rose-200',
    INACTIVE: 'bg-slate-100 text-slate-700 border-slate-200',
    OVERDUE: 'bg-rose-50 text-rose-800 border-rose-200',

    PHYSICAL: 'bg-slate-100 text-slate-700 border-slate-200',
    ONLINE: 'bg-blue-50 text-blue-800 border-blue-200',
    HYBRID: 'bg-purple-50 text-purple-800 border-purple-200',
  };

  const currentStyle = styleMap[normalized] || 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${currentStyle} ${className}`}
    >
      {displayLabel}
    </span>
  );
}
