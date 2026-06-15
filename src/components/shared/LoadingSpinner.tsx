'use client';

import { Shield } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LoadingSpinnerProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
}

const sizeConfig = {
  sm: { container: 48, icon: 16, dotSize: 4, orbit: 20 },
  md: { container: 80, icon: 24, dotSize: 6, orbit: 34 },
  lg: { container: 120, icon: 36, dotSize: 8, orbit: 52 },
};

export default function LoadingSpinner({ size = 'md', text }: LoadingSpinnerProps) {
  const config = sizeConfig[size];

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative flex items-center justify-center"
        style={{ width: config.container, height: config.container }}
      >
        <Shield
          size={config.icon}
          className="text-primary"
          style={{ filter: 'drop-shadow(0 0 8px rgba(99, 102, 241, 0.5))' }}
        />
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="absolute rounded-full bg-primary"
            style={{
              width: config.dotSize,
              height: config.dotSize,
              animation: `orbit 2s linear infinite`,
              animationDelay: `${i * 0.5}s`,
              top: '50%',
              left: '50%',
              marginTop: -(config.dotSize / 2),
              marginLeft: -(config.dotSize / 2),
              transformOrigin: '50% 50%',
              boxShadow: '0 0 8px rgba(99, 102, 241, 0.6)',
            }}
          />
        ))}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            border: '2px solid transparent',
            borderTopColor: '#6366f1',
            borderRightColor: 'rgba(99, 102, 241, 0.3)',
            animation: 'spin-slow 3s linear infinite',
          }}
        />
      </div>
      {text && (
        <p
          className={cn(
            'text-muted font-medium',
            size === 'sm' ? 'text-xs' : size === 'md' ? 'text-sm' : 'text-base'
          )}
        >
          {text}
        </p>
      )}
    </div>
  );
}
