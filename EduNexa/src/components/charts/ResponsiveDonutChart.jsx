import React from 'react';
import {
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Tooltip,
  Legend,
} from 'recharts';

const PALETTE = [
  '#FFD978', // Main yellow accent
  '#10B981', // Emerald
  '#3B82F6', // Blue
  '#A855F7', // Purple
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#06B6D4', // Cyan
  '#64748B', // Slate
];

const CustomDonutTooltip = ({ active, payload }) => {
  if (active && payload && payload.length) {
    const data = payload[0];
    return (
      <div className="bg-slate-900/90 backdrop-blur-md text-white text-xs px-3 py-2 rounded-xl shadow-lg border border-slate-800">
        <p className="font-semibold text-slate-300">{data.name}</p>
        <p className="text-[#FFD978] font-black text-sm mt-0.5">
          {data.value} {data.payload?.unit || ''}
        </p>
      </div>
    );
  }
  return null;
};

const renderLegend = (props) => {
  const { payload } = props;
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 pt-2 text-xs">
      {payload.map((entry, index) => (
        <div key={`legend-${index}`} className="flex items-center gap-1.5">
          <span
            className="w-2.5 h-2.5 rounded-full"
            style={{ backgroundColor: entry.color }}
          />
          <span className="text-slate-600 font-medium text-[11px] truncate max-w-[120px]">
            {entry.value}
          </span>
        </div>
      ))}
    </div>
  );
};

export default function ResponsiveDonutChart({
  data = [],
  nameKey = 'name',
  dataKey = 'value',
  height = 260,
  innerRadius = 50,
  outerRadius = 78,
  showLegend = true,
}) {
  if (!data || data.length === 0) return null;

  return (
    <div style={{ width: '100%', height: `${height}px` }}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
          <Tooltip content={<CustomDonutTooltip />} />
          {showLegend && <Legend content={renderLegend} />}
          <Pie
            data={data}
            nameKey={nameKey}
            dataKey={dataKey}
            cx="50%"
            cy="45%"
            innerRadius={innerRadius}
            outerRadius={outerRadius}
            paddingAngle={3}
            stroke="#ffffff"
            strokeWidth={2}
          >
            {data.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={entry.fill || PALETTE[index % PALETTE.length]}
              />
            ))}
          </Pie>
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
