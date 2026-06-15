'use client';

import { useEffect, useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { ScanLine, AlertTriangle, Shield, FileText, TrendingUp, TrendingDown } from 'lucide-react';

interface StatsData {
  totalScans: number;
  scamsDetected: number;
  averageTrustScore: number;
  reportsGenerated: number;
}

interface StatsCardsProps {
  stats?: StatsData;
  isLoading?: boolean;
}

interface StatCardConfig {
  label: string;
  value: number;
  decimals: number;
  trend: number;
  icon: React.ElementType;
  accentColor: string;
  accentBg: string;
  accentGlow: string;
}

// AnimatedNumber — easeOutQuart RAF animation
function AnimatedNumber({ value, decimals }: { value: number; decimals: number }) {
  const [displayValue, setDisplayValue] = useState(0);
  const startTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number>(0);

  useEffect(() => {
    const duration = 1500;
    const easeOutQuart = (t: number) => 1 - Math.pow(1 - t, 4);
    const animate = (timestamp: number) => {
      if (!startTimeRef.current) startTimeRef.current = timestamp;
      const progress = Math.min((timestamp - startTimeRef.current) / duration, 1);
      setDisplayValue(easeOutQuart(progress) * value);
      if (progress < 1) {
        rafRef.current = requestAnimationFrame(animate);
      }
    };
    rafRef.current = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value]);

  return <span>{decimals > 0 ? displayValue.toFixed(decimals) : Math.floor(displayValue).toLocaleString()}</span>;
}

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.1 } } };
const cardVariants = { 
  hidden: { opacity: 0, scale: 0.9, y: 20 }, 
  show: { opacity: 1, scale: 1, y: 0, transition: { type: 'spring' as const, stiffness: 300, damping: 24 } } 
};

export default function StatsCards({ stats, isLoading }: StatsCardsProps) {
  // Fallback to default mock values if not loaded
  const displayStats: StatCardConfig[] = [
    { 
      label: 'Total Scans', 
      value: stats?.totalScans ?? 0, 
      decimals: 0, 
      trend: 12.5, 
      icon: ScanLine, 
      accentColor: '#3b82f6', 
      accentBg: 'rgba(59,130,246,0.12)', 
      accentGlow: 'rgba(59,130,246,0.2)' 
    },
    { 
      label: 'Scams Detected', 
      value: stats?.scamsDetected ?? 0, 
      decimals: 0, 
      trend: -8.3, 
      icon: AlertTriangle, 
      accentColor: '#ef4444', 
      accentBg: 'rgba(239,68,68,0.12)', 
      accentGlow: 'rgba(239,68,68,0.2)' 
    },
    { 
      label: 'Average Trust Score', 
      value: stats?.averageTrustScore ?? 0, 
      decimals: 1, 
      trend: 3.2, 
      icon: Shield, 
      accentColor: '#10b981', 
      accentBg: 'rgba(16,185,129,0.12)', 
      accentGlow: 'rgba(16,185,129,0.2)' 
    },
    { 
      label: 'Reports Generated', 
      value: stats?.reportsGenerated ?? 0, 
      decimals: 0, 
      trend: 15.7, 
      icon: FileText, 
      accentColor: '#a855f7', 
      accentBg: 'rgba(168,85,247,0.12)', 
      accentGlow: 'rgba(168,85,247,0.2)' 
    },
  ];

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="animate-pulse h-[142px] rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] p-5">
            <div className="flex justify-between items-center mb-4">
              <div className="w-11 h-11 rounded-xl bg-[var(--border-primary)]" />
              <div className="w-16 h-6 rounded-full bg-[var(--border-primary)]" />
            </div>
            <div className="h-8 w-24 bg-[var(--border-primary)] rounded mb-2" />
            <div className="h-4 w-32 bg-[var(--border-primary)] rounded" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show"
      className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 lg:gap-6">
      {displayStats.map((stat) => {
        const isPositive = stat.trend > 0;
        const TrendIcon = isPositive ? TrendingUp : TrendingDown;
        const trendColor = isPositive ? 'var(--success)' : 'var(--danger)';
        return (
          <motion.div key={stat.label} variants={cardVariants}
            className="group relative overflow-hidden rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] p-5 transition-all duration-300 hover:border-[var(--border-secondary)]"
            style={{ boxShadow: `0 0 0 0 ${stat.accentGlow}` }}
            whileHover={{ boxShadow: `0 0 30px ${stat.accentGlow}, 0 4px 12px rgba(0,0,0,0.3)`, y: -2 }}>
            <div className="absolute top-0 right-0 w-32 h-32 opacity-[0.04] rounded-full blur-2xl group-hover:opacity-[0.08]" style={{ background: stat.accentColor }} />
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center justify-center w-11 h-11 rounded-xl transition-transform group-hover:scale-110" style={{ background: stat.accentBg }}>
                <stat.icon className="w-5 h-5" style={{ color: stat.accentColor }} />
              </div>
              <div className="flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold"
                style={{ color: trendColor, background: isPositive ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)' }}>
                <TrendIcon className="w-3 h-3" />
                <span>{isPositive ? '+' : ''}{stat.trend}%</span>
              </div>
            </div>
            <div className="text-3xl font-bold text-[var(--text-primary)] tracking-tight mb-1">
              <AnimatedNumber value={stat.value} decimals={stat.decimals} />
            </div>
            <p className="text-sm text-[var(--text-secondary)]">{stat.label}</p>
          </motion.div>
        );
      })}
    </motion.div>
  );
}
