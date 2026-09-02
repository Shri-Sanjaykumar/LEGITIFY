import React from 'react';
import { AlertCircle, CheckCircle2, ShieldAlert, HelpCircle, ArrowRight, Zap } from 'lucide-react';
import { FraudPatternMatch, LegitimatePatternMatch, CounterEvidenceMatch } from '../../types/forensicTypes';

interface ForensicExplanationPanelProps {
  explanationSummary?: {
    whatWeFound: string[];
    whyItMatters: string[];
    whatIsVerified: string[];
    whatIsSuspicious: string[];
    whatShouldBeDone: string[];
  };
  fraudPatterns?: FraudPatternMatch[];
  legitimatePatterns?: LegitimatePatternMatch[];
  counterEvidence?: CounterEvidenceMatch[];
  fraudConfidence?: number;
}

export const ForensicExplanationPanel: React.FC<ForensicExplanationPanelProps> = ({
  explanationSummary,
  fraudPatterns = [],
  legitimatePatterns = [],
  counterEvidence = [],
  fraudConfidence = 10,
}) => {
  if (!explanationSummary && fraudPatterns.length === 0 && legitimatePatterns.length === 0) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-black text-slate-100 text-glow-emerald flex items-center gap-2">
          <span>🧠</span> Multi-Signal Forensic Reasoning & Pattern Synthesis
        </h3>
        <span className="text-xs font-mono px-3 py-1 rounded-full bg-[#131822] text-[#00FF87] border border-[#00FF87]/30 font-bold">
          Fraud Confidence: {fraudConfidence}%
        </span>
      </div>

      {/* Structured 5-Block Forensic Reasoning */}
      {explanationSummary && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* What We Found */}
          {explanationSummary.whatWeFound && explanationSummary.whatWeFound.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
              <h4 className="text-xs font-mono font-black text-[#00F0FF] uppercase tracking-wider flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" /> What We Found
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {explanationSummary.whatWeFound.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#00F0FF] mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Why It Matters */}
          {explanationSummary.whyItMatters && explanationSummary.whyItMatters.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
              <h4 className="text-xs font-mono font-black text-amber-400 uppercase tracking-wider flex items-center gap-1.5">
                <HelpCircle className="w-3.5 h-3.5" /> Why It Matters
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {explanationSummary.whyItMatters.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-amber-400 mt-0.5">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What Is Verified */}
          {explanationSummary.whatIsVerified && explanationSummary.whatIsVerified.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0D1117] border-2 border-[#1E2838] space-y-2">
              <h4 className="text-xs font-mono font-black text-[#00FF87] uppercase tracking-wider flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5" /> Verified Authenticity Signals
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-300">
                {explanationSummary.whatIsVerified.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#00FF87] mt-0.5">✓</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* What Should Be Done */}
          {explanationSummary.whatShouldBeDone && explanationSummary.whatShouldBeDone.length > 0 && (
            <div className="p-5 rounded-2xl bg-[#0D1117] border-2 border-red-500/30 space-y-2">
              <h4 className="text-xs font-mono font-black text-red-400 uppercase tracking-wider flex items-center gap-1.5">
                <ShieldAlert className="w-3.5 h-3.5" /> Actionable Safety Guidance
              </h4>
              <ul className="space-y-1.5 text-xs text-slate-200 font-semibold">
                {explanationSummary.whatShouldBeDone.map((item, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <ArrowRight className="w-3.5 h-3.5 text-red-400 shrink-0 mt-0.5" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Pattern Library Evaluator Matches */}
      {(fraudPatterns.length > 0 || legitimatePatterns.length > 0) && (
        <div className="space-y-3">
          <h4 className="text-xs font-mono uppercase font-black text-slate-400 tracking-wider">
            Pattern Engine Matches
          </h4>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {fraudPatterns.map((fp, i) => (
              <div key={i} className="p-4 rounded-xl bg-red-500/10 border border-red-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-red-500/20 text-red-400 font-mono text-[10px] font-black">
                    {fp.patternId}
                  </span>
                  <span className="text-[10px] font-mono text-red-300 font-bold">
                    Confidence: {Math.round(fp.confidence * 100)}%
                  </span>
                </div>
                <h5 className="text-sm font-bold text-slate-100">{fp.name}</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{fp.description}</p>
              </div>
            ))}

            {legitimatePatterns.map((lp, i) => (
              <div key={i} className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="px-2 py-0.5 rounded bg-emerald-500/20 text-[#00FF87] font-mono text-[10px] font-black">
                    {lp.patternId}
                  </span>
                  <span className="text-[10px] font-mono text-emerald-300 font-bold">
                    Confidence: {Math.round(lp.confidence * 100)}%
                  </span>
                </div>
                <h5 className="text-sm font-bold text-slate-100">{lp.name}</h5>
                <p className="text-xs text-slate-300 leading-relaxed">{lp.description}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
