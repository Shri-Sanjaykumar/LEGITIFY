'use client';

import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { cn } from '@/lib/utils';

type TimeRange = '7D' | '30D' | '90D';

function generateMockData(days: number) {
  const data = [];
  const now = new Date();
  for (let i = days - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);

    const baseScore = 65 + Math.sin(i * 0.3) * 15;
    const noise = (Math.random() - 0.5) * 20;
    const score = Math.min(95, Math.max(40, baseScore + noise));

    data.push({
      date: date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      score: Math.round(score * 10) / 10,
    });
  }
  return data;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
}

function CustomTooltip({ active, payload, label }: CustomTooltipProps) {
  if (!active || !payload || !payload.length) return null;

  return (
    <div className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded-lg px-3.5 py-2.5 shadow-xl">
      <p className="text-xs text-[var(--text-tertiary)] mb-1">{label}</p>
      <p className="text-sm font-bold text-[var(--text-primary)]">
        Trust Score:{' '}
        <span className="text-[var(--primary-light)]">{payload[0].value}</span>
      </p>
    </div>
  );
}

const timeRanges: TimeRange[] = ['7D', '30D', '90D'];

export default function TrustChart() {
  const [activeRange, setActiveRange] = useState<TimeRange>('30D');

  const data = useMemo(() => {
    const daysMap: Record<TimeRange, number> = {
      '7D': 7,
      '30D': 30,
      '90D': 90,
    };
    return generateMockData(daysMap[activeRange]);
  }, [activeRange]);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: 0.15 }}
      className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">
          Trust Score Trends
        </h3>
        <div className="flex items-center gap-1 p-1 bg-[var(--bg-elevated)] rounded-lg">
          {timeRanges.map((range) => (
            <button
              key={range}
              onClick={() => setActiveRange(range)}
              className={cn(
                'px-3 py-1.5 rounded-md text-xs font-semibold transition-all duration-200',
                activeRange === range
                  ? 'bg-[var(--primary)] text-white shadow-md'
                  : 'text-[var(--text-tertiary)] hover:text-[var(--text-secondary)]'
              )}
            >
              {range}
            </button>
          ))}
        </div>
      </div>

      {/* Chart */}
      <div className="p-5">
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart
              data={data}
              margin={{ top: 5, right: 5, left: -15, bottom: 0 }}
            >
              <defs>
                <linearGradient
                  id="trustScoreGradient"
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="1"
                >
                  <stop offset="0%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="50%" stopColor="#6366f1" stopOpacity={0.08} />
                  <stop offset="100%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="rgba(30, 41, 59, 0.5)"
                vertical={false}
              />
              <XAxis
                dataKey="date"
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'var(--text-muted)',
                  fontSize: 11,
                  fontFamily: 'Inter',
                }}
                interval="preserveStartEnd"
                dy={10}
              />
              <YAxis
                domain={[0, 100]}
                axisLine={false}
                tickLine={false}
                tick={{
                  fill: 'var(--text-muted)',
                  fontSize: 11,
                  fontFamily: 'Inter',
                }}
                dx={-5}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="score"
                stroke="#6366f1"
                strokeWidth={2.5}
                fill="url(#trustScoreGradient)"
                dot={false}
                activeDot={{
                  r: 5,
                  fill: '#6366f1',
                  stroke: '#1e1b4b',
                  strokeWidth: 3,
                }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>
    </motion.div>
  );
}
