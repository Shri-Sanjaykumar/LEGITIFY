'use client';

import { useReportBreakdown } from '@/hooks/useReport';
import { ShieldCheck } from 'lucide-react';
import LoadingSpinner from '@/components/shared/LoadingSpinner';

interface ScoreBreakdownProps {
  reportId: string | null;
}

export default function ScoreBreakdown({ reportId }: ScoreBreakdownProps) {
  const { data: breakdown, isLoading, error } = useReportBreakdown(reportId);

  if (isLoading) {
    return (
      <div className="py-8 flex items-center justify-center">
        <LoadingSpinner size="sm" text="Loading audit logs..." />
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-6 text-center text-sm text-red-400">
        Failed to load audit trail for trust score calculation.
      </div>
    );
  }

  const items = breakdown || [];

  if (items.length === 0) {
    return (
      <div className="py-8 text-center text-sm text-[var(--text-tertiary)] border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)]">
        No rule evaluation records found for this report.
      </div>
    );
  }

  // Helper for category display name
  const getCategoryLabel = (category: string) => {
    return category.replace('_', ' ').toLowerCase();
  };

  // Helper for confidence badge colors
  const getConfidenceStyle = (confidence: string) => {
    switch (confidence) {
      case 'HIGH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'LOW':
      default:
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
    }
  };

  return (
    <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 space-y-4 text-left">
      <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-primary)]">
        <ShieldCheck className="w-5 h-5 text-indigo-500" />
        <div>
          <h3 className="text-lg font-semibold text-[var(--text-primary)]">Trust Score Audit Logs</h3>
          <p className="text-xs text-[var(--text-secondary)]">Explainable and auditable rule checks fired during scan.</p>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-[var(--border-primary)] text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
              <th className="py-3 px-4">Rule / Signal</th>
              <th className="py-3 px-4">Category</th>
              <th className="py-3 px-4 text-center">Confidence</th>
              <th className="py-3 px-4">Source</th>
              <th className="py-3 px-4 text-right">Score Impact</th>
            </tr>
          </thead>
          <tbody className="text-sm divide-y divide-[var(--border-primary)]/40">
            {items.map((item) => {
              const isDeduction = item.score_change < 0;
              const isZero = item.score_change === 0;

              return (
                <tr key={item.id} className="hover:bg-[var(--bg-elevated)]/40 transition-colors">
                  <td className="py-4 px-4 max-w-xs">
                    <div className="font-medium text-[var(--text-primary)]">
                      {item.rule_name.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
                    </div>
                    <div className="text-xs text-[var(--text-secondary)] mt-1">
                      {item.reason}
                    </div>
                  </td>
                  <td className="py-4 px-4 capitalize text-[var(--text-secondary)] text-xs">
                    <span className="bg-[#1a1a24] border border-[var(--border-primary)] px-2 py-0.5 rounded">
                      {getCategoryLabel(item.rule_category)}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-center">
                    <span className={`inline-block text-[10px] font-mono px-2 py-0.5 rounded-full border ${getConfidenceStyle(item.confidence)}`}>
                      {item.confidence}
                    </span>
                  </td>
                  <td className="py-4 px-4 text-[var(--text-secondary)] text-xs">
                    {item.source}
                  </td>
                  <td className={`py-4 px-4 text-right font-semibold font-mono ${isDeduction ? 'text-rose-400' : (isZero ? 'text-[var(--text-tertiary)]' : 'text-emerald-400')}`}>
                    {isDeduction ? `${item.score_change.toFixed(1)}` : (isZero ? '0.0' : `+${item.score_change.toFixed(1)}`)}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
