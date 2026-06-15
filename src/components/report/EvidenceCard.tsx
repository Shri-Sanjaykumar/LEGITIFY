'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown, AlertTriangle, AlertCircle, Info, XCircle } from 'lucide-react';

import type { RiskDimension, Evidence } from '@/types';

interface EvidenceCardProps {
  dimension: RiskDimension;
}

function getSeverityConfig(severity: Evidence['severity']) {
  switch (severity) {
    case 'critical':
      return {
        color: '#ef4444',
        bg: 'rgba(239, 68, 68, 0.1)',
        border: 'rgba(239, 68, 68, 0.2)',
        icon: XCircle,
        label: 'Critical',
      };
    case 'high':
      return {
        color: '#f97316',
        bg: 'rgba(249, 115, 22, 0.1)',
        border: 'rgba(249, 115, 22, 0.2)',
        icon: AlertTriangle,
        label: 'High',
      };
    case 'medium':
      return {
        color: '#f59e0b',
        bg: 'rgba(245, 158, 11, 0.1)',
        border: 'rgba(245, 158, 11, 0.2)',
        icon: AlertCircle,
        label: 'Medium',
      };
    case 'low':
      return {
        color: '#10b981',
        bg: 'rgba(16, 185, 129, 0.1)',
        border: 'rgba(16, 185, 129, 0.2)',
        icon: Info,
        label: 'Low',
      };
  }
}

function getScoreBadgeStyle(score: number) {
  if (score >= 70) return { color: '#10b981', bg: 'rgba(16, 185, 129, 0.12)', border: 'rgba(16, 185, 129, 0.25)' };
  if (score >= 30) return { color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.12)', border: 'rgba(245, 158, 11, 0.25)' };
  return { color: '#ef4444', bg: 'rgba(239, 68, 68, 0.12)', border: 'rgba(239, 68, 68, 0.25)' };
}

export default function EvidenceCard({ dimension }: EvidenceCardProps) {
  const [expanded, setExpanded] = useState(false);
  const scoreBadge = getScoreBadgeStyle(dimension.score);

  return (
    <motion.div
      layout
      className="rounded-xl overflow-hidden"
      style={{
        background: 'var(--bg-card)',
        border: '1px solid var(--border-primary)',
      }}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between p-5 transition-colors hover:bg-[var(--bg-elevated)]"
      >
        <div className="flex items-center gap-3">
          <span
            className="text-sm font-semibold"
            style={{ color: 'var(--text-primary)' }}
          >
            {dimension.name}
          </span>
          <span
            className="text-xs font-bold px-2.5 py-0.5 rounded-full"
            style={{
              color: scoreBadge.color,
              background: scoreBadge.bg,
              border: `1px solid ${scoreBadge.border}`,
            }}
          >
            {dimension.score}/100
          </span>
        </div>

        <motion.div
          animate={{ rotate: expanded ? 180 : 0 }}
          transition={{ duration: 0.2 }}
        >
          <ChevronDown size={18} style={{ color: 'var(--text-tertiary)' }} />
        </motion.div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div
              className="px-5 pb-5 space-y-3"
              style={{ borderTop: '1px solid var(--border-primary)' }}
            >
              <div className="pt-4">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded"
                  style={{
                    background: 'rgba(99, 102, 241, 0.1)',
                    color: '#818cf8',
                  }}
                >
                  {dimension.label}
                </span>
              </div>

              {dimension.evidence.map((ev) => {
                const severity = getSeverityConfig(ev.severity);
                const SeverityIcon = severity.icon;

                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="flex gap-3 p-3 rounded-lg"
                    style={{
                      background: 'var(--bg-elevated)',
                      border: '1px solid var(--glass-border)',
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-md flex items-center justify-center shrink-0 mt-0.5"
                      style={{ background: severity.bg }}
                    >
                      <SeverityIcon size={14} style={{ color: severity.color }} />
                    </div>

                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span
                          className="text-xs font-bold uppercase px-1.5 py-0.5 rounded"
                          style={{
                            color: severity.color,
                            background: severity.bg,
                            border: `1px solid ${severity.border}`,
                          }}
                        >
                          {severity.label}
                        </span>
                        <span
                          className="text-xs px-1.5 py-0.5 rounded"
                          style={{
                            background: 'rgba(99, 102, 241, 0.08)',
                            color: 'var(--text-tertiary)',
                          }}
                        >
                          {ev.source}
                        </span>
                      </div>
                      <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                        {ev.description}
                      </p>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
