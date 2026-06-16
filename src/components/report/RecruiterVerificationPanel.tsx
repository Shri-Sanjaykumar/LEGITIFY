'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  User,
  ShieldCheck,
  ShieldAlert,
  RefreshCw,
  AlertTriangle,
  History,
  Building,
  Terminal,
} from 'lucide-react';
import { Linkedin } from '@/components/shared/BrandIcons';
import {
  useRecruiterVerification,
  useSearchRecruiterVerification,
  useCreateRecruiterVerification,
  useRecruiterReputation,
} from '@/hooks/useRecruiter';
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

interface RecruiterVerificationPanelProps {
  recruiterEmail: string;
  claimedCompany: string;
  recruiterName: string;
  recruiterPhone?: string;
  recruiterRole?: string;
  linkedinProfileUrl?: string;
}

export default function RecruiterVerificationPanel({
  recruiterEmail,
  claimedCompany,
  recruiterName,
  recruiterPhone,
  recruiterRole,
  linkedinProfileUrl,
}: RecruiterVerificationPanelProps) {
  const [isVerifying, setIsVerifying] = useState(false);
  const searchResult = useSearchRecruiterVerification(recruiterEmail, claimedCompany);
  const matchedVerification = searchResult.data;

  const detailsResult = useRecruiterVerification(
    matchedVerification ? matchedVerification.id : null
  );
  const details = detailsResult.data;

  const reputationResult = useRecruiterReputation(
    matchedVerification ? matchedVerification.recruiter_email : null
  );
  const snapshots = reputationResult.data || [];

  const createMutation = useCreateRecruiterVerification();

  const handleVerify = async () => {
    if (!recruiterEmail || !claimedCompany) return;
    setIsVerifying(true);
    try {
      await createMutation.mutateAsync({
        recruiter_name: recruiterName,
        recruiter_email: recruiterEmail,
        claimed_company: claimedCompany,
        recruiter_phone: recruiterPhone,
        recruiter_role: recruiterRole,
        linkedin_profile_url: linkedinProfileUrl,
        verification_source: 'WEB_UI',
      });
      searchResult.refetch();
    } catch (e) {
      console.error('Failed to start recruiter verification:', e);
    } finally {
      setIsVerifying(false);
    }
  };

  if (!recruiterEmail || !claimedCompany) {
    return (
      <div className="py-8 text-center text-sm text-[var(--text-tertiary)] border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)]">
        No recruiter details available to verify.
      </div>
    );
  }

  const isLoading = searchResult.isLoading || (matchedVerification && detailsResult.isLoading);

  if (isLoading || isVerifying) {
    return (
      <div className="p-8 border border-[var(--border-primary)] rounded-xl bg-[var(--bg-card)] flex flex-col items-center justify-center min-h-[250px]">
        <LoadingSpinner size="md" text="Auditing recruiter corporate authority, email domain consistency, and reputation snapshots..." />
      </div>
    );
  }

  // State 1: No verification record yet
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
            <User size={24} />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">Recruiter Identity Audit</h3>
            <p className="text-sm text-[var(--text-secondary)]">
              Validate recruiter domain legitimacy, mismatch between email hosts and corporate websites, and reputation histories before engaging.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-[#111118]/80 border border-[var(--border-primary)]/60 rounded-lg p-4">
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Recruiter Email</span>
            <div className="text-sm font-mono text-[var(--text-primary)] font-bold">{recruiterEmail}</div>
          </div>
          <div className="space-y-1">
            <span className="text-xs text-[var(--text-tertiary)] uppercase tracking-wider font-semibold">Claimed Company</span>
            <div className="text-sm text-[var(--text-primary)] font-bold">{claimedCompany}</div>
          </div>
        </div>

        <div className="flex justify-end">
          <button
            onClick={handleVerify}
            className="px-4 py-2 bg-[var(--primary)] text-white hover:bg-[var(--primary-dark)] text-xs font-semibold rounded-lg shadow-lg flex items-center gap-1.5 transition-all"
          >
            <RefreshCw size={14} />
            Audit Recruiter Identity
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
        <LoadingSpinner size="md" text={`Recruiter verification in progress (${verification.verification_status.toLowerCase()})...`} />
        <p className="text-xs text-[var(--text-tertiary)]">Analyzing domain alignments and tracking snapshots...</p>
      </div>
    );
  }

  const score = verification.verification_score;
  const level = verification.verification_level;
  const confidence = verification.verification_confidence;

  const levelConfig: Record<
    string,
    { label: string; text: string; bg: string; border: string; icon: React.ComponentType<{ size?: number }> }
  > = {
    VERIFIED: {
      label: 'Verified Recruiter',
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
      label: 'Suspicious Recruiter',
      text: 'text-rose-400',
      bg: 'bg-rose-500/10',
      border: 'border-rose-500/20',
      icon: ShieldAlert,
    },
    UNVERIFIED: {
      label: 'Unverified Recruiter',
      text: 'text-slate-400',
      bg: 'bg-slate-500/10',
      border: 'border-slate-500/20',
      icon: AlertTriangle,
    },
    INTERNAL_RECRUITER: {
      label: 'Internal System Recruiter',
      text: 'text-sky-400',
      bg: 'bg-sky-500/10',
      border: 'border-sky-500/20',
      icon: Building,
    },
  };

  const levelInfo = levelConfig[level] || levelConfig.UNVERIFIED;
  const LevelIcon = levelInfo.icon;

  const checkStatusMap: Record<string, { label: string; style: string }> = {
    MATCHED: { label: 'Matched Official Domain', style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    MISMATCHED: { label: 'Mismatch vs Company website', style: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    FREE_EMAIL: { label: 'Free Email Domain Used', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    INTERNAL: { label: 'Internal Suffix Detected', style: 'text-sky-400 bg-sky-500/10 border-sky-500/20' },
    FOUND_VERIFIED: { label: 'Verified Corporate Entity', style: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20' },
    FOUND_UNVERIFIED: { label: 'Unverified Corporate Registry', style: 'text-amber-400 bg-amber-500/10 border-amber-500/20' },
    NOT_FOUND: { label: 'Entity Not Found in Registry', style: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    UNMATCHED: { label: 'Mismatch Format', style: 'text-rose-400 bg-rose-500/10 border-rose-500/20' },
    NOT_PROVIDED: { label: 'Not Provided', style: 'text-slate-400 bg-slate-500/10 border-slate-500/20' },
  };

  // Recharts Chart Config
  const chartData = snapshots
    .slice()
    .reverse()
    .map((s, idx) => ({
      name: `Audit #${idx + 1}`,
      score: s.verification_score,
      count: s.recruiter_verification_count,
      rate: s.recruiter_success_rate * 100,
    }));

  const latestReputation = snapshots[0] || { recruiter_verification_count: 1, recruiter_success_rate: 1.0 };

  return (
    <motion.div
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="grid grid-cols-1 lg:grid-cols-3 gap-6"
    >
      {/* Column 1: Dial & Profile Card */}
      <div className="lg:col-span-1 space-y-6">
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 text-center space-y-6 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-2xl pointer-events-none" />

          {/* Heading */}
          <div className="text-left">
            <h3 className="text-sm font-semibold text-[var(--text-secondary)] uppercase tracking-wider">Recruiter Trust Engine</h3>
            <span className="text-xs text-[var(--text-tertiary)]">Deterministic Identity Scoring</span>
          </div>

          {/* Score Dial */}
          <div className="relative w-36 h-36 mx-auto flex items-center justify-center">
            {/* SVG circle track */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="72"
                cy="72"
                r="64"
                className="stroke-[var(--border-primary)] fill-none"
                strokeWidth="8"
              />
              <motion.circle
                cx="72"
                cy="72"
                r="64"
                className={cn(
                  "fill-none",
                  score >= 80 ? "stroke-emerald-500" : score >= 50 ? "stroke-amber-500" : "stroke-rose-500"
                )}
                strokeWidth="8"
                strokeDasharray={2 * Math.PI * 64}
                initial={{ strokeDashoffset: 2 * Math.PI * 64 }}
                animate={{ strokeDashoffset: 2 * Math.PI * 64 * (1 - score / 100) }}
                transition={{ duration: 1.2, ease: 'easeOut' }}
              />
            </svg>
            <div className="absolute flex flex-col items-center justify-center">
              <span className="text-3xl font-extrabold text-[var(--text-primary)] font-mono">
                <AnimatedCounter value={score} />
              </span>
              <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider font-bold">Trust Rating</span>
            </div>
          </div>

          {/* Verification Level & Confidence */}
          <div className="space-y-2">
            <div className={cn("inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-full border", levelInfo.bg, levelInfo.text, levelInfo.border)}>
              <LevelIcon size={14} />
              {levelInfo.label}
            </div>

            <div className="flex items-center justify-between text-xs border-t border-[var(--border-primary)]/40 pt-3 text-[var(--text-secondary)]">
              <span>Signal Confidence:</span>
              <span className={cn(
                "font-bold",
                confidence === 'HIGH' ? 'text-emerald-400' : confidence === 'MEDIUM' ? 'text-teal-400' : 'text-amber-400'
              )}>{confidence}</span>
            </div>
          </div>
        </div>

        {/* Recruiter Details Card */}
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-4">
          <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
            <User size={16} className="text-indigo-400" />
            Recruiter Profile Card
          </h4>

          <div className="space-y-3 text-xs">
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Name:</span>
              <span className="font-semibold text-[var(--text-primary)]">{verification.recruiter_name}</span>
            </div>
            {verification.recruiter_role && (
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Job Title:</span>
                <span className="font-semibold text-[var(--text-primary)]">{verification.recruiter_role}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Claimed Company:</span>
              <span className="font-semibold text-[var(--text-primary)]">{verification.claimed_company}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[var(--text-tertiary)]">Email Host:</span>
              <span className="font-mono font-semibold text-[var(--text-primary)]">{recruiterEmail}</span>
            </div>
            {verification.recruiter_phone && (
              <div className="flex justify-between">
                <span className="text-[var(--text-tertiary)]">Phone Channel:</span>
                <span className="font-semibold text-[var(--text-primary)]">{verification.recruiter_phone}</span>
              </div>
            )}

            {/* LinkedIn validation status */}
            <div className="flex items-center justify-between border-t border-[var(--border-primary)]/45 pt-3">
              <span className="text-[var(--text-tertiary)] flex items-center gap-1">
                <Linkedin size={14} className="text-sky-400" />
                LinkedIn profile:
              </span>
              <span className={cn(
                "px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider",
                verification.linkedin_validation_status === 'VALID' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' :
                verification.linkedin_validation_status === 'INVALID' ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' :
                'bg-slate-500/10 text-slate-400 border border-slate-500/20'
              )}>
                {verification.linkedin_validation_status}
              </span>
            </div>
            {verification.linkedin_profile_url && (
              <div className="text-[10px] truncate text-sky-400 font-mono text-right">
                <a href={verification.linkedin_profile_url} target="_blank" rel="noopener noreferrer" className="hover:underline">
                  {verification.linkedin_profile_url}
                </a>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Column 2: Status & Snapshots Reputation */}
      <div className="lg:col-span-2 space-y-6">
        {/* Core consistency audit grids */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Check 1 */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 space-y-2">
            <span className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wider block">Email Domain</span>
            <div className={cn(
              "text-xs px-2.5 py-1 rounded border inline-block font-semibold",
              checkStatusMap[verification.email_domain_status]?.style || checkStatusMap.UNMATCHED.style
            )}>
              {checkStatusMap[verification.email_domain_status]?.label || verification.email_domain_status}
            </div>
          </div>
          {/* Check 2 */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 space-y-2">
            <span className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wider block">Company Registry</span>
            <div className={cn(
              "text-xs px-2.5 py-1 rounded border inline-block font-semibold",
              checkStatusMap[verification.company_match_status]?.style || checkStatusMap.NOT_FOUND.style
            )}>
              {checkStatusMap[verification.company_match_status]?.label || verification.company_match_status}
            </div>
          </div>
          {/* Check 3 */}
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-4 space-y-2">
            <span className="text-xs text-[var(--text-tertiary)] font-semibold uppercase tracking-wider block">Phone Channel</span>
            <div className={cn(
              "text-xs px-2.5 py-1 rounded border inline-block font-semibold",
              checkStatusMap[verification.phone_match_status]?.style || checkStatusMap.NOT_PROVIDED.style
            )}>
              {checkStatusMap[verification.phone_match_status]?.label || verification.phone_match_status}
            </div>
          </div>
        </div>

        {/* Reputation Tracking details */}
        <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
                <History size={16} className="text-indigo-400" />
                Recruiter Reputation Snapshots
              </h4>
              <p className="text-xs text-[var(--text-tertiary)]">Enterprise audits & historical verification count</p>
            </div>

            <div className="flex items-center gap-6 bg-[#111118]/80 border border-[var(--border-primary)]/45 rounded-lg p-3">
              <div className="space-y-0.5 text-center">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block font-bold">Times Seen</span>
                <span className="text-sm font-mono text-[var(--text-primary)] font-bold">
                  {latestReputation.recruiter_verification_count}
                </span>
              </div>
              <div className="w-px h-6 bg-[var(--border-primary)]/45" />
              <div className="space-y-0.5 text-center">
                <span className="text-[10px] text-[var(--text-tertiary)] uppercase tracking-wider block font-bold">Success Rate</span>
                <span className={cn(
                  "text-sm font-mono font-bold",
                  latestReputation.recruiter_success_rate >= 0.8 ? "text-emerald-400" : latestReputation.recruiter_success_rate >= 0.5 ? "text-amber-400" : "text-rose-400"
                )}>
                  {(latestReputation.recruiter_success_rate * 100).toFixed(1)}%
                </span>
              </div>
            </div>
          </div>

          {/* Recharts chart */}
          {chartData.length > 1 ? (
            <div className="h-44 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                  <defs>
                    <linearGradient id="scoreColor" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#6366f1" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a2a35/30" vertical={false} />
                  <XAxis dataKey="name" stroke="#6b7280" fontSize={10} tickLine={false} />
                  <YAxis domain={[0, 100]} stroke="#6b7280" fontSize={10} tickLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0c0c14',
                      borderColor: '#2a2a35',
                      borderRadius: '8px',
                      color: '#f3f4f6',
                      fontSize: '11px',
                    }}
                  />
                  <Area
                    type="monotone"
                    dataKey="score"
                    stroke="#6366f1"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#scoreColor)"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-[var(--text-tertiary)] border border-dashed border-[var(--border-primary)]/40 rounded-lg">
              Insufficient historical snapshots. Baseline snapshot logged today.
            </div>
          )}
        </div>

        {/* Detailed Breakdowns List */}
        {details && details.breakdowns.length > 0 && (
          <div className="rounded-xl border border-[var(--border-primary)] bg-[var(--bg-card)] p-6 space-y-4">
            <h4 className="text-sm font-semibold text-[var(--text-primary)] flex items-center gap-1.5">
              <Terminal size={16} className="text-indigo-400" />
              Granular Scoring Breakdowns
            </h4>

            <div className="space-y-3">
              {details.breakdowns.map((bd) => (
                <div
                  key={bd.id}
                  className="bg-[#111118]/80 border border-[var(--border-primary)]/50 rounded-lg p-3 flex items-start justify-between gap-4 text-xs"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-indigo-300 font-bold">{bd.rule_name}</span>
                      <span className="text-[10px] text-[var(--text-tertiary)] bg-[var(--border-primary)]/40 px-1.5 py-0.5 rounded">
                        {bd.category}
                      </span>
                    </div>
                    <p className="text-[var(--text-secondary)]">{bd.reason}</p>
                  </div>

                  <div className="shrink-0 text-right space-y-1">
                    <span className={cn(
                      "font-mono font-bold text-sm",
                      bd.score_change >= 0 ? "text-emerald-400" : "text-rose-400"
                    )}>
                      {bd.score_change >= 0 ? `+${bd.score_change}` : bd.score_change}
                    </span>
                    <div className="text-[9px] text-[var(--text-tertiary)] uppercase tracking-wider">
                      Conf: {bd.confidence}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
