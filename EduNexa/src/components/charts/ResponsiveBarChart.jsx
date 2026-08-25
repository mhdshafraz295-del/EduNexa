import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts';

const CustomTooltip = ({ active, payload, label, unit = '' }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-slate-800">
        <p className="font-semibold text-slate-200">{label || data.name}</p>
        <p className="text-[#FFD978] font-black text-sm mt-0.5">
          {data.value} {unit}
        </p>
      </div>
    );
  }
  return null;
};

export default function ResponsiveBarChart({
  data = [],
  xKey = 'name',
  yKey = 'count',
  height = 260,
  barColor = '#FFD978',
  unit = '',
  layout = 'horizontal',
}) {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart
          data={data}
          layout={layout}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          {layout === 'horizontal' ? (
            <>
              <XAxis
                dataKey={xKey}
                tick={{ fill: '#94a3b8', fontSize: 11, fontWeight: 500 }}
                tickFormatter={(val) => (typeof val === 'string' && val.length > 12 ? `${val.slice(0, 10)}…` : val)}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
            </>
          ) : (
            <>
              <XAxis
                type="number"
                allowDecimals={false}
                tick={{ fill: '#94a3b8', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey={xKey}
                tick={{ fill: '#64748b', fontSize: 11, fontWeight: 600 }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
                width={80}
              />
            </>
          )}
          <Tooltip
            content={<CustomTooltip unit={unit} />}
            cursor={{ fill: '#f8fafc', opacity: 0.8 }}
          />
          <Bar
            dataKey={yKey}
            radius={[6, 6, 0, 0]}
            maxBarSize={48}
            fill={barColor}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill || barColor}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
