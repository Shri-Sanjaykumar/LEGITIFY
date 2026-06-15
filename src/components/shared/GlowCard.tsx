'use client';

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

interface GlowCardProps {
  children: ReactNode;
  className?: string;
  glowColor?: string;
}

export default function GlowCard({
  children,
  className,
  glowColor = '#6366f1',
}: GlowCardProps) {
  return (
    <motion.div
      whileHover={{
        scale: 1.01,
        y: -2,
        borderColor: glowColor,
        boxShadow: `0 0 20px ${glowColor}25, 0 0 40px ${glowColor}10`,
      }}
      transition={{ type: 'tween', duration: 0.25 }}
      className={cn(
        'rounded-xl p-6',
        className
      )}
      style={{
        background: '#111118',
        border: '1px solid var(--border-primary)',
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
      }}
    >
      {children}
    </motion.div>
  );
}
