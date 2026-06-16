'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  Globe,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  Server,
  Info,
  Layers,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Activity,
  History,
} from 'lucide-react';
import {
  useDomainVerification,
  useSearchDomainVerification,
  useCreateDomainVerification,
  useDomainReputation,
} from '@/hooks/useDomain';
import LoadingSpinner from '@/components/shared/LoadingSpinner';
import AnimatedCounter from '@/components/shared/AnimatedCounter';
import { cn } from '@/lib/utils';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

interface DomainIntelligencePanelProps {
  domain: string;
}

export default function DomainIntelligencePanel({ domain }: DomainIntelligencePanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const searchResult = useSearchDomainVerification(domain);
  const matchedVerification = searchResult.data;

  const detailsResult = useDomainVerification(matchedVerification ? matchedVerification.id : null);
  const details = detailsResult.data;

  const reputationResult = useDomainReputation(matchedVerification ? matchedVerification.domain : null);
  const snapshots = reputationResult.data || [];

  const createMutation = useCreateDomainVerification();

  const handleVerify = async () => {
    if (!domain) return;
    setIsVerifying(true);
    try {
      await createMutation.mutateAsync({
        domain: domain,
        verification_source: 'WEB_UI',
      });
      // Refetch history search to discover the new pending/completed verification
      searchResult.refetch();
    } catch (e) {
      console.error('Failed to start domain verification:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!domain) {
    return (
      <div className="py-8 text-center text-sm text-[var(--text-tertiary)] border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)]">
        No domain parsed for verification audits.
      </div>
    );
  }

  const isLoading = searchResult.isLoading || (matchedVerification && detailsResult.isLoading);

  if (isLoading || isVerifying) {
    return (
      <div className="p-8 border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)] flex flex-col items-center justify-center min-h-[250px]">
        <LoadingSpinner size="md" text="Auditing domain DNS, MX records, SPF/DMARC/DKIM rules, and SSL chain..." />
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
            <Globe size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Domain Security Intelligence</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Perform complete DNS lookup, mail server detection, security configuration checks (SPF, DMARC, DKIM), and active SSL validity audits.
            </p>
          </div>
        </div>

        <div className="bg-[#111118]/80 border border-[var(--border-primary)]/60 rounded-lg p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Target Domain</div>
            <div className="text-sm font-mono text-[var(--text-primary)] font-bold">{domain}</div>
          </div>
          <button
            onClick={handleVerify}
            className="px-4 py-2 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] text-xs font-semibold rounded-lg shadow-lg flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} className="animate-spin-slow" />
            Audit Domain Security
          </button>
        </div>
      </motion.div>
    );
  }

  const verification = matchedVerification;
  const isPendingOrProcessing =
    verification.verification_status === 'PENDING' ||
    verification.verification_status === 'PROCESSING';

  if (isPendingOrProcessing) {
    return (
      <div className="p-8 border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)] flex flex-col items-center justify-center min-h-[250px] space-y-4">
        <LoadingSpinner size="md" text={`Domain analysis in progress (${verification.verification_status.toLowerCase()})...`} />
        <p className="text-xs text-[var(--text-tertiary)]">Fetching DNS records and performing handshake audits...</p>
      </div>
    );
  }

  // Get current state elements
  const score = verification.verification_score;
  const level = verification.verification_level;
  const confidence = verification.verification_confidence;

  // Level classification classes
  const levelConfig: Record<string, { label: string; text: string; bg: string; border: string; icon: React.ComponentType<{ size?: number }> }> = {
    VERIFIED: {
      label: 'Verified Secure',
      text: 'text-emerald-400',
      bg: 'bg-emerald-500/10',
      border: 'border-emerald-500/20',
      icon: ShieldCheck,
    },
    LIKELY_VERIFIED: {
      label: 'Likely Verified',
      text: 'text-teal-400',
      bg: 'bg-teal-500/10',
      border: 'border-teal-500/20',
      icon: ShieldCheck,
    },
    PARTIALLY_VERIFIED: {
      label: 'Partially Verified',
      text: 'text-amber-400',
      bg: 'bg-amber-500/10',
      border: 'border-amber-500/20',
      icon: AlertTriangle,
    },
    SUSPICIOUS: {
      label: 'Suspicious Domain',
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon: ShieldAlert,
    },
    UNVERIFIED: {
      label: 'Unverified Domain',
      text: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
      icon: AlertTriangle,
    },
    INTERNAL_DOMAIN: {
      label: 'Internal Network Domain',
      text: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      icon: Server,
    },
  };

  const levelInfo = levelConfig[level] || levelConfig.UNVERIFIED;
  const LevelIcon = levelInfo.icon;

  // Technical checks
  const checks = [
    { label: 'DNS Resolution', value: verification.dns_status, desc: 'A/NS record availability' },
    { label: 'MX (Mail Server)', value: verification.mx_status, desc: 'Mail servers configuration' },
    { label: 'SPF Records', value: verification.spf_status, desc: 'Sender Policy Framework rule' },
    { label: 'DMARC Policy', value: verification.dmarc_status, desc: 'Domain authentication rule' },
    { label: 'DKIM Probes', value: verification.dkim_status, desc: 'Cryptographic email headers' },
    { label: 'SSL Certificate', value: verification.ssl_status, desc: 'HTTPS certificate state' },
  ];

  const getCheckStatusColor = (val: string) => {
    switch (val) {
      case 'VALID':
      case 'RESOLVED':
      case 'PRESENT':
      case 'CONFIGURED':
      case 'ENFORCED':
        return 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
      case 'ABSENT':
      case 'INVALID':
      case 'EXPIRED':
      case 'UNRESOLVED':
      case 'NO_MX':
        return 'text-rose-400 bg-rose-500/10 border-rose-500/20';
      case 'UNKNOWN':
      default:
        return 'text-slate-400 bg-slate-500/10 border-slate-500/20';
    }
  };

  const getCheckStatusIcon = (val: string) => {
    switch (val) {
      case 'VALID':
      case 'RESOLVED':
      case 'PRESENT':
      case 'CONFIGURED':
      case 'ENFORCED':
        return CheckCircle2;
      case 'ABSENT':
      case 'INVALID':
      case 'EXPIRED':
      case 'UNRESOLVED':
      case 'NO_MX':
        return XCircle;
      case 'UNKNOWN':
      default:
        return Info;
    }
  };

  // Recharts reputation data format
  const chartData = [...snapshots]
    .reverse()
    .map((s) => ({
      date: new Date(s.captured_at).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
      }),
      score: s.verification_score,
    }));

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* LEFT COLUMN: Overview & Technical grid */}
      <div className="lg:col-span-1 space-y-6">
        {/* Domain Overview Card */}
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 relative overflow-hidden flex flex-col items-center text-center space-y-4">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />
          
          <div className="flex items-center gap-2">
            <Globe className="text-[var(--text-secondary)]" size={18} />
            <span className="font-mono text-sm font-semibold tracking-tight truncate max-w-[180px]">
              {verification.domain}
            </span>
          </div>

          {/* Score Counter */}
          <div className="relative flex items-center justify-center w-36 h-36 rounded-full border-4 border-[var(--border-primary)] bg-[#11111a] shadow-inner">
            <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-pulse" />
            <div className="flex flex-col items-center">
              <span className="text-4xl font-extrabold text-white tracking-tight">
                <AnimatedCounter value={score} decimals={1} />
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] font-semibold uppercase tracking-widest mt-1">Domain Score</span>
            </div>
          </div>

          {/* Level Badges */}
          <div className="space-y-2 w-full">
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-bold shadow-sm", levelInfo.bg, levelInfo.text, levelInfo.border)}>
              <LevelIcon size={14} />
              {levelInfo.label}
            </div>

            <div className="flex items-center justify-center gap-4 text-xs mt-2 border-t border-[var(--border-primary)]/40 pt-3">
              <div>
                <span className="text-[var(--text-tertiary)] block">Confidence</span>
                <span className="font-semibold text-[var(--text-primary)]">{confidence}</span>
              </div>
              <div className="w-px h-6 bg-[var(--border-primary)]/40" />
              <div>
                <span className="text-[var(--text-tertiary)] block">Status</span>
                <span className="font-semibold text-emerald-400 flex items-center gap-1">
                  {verification.verification_status}
                </span>
              </div>
            </div>
          </div>

          <button
            onClick={handleVerify}
            className="w-full mt-2 py-2.5 px-4 bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[var(--text-secondary)] hover:text-white hover:bg-[var(--border-primary)]/50 rounded-lg text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm"
          >
            <RefreshCw size={13} />
            Re-Audit Domain
          </button>
        </div>

        {/* Technical Status Grid */}
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 space-y-4">
          <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
            <Activity size={16} className="text-indigo-400" />
            Technical Indicators
          </h4>
          <div className="grid grid-cols-2 gap-3">
            {checks.map((c, idx) => {
              const StateIcon = getCheckStatusIcon(c.value);
              const statusClasses = getCheckStatusColor(c.value);
              return (
                <div
                  key={idx}
                  className="rounded-lg border border-[var(--border-primary)]/60 bg-[#0d0d15]/50 p-3 space-y-2 flex flex-col justify-between"
                >
                  <div>
                    <span className="text-xs font-bold text-[var(--text-secondary)] block truncate">{c.label}</span>
                    <span className="text-[9px] text-[var(--text-tertiary)] block leading-tight">{c.desc}</span>
                  </div>
                  <div className={cn("inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[10px] font-bold w-fit", statusClasses)}>
                    <StateIcon size={10} className="shrink-0" />
                    <span className="truncate">{c.value}</span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* RIGHT COLUMN: Granular breakdowns, evidence, history area chart */}
      <div className="lg:col-span-2 space-y-6">
        {/* Dynamic Reputation Snapshot Area Chart */}
        {chartData.length > 0 && (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-5 space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-sm font-bold text-[var(--text-primary)] flex items-center gap-2">
                <History size={16} className="text-indigo-400" />
                Reputation Score Snapshot Trend
              </h4>
              <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--bg-elevated)] px-2.5 py-1 rounded border border-[var(--border-primary)] font-semibold">
                {snapshots.length} audits logged
              </span>
            </div>
            <div className="h-[140px] w-full mt-2">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="domainRepGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#818cf8" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#818cf8" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                  <XAxis
                    dataKey="date"
                    stroke="#444"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#444"
                    fontSize={9}
                    tickLine={false}
                    axisLine={false}
                    ticks={[0, 25, 50, 75, 100]}
                  />
                  <Tooltip
                    content={({ active, payload, label }) => {
                      if (!active || !payload || !payload.length) return null;
                      return (
                        <div className="bg-[var(--bg-card)] border border-[var(--border-secondary)] rounded px-2.5 py-1.5 shadow-xl text-[10px]">
                          <p className="text-[var(--text-tertiary)]">{label}</p>
                          <p className="font-bold text-[var(--text-primary)] mt-0.5">
                            Score: <span className="text-[var(--primary-light)]">{payload[0].value}</span>
                          </p>
                        </div>
                      );
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#818cf8"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#domainRepGrad)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Breakdowns & Evidence tabs */}
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] overflow-hidden">
          {/* Section Titles */}
          <div className="flex border-b border-[var(--border-primary)] bg-[#0c0c14] px-4 py-3">
            <h4 className="text-xs uppercase tracking-wider font-extrabold text-[var(--text-secondary)] flex items-center gap-1.5">
              <Layers size={14} className="text-indigo-400" />
              Detailed Verification Logs & Evidence
            </h4>
          </div>

          <div className="p-5 space-y-6">
            {/* Rule breakdowns */}
            <div className="space-y-3">
              <h5 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Scoring Rule Breakdowns ({details?.breakdowns?.length || 0})
              </h5>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {details?.breakdowns && details.breakdowns.length > 0 ? (
                  details.breakdowns.map((b) => (
                    <div
                      key={b.id}
                      className="text-xs flex items-start justify-between gap-4 p-3 bg-[#0d0d15]/60 border border-[var(--border-primary)]/40 rounded-lg hover:border-[var(--border-primary)] transition-all"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-[var(--text-primary)]">{b.rule_name}</span>
                          <span className="px-1.5 py-0.5 bg-[var(--bg-elevated)] border border-[var(--border-primary)] text-[9px] text-[var(--text-tertiary)] rounded uppercase font-semibold">
                            {b.category}
                          </span>
                        </div>
                        <p className="text-[var(--text-secondary)] leading-relaxed">{b.reason}</p>
                        <div className="text-[9px] text-[var(--text-tertiary)] flex items-center gap-3">
                          <span>Source: {b.source}</span>
                          <span>Confidence: {b.confidence}</span>
                          <span>Reliability: {b.source_reliability}</span>
                        </div>
                      </div>
                      <span
                        className={cn(
                          'font-bold tabular-nums shrink-0 text-right min-w-[50px] px-2 py-0.5 rounded text-[10px]',
                          b.score_change >= 0
                            ? 'text-emerald-400 bg-emerald-500/10'
                            : 'text-rose-400 bg-rose-500/10'
                        )}
                      >
                        {b.score_change >= 0 ? '+' : ''}
                        {b.score_change.toFixed(1)}
                      </span>
                    </div>
                  ))
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)] py-2">No score adjustments applied to this domain.</p>
                )}
              </div>
            </div>

            {/* Technical Evidence */}
            <div className="space-y-3 border-t border-[var(--border-primary)]/40 pt-4">
              <h5 className="text-xs font-bold text-[var(--text-secondary)] uppercase tracking-wider">
                Technical Evidence Log ({details?.evidence?.length || 0})
              </h5>
              <div className="space-y-2 max-h-[200px] overflow-y-auto pr-1">
                {details?.evidence && details.evidence.length > 0 ? (
                  details.evidence.map((e) => {
                    const getSeverityColor = (sev: string) => {
                      switch (sev) {
                        case 'CRITICAL':
                          return 'text-rose-400 bg-rose-500/10 border-rose-500/30';
                        case 'HIGH':
                          return 'text-orange-400 bg-orange-500/10 border-orange-500/30';
                        case 'MEDIUM':
                          return 'text-amber-400 bg-amber-500/10 border-amber-500/30';
                        case 'LOW':
                          return 'text-sky-400 bg-sky-500/10 border-sky-500/30';
                        case 'INFO':
                        default:
                          return 'text-slate-400 bg-slate-500/10 border-slate-500/30';
                      }
                    };
                    return (
                      <div
                        key={e.id}
                        className="text-xs p-3 bg-[#0d0d15]/40 border border-[var(--border-primary)]/30 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-3 hover:border-[var(--border-primary)] transition-all"
                      >
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-[var(--text-primary)]">{e.evidence_type}</span>
                            <span className={cn("px-1.5 py-0.5 rounded border text-[9px] font-bold uppercase", getSeverityColor(e.severity))}>
                              {e.severity}
                            </span>
                          </div>
                          <p className="text-[var(--text-secondary)] leading-relaxed">{e.description}</p>
                          <div className="text-[9px] text-[var(--text-tertiary)]">
                            Source: {e.source}
                          </div>
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <p className="text-xs text-[var(--text-tertiary)] py-2">No evidence items recorded for this domain.</p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
