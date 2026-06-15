import { cn } from '@/lib/utils';
import type { ReactNode, ElementType } from 'react';

interface GradientTextProps {
  children: ReactNode;
  from?: string;
  to?: string;
  className?: string;
  as?: ElementType;
}

export default function GradientText({
  children,
  from = '#818cf8',
  to = '#22d3ee',
  className,
  as: Component = 'span',
}: GradientTextProps) {
  return (
    <Component
      className={cn('inline-block', className)}
      style={{
        background: `linear-gradient(135deg, ${from}, ${to})`,
        WebkitBackgroundClip: 'text',
        WebkitTextFillColor: 'transparent',
        backgroundClip: 'text',
      }}
    >
      {children}
    </Component>
  );
}
