'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';

interface TrustBadgeProps {
  score: number;
  size?: 'sm' | 'md' | 'lg';
}

const sizeMap = {
  sm: 32,
  md: 48,
  lg: 64,
};

const fontSizeMap = {
  sm: 'text-xs',
  md: 'text-sm',
  lg: 'text-lg',
};

function getScoreColor(score: number): string {
  if (score >= 70) return '#10b981';
  if (score >= 30) return '#f59e0b';
  return '#ef4444';
}

function getGlowShadow(score: number): string {
  if (score >= 70) return '0 0 12px rgba(16, 185, 129, 0.4), 0 0 24px rgba(16, 185, 129, 0.15)';
  if (score >= 30) return '0 0 12px rgba(245, 158, 11, 0.4), 0 0 24px rgba(245, 158, 11, 0.15)';
  return '0 0 12px rgba(239, 68, 68, 0.4), 0 0 24px rgba(239, 68, 68, 0.15)';
}

export default function TrustBadge({ score, size = 'md' }: TrustBadgeProps) {
  const px = sizeMap[size];
  const color = getScoreColor(score);
  const glow = getGlowShadow(score);

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ type: 'spring', stiffness: 260, damping: 20 }}
      className={cn(
        'inline-flex items-center justify-center rounded-full font-bold',
        fontSizeMap[size]
      )}
      style={{
        width: px,
        height: px,
        backgroundColor: `${color}15`,
        border: `2px solid ${color}`,
        color,
        boxShadow: glow,
      }}
    >
      {score}
    </motion.div>
  );
}
