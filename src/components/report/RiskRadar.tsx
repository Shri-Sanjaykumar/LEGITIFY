'use client';

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  Radar,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import type { TrustScore } from '@/types';

interface RiskRadarProps {
  dimensions: TrustScore['dimensions'];
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { payload: { name: string; score: number; label: string } }[];
}

function CustomTooltip({ active, payload }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  const data = payload[0].payload;

  return (
    <div
      className="px-4 py-3 rounded-lg text-sm"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
        boxShadow: '0 8px 24px rgba(0, 0, 0, 0.4)',
      }}
    >
      <p className="font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>
        {data.name}
      </p>
      <p style={{ color: 'var(--text-secondary)' }}>
        Score: <span className="font-bold" style={{ color: '#818cf8' }}>{data.score}</span>/100
      </p>
      <p className="text-xs mt-0.5" style={{ color: 'var(--text-tertiary)' }}>
        {data.label}
      </p>
    </div>
  );
}

export default function RiskRadar({ dimensions }: RiskRadarProps) {
  const data = Object.entries(dimensions).map(([, dim]) => ({
    name: dim.name.replace(' Analysis', '').replace(' Verification', '').replace(' Intelligence', '').replace(' Reputation', ''),
    score: dim.score,
    label: dim.label,
    fullMark: 100,
  }));

  return (
    <ResponsiveContainer width="100%" height={320}>
      <RadarChart data={data} cx="50%" cy="50%" outerRadius="75%">
        <PolarGrid
          stroke="var(--border-primary)"
          strokeOpacity={0.6}
        />
        <PolarAngleAxis
          dataKey="name"
          tick={{
            fill: 'var(--text-secondary)',
            fontSize: 12,
            fontWeight: 500,
          }}
        />
        <Radar
          name="Trust Score"
          dataKey="score"
          stroke="#6366f1"
          fill="#6366f1"
          fillOpacity={0.15}
          strokeWidth={2}
        />
        <Tooltip content={<CustomTooltip />} />
      </RadarChart>
    </ResponsiveContainer>
  );
}
