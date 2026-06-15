'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { getTrustLabel, cn } from '@/lib/utils';

interface TrustGaugeProps {
  score: number;
  confidence: number;
  size?: number;
}

function getGaugeColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 30) return '#f59e0b';
  return '#ef4444';
}

function getBadgeClass(score: number): string {
  if (score >= 70) return 'badge-safe';
  if (score >= 30) return 'badge-warning';
  return 'badge-danger';
}

export default function TrustGauge({ score, confidence, size = 200 }: TrustGaugeProps) {
  const [animatedScore, setAnimatedScore] = useState(0);
  const strokeWidth = 12;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;
  const color = getGaugeColor(score);
  const label = getTrustLabel(score);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedScore(score), 100);
    return () => clearTimeout(timer);
  }, [score]);

  const progress = animatedScore / 100;
  const dashOffset = circumference * (1 - progress);

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          {/* Background track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="var(--border-primary)"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
          />
          {/* Animated arc */}
          <motion.circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke={color}
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.5, type: 'spring', bounce: 0.2 }}
            style={{
              filter: `drop-shadow(0 0 8px ${color}80)`,
            }}
          />
        </svg>

        {/* Center text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center rotate-0">
          <motion.span
            key={animatedScore}
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.3, type: 'spring' }}
            className="font-bold leading-none"
            style={{
              fontSize: size * 0.22,
              color,
            }}
          >
            {score}
          </motion.span>
          <span
            className="font-medium"
            style={{
              fontSize: size * 0.08,
              color: 'var(--text-tertiary)',
            }}
          >
            /100
          </span>
        </div>
      </div>

      <div className="text-center space-y-2">
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>
          Confidence: <span className="font-semibold" style={{ color: 'var(--text-primary)' }}>{confidence}%</span>
        </p>
        <span className={cn('badge', getBadgeClass(score))}>
          {label}
        </span>
      </div>
    </div>
  );
}
