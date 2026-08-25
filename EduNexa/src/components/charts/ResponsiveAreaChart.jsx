import React from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';

const CustomAreaTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-slate-800">
        <p className="font-semibold text-slate-300">{label}</p>
        {payload.map((p, idx) => (
          <p key={idx} className="text-[#FFD978] font-black text-sm mt-0.5">
            {p.name ? `${p.name}: ` : ''}
            {p.value} {unit}
          </p>
        ))}
      </div>
    );
  }
  return null;
};

export default function ResponsiveAreaChart({
  data = [],
  xKey = 'month',
  yKey = 'count',
  areaName = 'Total',
  height = 260,
  strokeColor = '#E6BC50',
  fillColor = '#FFD978',
  unit = '',
}) {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={fillColor} stopOpacity={0.45} />
              <stop offset="95%" stopColor={fillColor} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis
            dataKey={xKey}
            tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
            tickFormatter={(val) => (typeof val === 'string' && val.length > 10 ? `${val.slice(0, 8)}…` : val)}
            axisLine={{ stroke: '#e2e8f0' }}
            tickLine={false}
          />
          <YAxis
            allowDecimals={false}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip content={<CustomAreaTooltip unit={unit} />} />
          <Area
            type="monotone"
            dataKey={yKey}
            name={areaName}
            stroke={strokeColor}
            strokeWidth={2.5}
            fillOpacity={1}
            fill="url(#areaGradient)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
