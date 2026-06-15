'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import { ArrowLeft, Calendar, CheckCircle, ShieldAlert } from 'lucide-react';
import DashboardLayout from '@/components/layout/DashboardLayout';
import TrustGauge from '@/components/report/TrustGauge';
import RiskRadar from '@/components/report/RiskRadar';
import AIAnalysis from '@/components/report/AIAnalysis';
import EvidenceCard from '@/components/report/EvidenceCard';
import Timeline from '@/components/report/Timeline';
import ReportActions from '@/components/report/ReportActions';
import { mockReport } from '@/lib/mock-data';

export default function ReportPage() {
  const params = useParams();
  const reportId = params.id as string;
  const report = mockReport;

  return (
    <DashboardLayout activePath="/reports">
      <div className="space-y-6 max-w-6xl mx-auto pb-12">
        {/* Top Navigation / Breadcrumbs */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <Link
            href="/dashboard"
            className="flex items-center gap-2 text-xs font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back to Dashboard
          </Link>
          <div className="flex items-center gap-3 text-xs text-[var(--text-tertiary)] font-mono">
            <span className="flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5" /> Checked: {report.createdAt.toLocaleDateString()}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 bg-[#1a1a24] border border-[var(--border-primary)] px-2 py-0.5 rounded text-[var(--text-primary)]">
              ID: {reportId === 'demo' ? report.id : reportId}
            </span>
          </div>
        </div>

        {/* Page Title */}
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center text-red-500">
            <ShieldAlert size={20} />
          </div>
          <div>
            <h2 className="text-2xl font-bold text-[var(--text-primary)]">
              AI Verification Report
            </h2>
            <p className="text-sm text-[var(--text-secondary)]">
              Deep analysis of offer letter legitimacy, registrar data, and community sentiment.
            </p>
          </div>
        </div>

        {/* Row 1: Trust Gauge (1/3) & Risk Radar (2/3) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="md:col-span-1 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 flex items-center justify-center min-h-[360px]">
            <TrustGauge
              score={report.trustScore.overall}
              confidence={report.trustScore.confidence}
              size={200}
            />
          </div>
          <div className="md:col-span-2 bg-[var(--bg-card)] border border-[var(--border-primary)] rounded-xl p-6 flex flex-col justify-center min-h-[360px]">
            <h3 className="text-sm font-semibold text-[var(--text-tertiary)] uppercase tracking-wider mb-2">
              Risk Dimensions Breakdown
            </h3>
            <RiskRadar dimensions={report.trustScore.dimensions} />
          </div>
        </div>

        {/* Row 2: AI Investigation Summary */}
        <div className="w-full">
          <AIAnalysis summary={report.aiSummary} />
        </div>

        {/* Row 3: Evidence Cards Grid */}
        <div>
          <h3 className="text-base font-bold text-[var(--text-primary)] mb-4">
            Evidence Files & Findings
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {Object.values(report.trustScore.dimensions).map((dim, idx) => (
              <EvidenceCard key={idx} dimension={dim} />
            ))}
          </div>
        </div>

        {/* Row 4: Timeline */}
        <div className="w-full">
          <Timeline steps={report.investigationSteps} />
        </div>

        {/* Row 5: Action Recommendations */}
        <div className="rounded-xl bg-[var(--bg-card)] border border-[var(--border-primary)] p-6 space-y-4">
          <div className="flex items-center gap-2 pb-3 border-b border-[var(--border-primary)]">
            <CheckCircle className="w-5 h-5 text-emerald-500" />
            <h3 className="text-lg font-semibold text-[var(--text-primary)]">
              Recommended Next Steps
            </h3>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {report.recommendations.map((rec, i) => (
              <li key={i} className="flex gap-2.5 items-start text-sm text-[var(--text-secondary)]">
                <span className="shrink-0 mt-1 w-1.5 h-1.5 rounded-full bg-emerald-500" />
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Bottom Actions */}
        <ReportActions />
      </div>
    </DashboardLayout>
  );
}
