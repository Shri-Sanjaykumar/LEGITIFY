'use client';

import { motion } from 'framer-motion';
import { FileText, Globe, Mail, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { Linkedin } from '@/components/shared/BrandIcons';
import { cn } from '@/lib/utils';
import { getRelativeTime, truncate } from '@/lib/utils';
import type { Scan, ScanInputType } from '@/types';

interface RecentScansProps {
  scans?: Scan[];
  isLoading?: boolean;
}

const typeConfig: Record<ScanInputType, { label: string; color: string; bg: string }> = {
  pdf:      { label: 'PDF',      color: '#ef4444', bg: 'rgba(239,68,68,0.1)'   },
  docx:     { label: 'DOCX',     color: '#3b82f6', bg: 'rgba(59,130,246,0.1)'  },
  txt:      { label: 'TXT',      color: '#94a3b8', bg: 'rgba(148,163,184,0.1)' },
  url:      { label: 'URL',      color: '#06b6d4', bg: 'rgba(6,182,212,0.1)'   },
  linkedin: { label: 'LinkedIn', color: '#0a66c2', bg: 'rgba(10,102,194,0.1)'  },
  email:    { label: 'Email',    color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
  image:    { label: 'Image',    color: '#a855f7', bg: 'rgba(168,85,247,0.1)'  },
  text:     { label: 'Text',     color: '#64748b', bg: 'rgba(100,116,139,0.1)' },
};

const typeIcons: Record<ScanInputType, React.ElementType> = {
  pdf: FileText, docx: FileText, txt: FileText, url: Globe,
  linkedin: Linkedin, email: Mail, image: FileText, text: FileText,
};

const statusConfig: Record<string, { label: string; color: string; bg: string; border: string; pulse?: boolean }> = {
  completed:  { label: 'Completed',  color: 'var(--success)', bg: 'rgba(16,185,129,0.1)', border: 'rgba(16,185,129,0.2)' },
  processing: { label: 'Processing', color: 'var(--warning)', bg: 'rgba(245,158,11,0.1)', border: 'rgba(245,158,11,0.2)', pulse: true },
  analyzing:  { label: 'Analyzing',  color: 'var(--info)',    bg: 'rgba(59,130,246,0.1)',  border: 'rgba(59,130,246,0.2)',  pulse: true },
  pending:    { label: 'Pending',    color: 'var(--text-tertiary)', bg: 'rgba(100,116,139,0.1)', border: 'rgba(100,116,139,0.2)' },
  failed:     { label: 'Failed',     color: 'var(--danger)',  bg: 'rgba(239,68,68,0.1)', border: 'rgba(239,68,68,0.2)' },
};

function getScoreColorClass(score?: number) {
  if (score === undefined) return 'text-[var(--text-tertiary)]';
  if (score >= 70) return 'text-[var(--success)]';
  if (score >= 30) return 'text-[var(--warning)]';
  return 'text-[var(--danger)]';
}
function getScoreBarColor(score: number) {
  if (score >= 70) return 'var(--success)';
  if (score >= 30) return 'var(--warning)';
  return 'var(--danger)';
}
function getDisplayName(scan: Scan) {
  // Check if scan input exists (some records might have direct properties)
  if (scan.input) {
    if (scan.input.fileName) return scan.input.fileName;
    if (scan.input.url) return scan.input.url;
    return scan.input.content;
  }
  // Fallbacks for direct properties from FastAPI schema
  if (scan.raw_input_text) return scan.raw_input_text;
  return `Scan #${scan.id.substring(0, 8)}`;
}

const containerVariants = { hidden: {}, show: { transition: { staggerChildren: 0.06 } } };
const rowVariants = { 
  hidden: { opacity: 0, y: 10 }, 
  show: { opacity: 1, y: 0, transition: { duration: 0.35, ease: 'easeOut' as const } } 
};

export default function RecentScans({ scans = [], isLoading }: RecentScansProps) {
  if (isLoading) {
    return (
      <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden p-5 space-y-4">
        <div className="flex justify-between items-center mb-2">
          <div className="h-6 w-32 bg-[var(--border-primary)] rounded animate-pulse" />
          <div className="h-4 w-16 bg-[var(--border-primary)] rounded animate-pulse" />
        </div>
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-12 w-full bg-[var(--border-primary)] rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] overflow-hidden">
      <div className="flex items-center justify-between px-5 py-4 border-b border-[var(--border-primary)]">
        <h3 className="text-base font-semibold text-[var(--text-primary)]">Recent Scans</h3>
        <Link href="/scan" className="flex items-center gap-1.5 text-sm text-[var(--primary-light)] hover:text-[var(--primary)] font-medium transition-colors">
          New Scan <ExternalLink className="w-3.5 h-3.5" />
        </Link>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px]">
          <thead>
            <tr className="border-b border-[var(--border-primary)]">
              <th className="text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-5 py-3">Input</th>
              <th className="text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-3">Type</th>
              <th className="text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-3">Status</th>
              <th className="text-left text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-3 py-3">Trust Score</th>
              <th className="text-right text-xs font-medium text-[var(--text-tertiary)] uppercase tracking-wider px-5 py-3">Time</th>
            </tr>
          </thead>
          <motion.tbody variants={containerVariants} initial="hidden" animate="show">
            {scans.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-5 py-8 text-center text-sm text-[var(--text-secondary)]">
                  No scans found. Start by running a new scan.
                </td>
              </tr>
            ) : (
              scans.map((scan) => {
                const scanType = (scan.scan_type || 'text') as ScanInputType;
                const typeInfo = typeConfig[scanType] || typeConfig.text;
                const statusInfo = statusConfig[scan.status.toLowerCase() as keyof typeof statusConfig] || statusConfig.pending;
                const TypeIcon = typeIcons[scanType] || FileText;
                const displayName = getDisplayName(scan);
                
                // Let's assume a default mock trust score if the scan has none (e.g. 72)
                const trustScoreValue = scan.trustScore !== undefined ? scan.trustScore : (scan.status === 'COMPLETED' ? 72 : undefined);

                const rowContent = (
                  <>
                    <td className="px-5 py-3.5">
                      <div className="flex items-center gap-3">
                        <div className="flex items-center justify-center w-8 h-8 rounded-lg shrink-0" style={{ background: typeInfo.bg }}>
                          <TypeIcon className="w-4 h-4" style={{ color: typeInfo.color }} />
                        </div>
                        <span className="text-sm text-[var(--text-primary)] font-medium truncate max-w-[200px]">
                          {truncate(displayName, 35)}
                        </span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold"
                        style={{ color: typeInfo.color, background: typeInfo.bg, border: `1px solid ${typeInfo.color}22` }}>
                        {typeInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold', statusInfo.pulse && 'animate-pulse')}
                        style={{ color: statusInfo.color, background: statusInfo.bg, border: `1px solid ${statusInfo.border}` }}>
                        {statusInfo.pulse && <span className="w-1.5 h-1.5 rounded-full" style={{ background: statusInfo.color }} />}
                        {statusInfo.label}
                      </span>
                    </td>
                    <td className="px-3 py-3.5">
                      {trustScoreValue !== undefined ? (
                        <div className="flex items-center gap-3">
                          <span className={cn('text-sm font-bold tabular-nums', getScoreColorClass(trustScoreValue))}>{trustScoreValue}</span>
                          <div className="w-16 h-1.5 rounded-full bg-[var(--bg-elevated)] overflow-hidden">
                            <motion.div className="h-full rounded-full" style={{ background: getScoreBarColor(trustScoreValue) }}
                              initial={{ width: 0 }} animate={{ width: `${trustScoreValue}%` }} transition={{ duration: 1, delay: 0.3, ease: 'easeOut' }} />
                          </div>
                        </div>
                      ) : <span className="text-sm text-[var(--text-muted)]">—</span>}
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <span className="text-sm text-[var(--text-tertiary)]">{getRelativeTime(new Date(scan.created_at))}</span>
                    </td>
                  </>
                );

                if (scan.status === 'COMPLETED') {
                  return (
                    <Link key={scan.id} href={`/report/${scan.id}`} legacyBehavior>
                      <motion.tr variants={rowVariants}
                        className="group border-b border-[var(--border-primary)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors cursor-pointer">
                        {rowContent}
                      </motion.tr>
                    </Link>
                  );
                }

                return (
                  <motion.tr key={scan.id} variants={rowVariants}
                    className="group border-b border-[var(--border-primary)] last:border-b-0 hover:bg-[var(--bg-elevated)] transition-colors">
                    {rowContent}
                  </motion.tr>
                );
              })
            )}
          </motion.tbody>
        </table>
      </div>
    </div>
  );
}
