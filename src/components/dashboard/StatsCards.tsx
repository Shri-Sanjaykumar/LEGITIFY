'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import {
  ScanLine,
  AlertTriangle,
  Shield,
  FileText,
  TrendingUp,
  TrendingDown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { mockDashboardStats } from '@/lib/mock-data';

interface StatCard {
  label: string;
  value: number;
  decimals: number;
  trend: number;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  accentGlow: string;
}

const stats: StatCard[] = [
  {
    label: 'Total Scans',
    value: mockDashboardStats.totalScans,
    decimals: 0,
    trend: mockDashboardStats.scansTrend,
    icon: ScanLine,
    accentColor: '#3b82f6',
    accentBg: 'rgba(59, 130, 246, 0.12)',
    accentGlow: 'rgba(59, 130, 246, 0.2)',
  },
  {
    label: 'Scams Detected',
    value: mockDashboardStats.scamsDetected,
    decimals: 0,
    trend: mockDashboardStats.scamsTrend,
    icon: AlertTriangle,
    accentColor: '#ef4444',
    accentBg: 'rgba(239, 68, 68, 0.12)',
    accentGlow: 'rgba(239, 68, 68, 0.2)',
  },
  {
    label: 'Average Trust Score',
    value: mockDashboardStats.averageTrustScore,
    decimals: 1,
    trend: 3.2,
    icon: Shield,
    accentColor: '#10b981',
    accentBg: 'rgba(16, 185, 129, 0.12)',
    accentGlow: 'rgba(16, 185, 129, 0.2)',
  },
  {
    label: 'Reports Generated',
    value: mockDashboardStats.reportsGenerated,
    decimals: 0,
    trend: 15.7,
    icon: FileText,
    accentColor: '#a855f7',
    accentBg: 'rgba(168, 85, 247, 0.12)',
    accentGlow: 'rgba(168, 85, 247, 0.2)',
  },
];

function AnimatedNumber({
  value,
  decimals,
}: {
  value: number;
  decimals: number;
}) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const duration = 1800;
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);

    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const elapsed = timestamp - startTimeRef.current;
      const progress = Math.min(elapsed / duration, 1);
      const easedProgress = easeOutQuart(progress);

      setDisplayValue(easedProgress * value);

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };

    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  const formatted =
    decimals > 0
      ? displayValue.toFixed(decimals)
      : Math.floor(displayValue).toLocaleString();

  return <span>{formatted}</span>;
}

const containerVariants = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const cardVariants = {
  hidden: { opacity: 0, scale: 0.9, y: 20 },
  show: {
    opacity: 1,
    scale: 1,
    y: 0,
    transition: {
      type: 'spring' as const,
      stiffness: 300,
      damping: 24,
    },
  },
};

export default function StatsCards() {
  return (
    <motion.div
      variants={containerVariants}
      initial="hidden"
      animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6"
    >
      {stats.map((stat) => {
        const isPositive = stat.trend > 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;
        const trendColor = isPositive ? 'var(--success)' : 'var(--danger)';

        return (
          <motion.div
            key={stat.label}
            variants={cardVariants}
            className="group relative overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] p-5 transition-all duration-300 hover:border-[var(--border-secondary)]"
            style={{
              boxShadow: `0 0 0 0 ${stat.accentGlow}`,
            }}
            whileHover={{
              boxShadow: `0 0 30px ${stat.accentGlow}, 0 4px 12px rgba(0,0,0,0.3)`,
              y: -2,
            }}
          >
            {/* Background Gradient Accent */}
            <div
              className="absolute top-0 right-0 w-32 h-32 opacity-[0.04] rounded-full blur-2xl transition-opacity group-hover:opacity-[0.08]"
              style={{ background: stat.accentColor }}
            />

            <div className="flex items-start justify-between mb-4">
              {/* Icon Circle */}
              <div
                className="flex items-center justify-center w-11 h-11 rounded-xl transition-transform group-hover:scale-110"
                style={{ background: stat.accentBg }}
              >
                <stat.icon
                  className="w-5 h-5"
                  style={{ color: stat.accentColor }}
                />
              </div>

              {/* Trend Badge */}
              <div
                className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                style={{
                  color: trendColor,
                  background: isPositive
                    ? 'rgba(16, 185, 129, 0.1)'
                    : 'rgba(239, 68, 68, 0.1)',
                }}
              >
                <TrendIcon className="w-3 h-3" />
                <span>
                  {isPositive ? '+' : ''}
                  {stat.trend}%
                </span>
              </div>
            </div>

            {/* Value */}
            <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-1">
              <AnimatedNumber value={stat.value} decimals={stat.decimals} />
            </div>

            {/* Label */}
            <p className="text-sm text-[var(--text-secondary)]">{stat.label}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
