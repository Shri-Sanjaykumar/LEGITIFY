'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Building2,
  Globe,
  ExternalLink,
  ShieldCheck,
  ShieldAlert,
  Clock,
  Database,
  RefreshCw,
  Server,
  ArrowRight,
  Info,
  Layers,
} from 'lucide-react';
import {
  useSearchCompanyVerification,
  useCompanyVerification,
  useCreateCompanyVerification,
} from '@/hooks/useCompany';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import { cn } from '@/lib/utils';

interface CompanyVerificationPanelProps {
  domain: string;
}

export default function CompanyVerificationPanel({ domain }: CompanyVerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const searchResult = useSearchCompanyVerification(domain);
  const matchedVerification = searchResult.data;

  const detailsResult = useCompanyVerification(matchedVerification ? matchedVerification.id : null);
  const details = detailsResult.data;

  const createMutation = useCreateCompanyVerification();

  const handleVerify = async () => {
    if (!domain) return;
    setIsVerifying(true);
    try {
      // Clean company name from domain name
      const companyName = domain.split('.')[0].toUpperCase();
      await createMutation.mutateAsync({
        company_name: companyName,
        website: domain,
      });
      // Refetch history search to discover the new pending verification
      searchResult.refetch();
    } catch (e) {
      console.error('Failed to start company verification:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!domain) {
    return (
      <div className="py-8 text-center text-sm text-[var(--text-tertiary)] border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)]">
        No target corporate website detected for company verification.
      </div>
    );
  }

  const isLoading = searchResult.isLoading || (matchedVerification && detailsResult.isLoading);

  if (isLoading || isVerifying) {
    return (
      <div className="p-8 border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)] flex flex-col items-center justify-center min-h-[200px]">
        <LoadingSpinner size="md" text="Querying company registry and website audits..." />
      </div>
    );
  }

  // State 1: No verification on record
  if (!matchedVerification) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 text-left space-y-4 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
            <Building2 size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Company Verification Engine</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Query corporate registry metadata, domain details, reachability, contact details, and consistency checks to audit company legitimacy.
            </p>
          </div>
        </div>

        <div className="bg-[#111118]/80 border border-[var(--border-primary)]/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 text-sm font-medium text-[var(--text-primary)]">
              <Globe size={16} className="text-[var(--text-tertiary)]" />
              <span>Domain: {domain}</span>
            </div>
            <p className="text-xs text-[var(--text-tertiary)]">
              No verification audit history exists for this domain on LEGITIFY.
            </p>
          </div>
          <button
            onClick={handleVerify}
            disabled={createMutation.isPending}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white rounded-lg text-sm font-medium transition-all shadow-md shadow-indigo-600/10 active:scale-95"
          >
            {createMutation.isPending ? 'Queuing Verification...' : 'Run Verification Audit'}
            <ArrowRight size={16} />
          </button>
        </div>
      </motion.div>
    );
  }

  const verification = details?.verification || matchedVerification;
  const breakdowns = details?.breakdowns || [];
  const evidence = details?.evidence || [];

  const status = verification.verification_status; // PENDING, PROCESSING, COMPLETED, FAILED
  const level = verification.verification_level; // VERIFIED, LIKELY_VERIFIED, etc.
  const score = verification.verification_score;
  const confidence = verification.verification_confidence; // LOW, MEDIUM, HIGH

  // State 2: Verification Pending or Processing
  if (status === 'PENDING' || status === 'PROCESSING') {
    return (
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 text-left space-y-6 relative overflow-hidden">
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 animate-pulse">
              <Clock size={20} />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-[var(--text-primary)]">Verification In Progress</h3>
              <p className="text-xs text-[var(--text-secondary)]">Running crawler algorithms and registry checks.</p>
            </div>
          </div>
          <div className="text-xs font-mono bg-[#1a1a24] border border-[var(--border-primary)] px-2 py-0.5 rounded text-[var(--text-secondary)]">
            STATUS: {status}
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex justify-between text-xs text-[var(--text-secondary)]">
            <span>Scanning {domain}</span>
            <span className="animate-pulse">Analyzing signals...</span>
          </div>
          <div className="w-full bg-[var(--border-primary)]/40 rounded-full h-1.5 overflow-hidden">
            <div className="bg-indigo-500 h-1.5 rounded-full w-2/3 animate-[pulse_2s_infinite]" />
          </div>
        </div>
      </div>
    );
  }

  // State 3: Verification Failed
  if (status === 'FAILED') {
    return (
      <div className="rounded-xl border border-rose-500/30 bg-[var(--bg-card)] p-6 text-left space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-500">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Verification Audit Failed</h3>
            <p className="text-xs text-[var(--text-secondary)]">
              An error occurred during DNS lookups, SSL validation, or connection timeouts.
            </p>
          </div>
        </div>
        <div className="pt-2 flex justify-end">
          <button
            onClick={handleVerify}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--bg-elevated)] border border-[var(--border-primary)] rounded-lg text-sm text-[var(--text-primary)] hover:bg-[var(--border-primary)] transition-all"
          >
            <RefreshCw size={14} /> Retry Verification Audit
          </button>
        </div>
      </div>
    );
  }

  // Helpers for styling
  const getLevelBadgeClass = (lvl: string) => {
    switch (lvl) {
      case 'VERIFIED':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'LIKELY_VERIFIED':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'PARTIALLY_VERIFIED':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'SUSPICIOUS':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'UNVERIFIED':
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  const getConfidenceBadgeClass = (conf: string) => {
    switch (conf) {
      case 'HIGH':
        return 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20';
      case 'MEDIUM':
        return 'bg-purple-500/10 text-purple-400 border-purple-500/20';
      case 'LOW':
      default:
        return 'bg-zinc-500/10 text-zinc-400 border-zinc-500/20';
    }
  };

  const getReliabilityBadgeClass = (rel: string) => {
    switch (rel) {
      case 'HIGH':
        return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'LOW':
      default:
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    }
  };

  const getSeverityBadgeClass = (sev: string) => {
    switch (sev) {
      case 'CRITICAL':
        return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
      case 'HIGH':
        return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
      case 'MEDIUM':
        return 'bg-amber-500/10 text-amber-400 border-amber-500/20';
      case 'LOW':
        return 'bg-teal-500/10 text-teal-400 border-teal-500/20';
      case 'INFO':
      default:
        return 'bg-blue-500/10 text-blue-400 border-blue-500/20';
    }
  };

  const getScoreColor = (scr: number) => {
    if (scr >= 80) return 'text-emerald-400 border-emerald-500/30';
    if (scr >= 60) return 'text-teal-400 border-teal-500/30';
    if (scr >= 40) return 'text-amber-400 border-amber-500/30';
    if (scr >= 20) return 'text-orange-400 border-orange-500/30';
    return 'text-rose-400 border-rose-500/30';
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 text-left"
    >
      {/* 1. Header Details Panel */}
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 rounded-full blur-3xl pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 pb-6 border-b border-[var(--border-primary)]">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-500/10 border border-indigo-500/20 flex items-center justify-center text-indigo-400 shrink-0">
              <Building2 size={24} />
            </div>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-bold text-[var(--text-primary)]">
                  {verification.company_name}
                </h3>
                <span className={cn('badge text-[10px] font-semibold border', getLevelBadgeClass(level))}>
                  {level.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2 text-sm text-[var(--text-secondary)]">
                <Globe size={14} className="text-[var(--text-tertiary)]" />
                <a
                  href={`https://${verification.website}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:underline flex items-center gap-1 hover:text-[var(--text-primary)]"
                >
                  {verification.website} <ExternalLink size={12} />
                </a>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-4 shrink-0">
            {/* Score circle */}
            <div className={cn('flex flex-col items-center justify-center px-4 py-2 border rounded-xl bg-[#0c0c14]', getScoreColor(score))}>
              <span className="text-2xl font-mono font-bold leading-none">{score}</span>
              <span className="text-[10px] text-[var(--text-tertiary)] mt-1">VERIFICATION SCORE</span>
            </div>

            {/* Confidence Badge */}
            <div className="flex flex-col gap-1 items-start">
              <span className="text-[10px] uppercase font-semibold tracking-wider text-[var(--text-tertiary)]">
                Confidence
              </span>
              <span className={cn('badge text-[10px] font-mono border', getConfidenceBadgeClass(confidence))}>
                {confidence}
              </span>
            </div>
          </div>
        </div>

        {/* Caching Lifecycle Section */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6 text-xs text-[var(--text-secondary)]">
          <div className="flex items-center gap-2 bg-[#111118] border border-[var(--border-primary)]/40 p-2.5 rounded-lg">
            <Clock size={14} className="text-indigo-400" />
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Last Checked</div>
              <div className="font-mono text-[var(--text-primary)]">
                {verification.last_verified_at
                  ? new Date(verification.last_verified_at).toLocaleString()
                  : 'Never'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#111118] border border-[var(--border-primary)]/40 p-2.5 rounded-lg">
            <Server size={14} className="text-teal-400" />
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Cache Expires</div>
              <div className="font-mono text-[var(--text-primary)]">
                {verification.verification_expires_at
                  ? new Date(verification.verification_expires_at).toLocaleString()
                  : 'N/A'}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 bg-[#111118] border border-[var(--border-primary)]/40 p-2.5 rounded-lg">
            <RefreshCw size={14} className="text-amber-400" />
            <div>
              <div className="text-[10px] text-[var(--text-tertiary)] uppercase font-semibold">Re-Verify Scheduled</div>
              <div className="font-mono text-[var(--text-primary)]">
                {verification.next_verification_at
                  ? new Date(verification.next_verification_at).toLocaleString()
                  : verification.verification_expires_at
                  ? new Date(verification.verification_expires_at).toLocaleString()
                  : 'N/A'}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Enterprise Corporate Registry Hooks Placeholders */}
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-primary)]">
          <Database className="w-5 h-5 text-indigo-400" />
          <div>
            <h4 className="text-base font-bold text-[var(--text-primary)]">Government Registry Connectors</h4>
            <p className="text-xs text-[var(--text-secondary)]">Automated corporate record sync hooks.</p>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {[
            { name: 'MCA (India)', desc: 'CIN/GST Registry' },
            { name: 'SEC (USA)', desc: 'EDGAR Filings' },
            { name: 'Companies House (UK)', desc: 'UK Register' },
            { name: 'Govt Registries', desc: 'State Licenses' },
            { name: 'Business Directories', desc: 'Local Chambers' },
          ].map((reg, i) => (
            <div
              key={i}
              className="bg-[#111118] border border-[var(--border-primary)]/60 rounded-lg p-3 text-center flex flex-col justify-between min-h-[90px] relative overflow-hidden group"
            >
              <div className="text-xs font-semibold text-[var(--text-primary)]">{reg.name}</div>
              <div className="text-[9px] text-[var(--text-tertiary)] mt-1">{reg.desc}</div>
              <div className="mt-2">
                <span className="inline-block text-[8px] tracking-wide font-mono px-1.5 py-0.5 rounded-full border border-indigo-500/20 bg-indigo-500/5 text-indigo-400 uppercase font-semibold">
                  HOOK_PLANNED
                </span>
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-[var(--text-tertiary)] bg-[#111118]/40 p-2 rounded border border-[var(--border-primary)]/20">
          <Info size={12} className="text-indigo-400 shrink-0" />
          <span>Government and corporate registry hooks require an enterprise license to verify legal incorporation status automatically.</span>
        </div>
      </div>

      {/* 3. Score Breakdown & Signals */}
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-primary)]">
          <Layers className="w-5 h-5 text-teal-400" />
          <div>
            <h4 className="text-base font-bold text-[var(--text-primary)]">Verification Signal Audit</h4>
            <p className="text-xs text-[var(--text-secondary)]">Signal-level breakdowns with source reliability metrics.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                <th className="py-2.5 px-3">Rule / Signal</th>
                <th className="py-2.5 px-3">Category</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
                <th className="py-2.5 px-3 text-center">Source Reliability</th>
                <th className="py-2.5 px-3 text-right">Score Impact</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-[var(--border-primary)]/40">
              {breakdowns.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-[var(--text-tertiary)]">
                    No signal evaluation audit trail records found.
                  </td>
                </tr>
              ) : (
                breakdowns.map((bd) => {
                  const isDeduction = bd.score_change < 0;
                  const isZero = bd.score_change === 0;
                  return (
                    <tr key={bd.id} className="hover:bg-[var(--bg-elevated)]/20 transition-colors">
                      <td className="py-3.5 px-3">
                        <div className="font-medium text-[var(--text-primary)] text-xs">
                          {bd.rule_name.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())}
                        </div>
                        <div className="text-[10px] text-[var(--text-secondary)] mt-0.5">
                          {bd.reason}
                        </div>
                      </td>
                      <td className="py-3.5 px-3 capitalize text-[var(--text-secondary)] text-[10px] font-mono">
                        {bd.category.replace('_', ' ').toLowerCase()}
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={cn('inline-block text-[9px] font-mono px-2 py-0.5 rounded-full border', getConfidenceBadgeClass(bd.confidence))}>
                          {bd.confidence}
                        </span>
                      </td>
                      <td className="py-3.5 px-3 text-center">
                        <span className={cn('inline-block text-[9px] font-mono px-2 py-0.5 rounded-full border', getReliabilityBadgeClass(bd.source_reliability))}>
                          {bd.source_reliability}
                        </span>
                      </td>
                      <td className={cn('py-3.5 px-3 text-right font-semibold font-mono text-xs', isDeduction ? 'text-rose-400' : isZero ? 'text-[var(--text-tertiary)]' : 'text-emerald-400')}>
                        {isDeduction ? `${bd.score_change}` : isZero ? '0.0' : `+${bd.score_change}`}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Auditable Evidence list */}
      <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-primary)]">
          <ShieldCheck className="w-5 h-5 text-indigo-400" />
          <div>
            <h4 className="text-base font-bold text-[var(--text-primary)]">Auditable Company Evidence</h4>
            <p className="text-xs text-[var(--text-secondary)]">Verification evidence records log for compliance checks.</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[var(--border-primary)] text-xs font-semibold text-[var(--text-tertiary)] uppercase tracking-wider">
                <th className="py-2.5 px-3">Evidence Type</th>
                <th className="py-2.5 px-3">Description</th>
                <th className="py-2.5 px-3">Source</th>
                <th className="py-2.5 px-3 text-center">Severity</th>
                <th className="py-2.5 px-3 text-center">Confidence</th>
              </tr>
            </thead>
            <tbody className="text-sm divide-y divide-[var(--border-primary)]/40">
              {evidence.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-4 text-center text-xs text-[var(--text-tertiary)]">
                    No physical verification evidence items logged.
                  </td>
                </tr>
              ) : (
                evidence.map((ev) => (
                  <tr key={ev.id} className="hover:bg-[var(--bg-elevated)]/20 transition-colors">
                    <td className="py-3 px-3">
                      <span className="bg-[#1a1a24] border border-[var(--border-primary)] px-2 py-0.5 rounded text-[10px] font-mono text-[var(--text-primary)]">
                        {ev.evidence_type}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-xs text-[var(--text-secondary)] max-w-sm">
                      {ev.description}
                    </td>
                    <td className="py-3 px-3 text-xs text-[var(--text-secondary)] font-medium">
                      {ev.source}
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={cn('inline-block text-[9px] font-mono px-2 py-0.5 rounded-full border', getSeverityBadgeClass(ev.severity))}>
                        {ev.severity}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-center">
                      <span className={cn('inline-block text-[9px] font-mono px-2 py-0.5 rounded-full border', getConfidenceBadgeClass(ev.confidence))}>
                        {ev.confidence}
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </motion.div>
  );
}