'use client';

import { motion } from 'framer-motion';
import { Clock, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { InvestigationStep } from '@/types';

interface TimelineProps {
  steps: InvestigationStep[];
}

const statusConfig = {
  completed: {
    color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20',
    dotColor: 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]',
    icon: CheckCircle2,
  },
  failed: {
    color: 'text-red-500 bg-red-500/10 border-red-500/20',
    dotColor: 'bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.5)]',
    icon: XCircle,
  },
  skipped: {
    color: 'text-gray-400 bg-gray-500/10 border-gray-500/20',
    dotColor: 'bg-gray-400 shadow-[0_0_8px_rgba(156,163,175,0.5)]',
    icon: AlertCircle,
  },
};

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
    },
  },
};

const itemVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { type: 'spring' as const, stiffness: 100, damping: 15 },
  },
};

export default function Timeline({ steps }: TimelineProps) {
  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-[var(--border-primary)]">
        <Clock className="w-5 h-5 text-[var(--primary)]" />
        <h3 className="text-lg font-semibold text-[var(--text-primary)]">
          Investigation Timeline
        </h3>
      </div>

      <motion.div
        variants={containerVariants}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, margin: '-50px' }}
        className="relative pl-6 border-l border-[var(--border-primary)] space-y-8"
      >
        {steps.map((step, index) => {
          const config = statusConfig[step.status] || statusConfig.skipped;
          const Icon = config.icon;

          return (
            <motion.div
              key={step.id || index}
              variants={itemVariants}
              className="relative group"
            >
              {/* Timeline Dot */}
              <div
                className={cn(
                  'absolute -left-[31px] top-1.5 w-2.5 h-2.5 rounded-full border border-black',
                  config.dotColor
                )}
              />

              {/* Timeline Item Content */}
              <div className="flex flex-col md:flex-row md:items-start gap-4">
                {/* Agent Badge & Duration */}
                <div className="flex items-center gap-2.5 shrink-0 md:w-44">
                  <span
                    className={cn(
                      'px-2.5 py-1 text-xs font-semibold rounded-md border shrink-0',
                      config.color
                    )}
                  >
                    {step.agentName}
                  </span>
                  <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] border border-[var(--border-primary)] px-1.5 py-0.5 rounded-md font-mono shrink-0">
                    {step.duration.toFixed(1)}s
                  </span>
                </div>

                {/* Description & Action */}
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-1.5">
                    <Icon className={cn('w-4 h-4', config.color.split(' ')[0])} />
                    <h4 className="text-sm font-medium text-[var(--text-primary)]">
                      {step.action}
                    </h4>
                  </div>
                  <p className="text-xs text-[var(--text-secondary)] leading-relaxed">
                    {step.result}
                  </p>
                </div>
              </div>
            </motion.div>
          );
        })}
      </motion.div>
    </div>
  );
}
