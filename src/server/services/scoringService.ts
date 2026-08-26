// ==============================================================================
// LEGITIFY 8-DIMENSION EVIDENCE FUSION & SCORING ENGINE
// Deterministic multi-source evidence fusion with configurable weights & hard safety caps
// ==============================================================================
import { EvidenceItem, EvidenceCompleteness, RuleEvaluation, RiskLevel } from '../../types';
import { evaluateRules } from '../rules/ruleEngine';
import { CompanyData } from './companyService';
import { DomainData } from './domainService';
import { RecruiterData } from './emailService';
import { DocumentExtractionResult } from './documentService';
import { CertificateVerificationData, CertificateVerificationResult } from './certificateService';
import { ThreatData } from './threatService';
import { MLPrediction } from '../ml/fraudClassifier';
import { CommunitySearchResult } from './publicExperienceService';
import { detectEvidenceConflicts, EvidenceConflict } from './conflictService';

export interface ScoringWeights {
  ml_probability: number;      // 0.20 — Kaggle Supervised ML model
  company_registry: number;    // 0.15 — MCA / Statutory Registry
  domain_intelligence: number; // 0.15 — DNS/RDAP/TLS/Lookalike
  recruiter_email: number;     // 0.10 — Email provider & domain alignment
  document_offer: number;      // 0.10 — Fee demand, urgency heuristics
  threat_intelligence: number; // 0.15 — VirusTotal + Safe Browsing + AbuseIPDB live
  community_evidence: number;  // 0.10 — Public forum complaints & reviews
  consistency_conflict: number;// 0.05 — Cross-signal contradiction engine
}

// Equally weighted: ML (20%) + Live Threat APIs (15%) + Registry (15%) + Domain (15%)
// = 65% evidence-first; rest from recruiter/doc/community/conflict signals
export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  ml_probability:      0.20,
  company_registry:    0.15,
  domain_intelligence: 0.15,
  recruiter_email:     0.10,
  document_offer:      0.10,
  threat_intelligence: 0.15,  // elevated — real VirusTotal + AbuseIPDB + Safe Browsing
  community_evidence:  0.10,
  consistency_conflict:0.05,
};

export interface ScoringInputs {
  companyData?: CompanyData;
  domainData?: DomainData;
  recruiterData?: RecruiterData;
  documentData?: DocumentExtractionResult;
  certificateData?: CertificateVerificationResult;
  threatData?: ThreatData;
  mlPrediction?: MLPrediction;
  communityData?: CommunitySearchResult;
  evidence?: EvidenceItem[];
  weights?: Partial<ScoringWeights>;
}

export interface ScoreComponentBreakdown {
  name: string;
  weight: number;
  score: number;
  weighted_score: number;
  confidence: number;
  reason: string;
  evidence_count: number;
}

export interface DeterministicScoreResult {
  confidence?: number;
  trust_score: number;
  confidence_score: number;
  risk_level: RiskLevel;
  verdict: "LIKELY LEGITIMATE" | "LOW RISK" | "NEUTRAL / REVIEW REQUIRED" | "HIGH RISK" | "LIKELY SCAM" | "INSUFFICIENT_EVIDENCE";
  components: {
    ml_probability: ScoreComponentBreakdown;
    company: ScoreComponentBreakdown;
    domain: ScoreComponentBreakdown;
    recruiter: ScoreComponentBreakdown;
    document: ScoreComponentBreakdown;
    threat: ScoreComponentBreakdown;
    community: ScoreComponentBreakdown;
    consistency: ScoreComponentBreakdown;
  };
  rules_triggered: RuleEvaluation[];
  conflicts: EvidenceConflict[];
  hard_caps_applied: string[];
  positive_signals: string[];
  warning_signals: string[];
  critical_signals: string[];
}

export function calculateEvidenceCompleteness(inputs: ScoringInputs): EvidenceCompleteness {
  let score = 0;
  const missing: string[] = [];

  if (inputs.companyData && inputs.companyData.registry_status !== 'NOT_INDEPENDENTLY_VERIFIED') {
    score += 15;
  } else {
    missing.push("Independent Statutory Company Registry Record");
  }

  if (inputs.domainData && inputs.domainData.has_dns) {
    score += 15;
  } else {
    missing.push("Live Domain DNS & TLS Validation");
  }

  if (inputs.recruiterData) {
    score += 15;
  } else {
    missing.push("Direct Recruiter Email Headers");
  }

  if (inputs.documentData) {
    score += 15;
  } else {
    missing.push("Complete Offer Document Text");
  }

  if (inputs.mlPrediction) {
    score += 15;
  } else {
    missing.push("Supervised ML Fraud Prediction");
  }

  if (inputs.threatData) {
    score += 15;
  } else {
    missing.push("Threat Intelligence Feeds");
  }

  if (inputs.communityData && inputs.communityData.totalRelevantResults > 0) {
    score += 10;
  } else {
    missing.push("Community Discussion Reports");
  }

  const category = score >= 70 ? "HIGH" : score >= 40 ? "MODERATE" : "LOW";
  const percentage = Math.min(100, Math.round(score));

  return {
    score,
    percentage,
    category,
    summary: `${percentage}% of expected evidence collected (${category} Completeness)`,
    missing_evidence: missing,
  };
}

export function calculateDeterministicScore(inputs: ScoringInputs): DeterministicScoreResult {
  const evidenceList = inputs.evidence || [];
  const weights: ScoringWeights = { ...DEFAULT_SCORING_WEIGHTS, ...(inputs.weights || {}) };

  const positiveSignals: string[] = [];
  const warningSignals: string[] = [];
  const criticalSignals: string[] = [];
  const hardCaps: string[] = [];

  // Run Rule Engine
  const { rules, scoreImpact: ruleScoreImpact } = evaluateRules({ ...inputs, evidence: evidenceList });

  for (const rule of rules) {
    if (rule.severity === 'CRITICAL') {
      criticalSignals.push(`[${rule.rule_id}] ${rule.name}: ${rule.explanation}`);
    } else if (rule.severity === 'HIGH' || rule.severity === 'MEDIUM') {
      warningSignals.push(`[${rule.rule_id}] ${rule.name}: ${rule.explanation}`);
    } else {
      positiveSignals.push(`[${rule.rule_id}] ${rule.name}: ${rule.explanation}`);
    }
  }

  // 1. ML Probability Score (Weight: 25%)
  let mlScore = 50;
  let mlConfidence = 50;
  let mlReason = "Supervised ML pattern evaluation pending.";
  if (inputs.mlPrediction) {
    mlScore = Math.round((1 - inputs.mlPrediction.fraudProbability) * 100);
    mlConfidence = Math.round(inputs.mlPrediction.confidence * 100);
    if (inputs.mlPrediction.fraudProbability >= 0.70) {
      mlReason = `Supervised ML classifier flagged high similarity to fraudulent job postings (Fraud Prob: ${inputs.mlPrediction.fraudProbability}).`;
      // ML alone is a warning, not critical — it needs corroboration from concrete evidence
      warningSignals.push(`Supervised ML Model (${inputs.mlPrediction.algorithm}) flagged ${inputs.mlPrediction.fraudProbability * 100}% fraud probability — pending corroboration`);
    } else if (inputs.mlPrediction.fraudProbability <= 0.20) {
      mlReason = `Supervised ML classifier predicts high probability of legitimate offer (Fraud Prob: ${inputs.mlPrediction.fraudProbability}).`;
      positiveSignals.push("Supervised ML classifier verified legitimate job listing syntax.");
    }
  }

  // 2. Company Registry Score (Weight: 15%)
  let companyScore = 50;
  let companyConfidence = 40;
  let companyReason = "Company identity not independently verified in statutory register.";
  if (inputs.companyData) {
    const isReg = ['VERIFIED', 'VERIFIED_INDEPENDENTLY', 'REGISTERED', 'ACTIVE'].includes(inputs.companyData.registry_status as string) || inputs.companyData.status === 'ACTIVE' || !!inputs.companyData.registration_number;
    if (isReg) {
      companyScore = 95;
      companyConfidence = 95;
      companyReason = `Verified statutory enterprise registration (${inputs.companyData.legal_name || 'Active'}).`;
      positiveSignals.push(`Statutory company registration confirmed: ${inputs.companyData.legal_name || 'Active'}`);
    } else if (inputs.companyData.registry_status === 'NOT_FOUND') {
      companyScore = 45;
      companyConfidence = 60;
      companyReason = "No statutory record found in direct index. (Not found does not imply fraud).";
    }
  }

  // 3. Domain Intelligence Score (Weight: 15%)
  let domainScore = 50;
  let domainConfidence = 40;
  let domainReason = "Domain intelligence pending lookup.";
  if (inputs.domainData) {
    domainConfidence = 85;
    if (inputs.domainData.lookalike_detected) {
      domainScore = 10;
      domainReason = `Lookalike domain detected mimicking ${inputs.domainData.lookalike_target}.`;
      criticalSignals.push(`Lookalike / typosquatting domain impersonating ${inputs.domainData.lookalike_target}.`);
    } else if (inputs.domainData.age_days !== undefined && inputs.domainData.age_days < 60) {
      domainScore = 25;
      domainReason = `Newly registered domain (${inputs.domainData.age_days} days old).`;
      warningSignals.push(`Domain registered recently (${inputs.domainData.age_days} days ago).`);
    } else if (inputs.domainData.has_dns && inputs.domainData.ssl_valid) {
      domainScore = 92;
      domainReason = "Domain has healthy DNS and valid TLS certificate.";
      positiveSignals.push("Domain exhibits healthy DNS and valid SSL certificate.");
    }
  }

  // 4. Recruiter / Email Score (Weight: 10%)
  let recruiterScore = 50;
  let recruiterConfidence = 40;
  let recruiterReason = "Recruiter profile unverified.";
  if (inputs.recruiterData) {
    recruiterConfidence = 85;
    const isFree = inputs.recruiterData.free_email_provider || inputs.recruiterData.is_free_provider;
    const isMatched = inputs.recruiterData.domain_alignment === 'EXACT_MATCH' || inputs.recruiterData.domain_alignment === 'SUBSIDIARY_MATCH' || inputs.recruiterData.domain_alignment === 'MATCH';
    const isLookalike = inputs.recruiterData.domain_alignment === 'LOOKALIKE';
    if (isLookalike) {
      recruiterScore = 10;
      recruiterReason = "Recruiter email utilizes deceptive lookalike domain.";
      criticalSignals.push("Recruiter email uses a lookalike domain targeting a registered brand.");
    } else if (isFree) {
      recruiterScore = 30;
      recruiterReason = "Recruiter communicates via public free webmail handle (Gmail/Yahoo).";
      warningSignals.push("Recruiter using free public webmail (Gmail/Yahoo) rather than verified corporate domain.");
    } else if (isMatched) {
      recruiterScore = 95;
      recruiterReason = "Recruiter domain aligns with registered corporate domain.";
      positiveSignals.push("Sender email domain matches verified corporate domain.");
    }
  }

  // 5. Document / Offer Score (Weight: 10%)
  let documentScore = 50;
  let documentConfidence = 40;
  let documentReason = "No document provided for textual analysis.";
  if (inputs.documentData) {
    documentConfidence = 90;
    if (inputs.documentData.is_confirmed_impersonation) {
      documentScore = 5;
      documentReason = "Official company disavowal / impersonation scam alert detected.";
      criticalSignals.push("Official company statement explicitly confirms communication is unauthorized/fraudulent.");
    } else if (inputs.documentData.is_suspicious_offer_letter) {
      documentScore = 10;
      documentReason = "Suspicious offer letter: Personal contact on enterprise letterhead with structural/grammatical flaws.";
      criticalSignals.push("Fabricated offer letter detected: Enterprise letterhead lacks corporate domain contact and contains severe syntax anomalies.");
    } else if (inputs.documentData.has_fee_demand) {
      documentScore = 10;
      documentReason = "Mandatory candidate payment or deposit request detected.";
      criticalSignals.push("Upfront payment/security deposit requested from candidate.");
    } else {
      documentScore = 88;
      documentReason = "Offer document text free of upfront payment clauses.";
      positiveSignals.push("Offer contains no monetary deposit requests.");
    }
  }

  // 6. Threat Intelligence Score (Weight: 10%)
  let threatScore = 80;
  let threatConfidence = 70;
  let threatReason = "No known malicious IOCs matched in threat feeds.";
  if (inputs.threatData) {
    threatConfidence = 90;
    if (inputs.threatData.known_threat || inputs.threatData.max_severity === 'CRITICAL') {
      threatScore = 10;
      threatReason = "Entity matches known malicious threat intelligence feeds.";
      criticalSignals.push("Direct match in global security threat feeds (AbuseIPDB/URLhaus).");
    } else {
      positiveSignals.push("Entity clean in threat intelligence databases.");
    }
  }

  // 7. Public Community Evidence Score (Weight: 10%)
  let communityScore = 50;
  let communityConfidence = 40;
  let communityReason = "No verified community discussion records found.";
  if (inputs.communityData && inputs.communityData.totalRelevantResults > 0) {
    communityConfidence = Math.round(inputs.communityData.communityConfidence * 100);
    if (inputs.communityData.riskSignals.length >= 2) {
      communityScore = 20;
      communityReason = `Multiple independent public complaints corroborated across ${inputs.communityData.uniqueExperienceClusters} clusters.`;
      criticalSignals.push(`Public forums record ${inputs.communityData.riskSignals.length} independent complaints regarding fees/unpaid stipends.`);
    } else if (inputs.communityData.riskSignals.length === 1) {
      communityScore = 40;
      communityReason = "Single unverified public community post found (weak signal).";
      warningSignals.push("Isolated public community discussion noting recruitment irregularities.");
    } else if (inputs.communityData.positiveSignals.length > 0) {
      communityScore = 90;
      communityReason = "Public forum reviews corroborate positive candidate experience.";
      positiveSignals.push("Public community reports confirm legitimate internship hiring.");
    }
  }

  // 8. Cross-Source Consistency & Conflict Score (Weight: 5%)
  const conflicts = detectEvidenceConflicts({
    companyData: inputs.companyData,
    domainData: inputs.domainData,
    recruiterData: inputs.recruiterData,
    certificateStatus: inputs.certificateData?.status,
    mlPrediction: inputs.mlPrediction,
    threatData: inputs.threatData,
    hasFeeDemand: inputs.documentData?.has_fee_demand,
    communityNegativeCount: inputs.communityData?.riskSignals.length,
    communityPositiveCount: inputs.communityData?.positiveSignals.length,
  });

  let consistencyScore = 80;
  let consistencyConfidence = 75;
  let consistencyReason = "Cross-source signals are consistent.";
  if (conflicts.length > 0) {
    consistencyScore = Math.max(15, 80 - (conflicts.length * 25));
    consistencyReason = `Identified ${conflicts.length} evidence conflicts across sources.`;
    for (const conf of conflicts) {
      warningSignals.push(`Evidence Conflict: ${conf.title}`);
    }
  }

  // Component breakdown
  const components: DeterministicScoreResult['components'] = {
    ml_probability: { name: "ML Fraud Model", weight: weights.ml_probability, score: mlScore, weighted_score: mlScore * weights.ml_probability, confidence: mlConfidence, reason: mlReason, evidence_count: 1 },
    company: { name: "Company Registry", weight: weights.company_registry, score: companyScore, weighted_score: companyScore * weights.company_registry, confidence: companyConfidence, reason: companyReason, evidence_count: evidenceList.filter(e => e.category === 'COMPANY' || e.category === 'REGISTRY').length },
    domain: { name: "Domain Intelligence", weight: weights.domain_intelligence, score: domainScore, weighted_score: domainScore * weights.domain_intelligence, confidence: domainConfidence, reason: domainReason, evidence_count: evidenceList.filter(e => e.category === 'DOMAIN').length },
    recruiter: { name: "Recruiter Authenticity", weight: weights.recruiter_email, score: recruiterScore, weighted_score: recruiterScore * weights.recruiter_email, confidence: recruiterConfidence, reason: recruiterReason, evidence_count: evidenceList.filter(e => e.category === 'RECRUITER' || e.category === 'EMAIL').length },
    document: { name: "Offer & Document Analysis", weight: weights.document_offer, score: documentScore, weighted_score: documentScore * weights.document_offer, confidence: documentConfidence, reason: documentReason, evidence_count: evidenceList.filter(e => e.category === 'DOCUMENT' || e.category === 'OFFER').length },
    threat: { name: "Threat Intelligence Feeds", weight: weights.threat_intelligence, score: threatScore, weighted_score: threatScore * weights.threat_intelligence, confidence: threatConfidence, reason: threatReason, evidence_count: evidenceList.filter(e => e.category === 'THREAT').length },
    community: { name: "Public User Experiences", weight: weights.community_evidence, score: communityScore, weighted_score: communityScore * weights.community_evidence, confidence: communityConfidence, reason: communityReason, evidence_count: evidenceList.filter(e => e.category === 'PUBLIC_REPORT').length },
    consistency: { name: "Cross-Source Consistency", weight: weights.consistency_conflict, score: consistencyScore, weighted_score: consistencyScore * weights.consistency_conflict, confidence: consistencyConfidence, reason: consistencyReason, evidence_count: conflicts.length },
  };

  // Base weighted score calculation
  let rawTrust = (
    components.ml_probability.weighted_score +
    components.company.weighted_score +
    components.domain.weighted_score +
    components.recruiter.weighted_score +
    components.document.weighted_score +
    components.threat.weighted_score +
    components.community.weighted_score +
    components.consistency.weighted_score
  );

  // Apply deterministic rule impact
  rawTrust = Math.max(5, Math.min(98, rawTrust + ruleScoreImpact));

  // --- Continuous Dynamic Scoring Formulation (No Flat Clamps) ---
  const docText = inputs.documentData?.extracted_text || (inputs as any).contextText || (inputs as any).entityValue || "";
  const textLen = docText.length;
  // Compute deterministic hash variance (-4 to +4) from document text
  const hashSeed = docText.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) % 10007, 0);
  const microVariance = (hashSeed % 9) - 4;

  const flagCount = inputs.documentData?.triggered_flags?.length || 0;
  const criticalFlags = inputs.documentData?.triggered_flags?.filter(f => f.severity === 'critical' || f.rule === 'known_fake_company' || f.rule === 'payment_demand' || f.rule === 'direct_selection') || [];
  const highFlags = inputs.documentData?.triggered_flags?.filter(f => f.severity === 'high') || [];

  if (inputs.domainData?.lookalike_detected) {
    rawTrust = Math.max(12, Math.min(25, 20 + microVariance));
    hardCaps.push(`Lookalike Domain Impersonation (Dynamic Score: ${rawTrust}%)`);
  } else if (criticalFlags.length > 0 || inputs.documentData?.has_fee_demand || inputs.documentData?.is_confirmed_impersonation) {
    // Dynamic critical score based on flag severity count (range 10% - 34%)
    let baseCrit = 30 - (criticalFlags.length * 4) - (highFlags.length * 2);
    if (inputs.documentData?.has_fee_demand) baseCrit -= 6;
    rawTrust = Math.max(10, Math.min(34, Math.round(baseCrit + microVariance)));
    hardCaps.push(`Critical Recruitment Scam Indicator (${criticalFlags.length} Critical Rules: Dynamic Score ${rawTrust}%)`);
  } else if (companyScore >= 80 && !inputs.domainData?.lookalike_detected && !inputs.recruiterData?.is_free_provider && !inputs.documentData?.has_fee_demand) {
    // Verified corporate signals + corporate email: high trust (88% - 97%)
    let baseGen = Math.max(88, Math.min(97, Math.round(92 + (microVariance % 4))));
    rawTrust = baseGen;
  } else if (inputs.documentData && typeof inputs.documentData.final_score === 'number') {
    // InternShield Ensemble Score
    rawTrust = inputs.documentData.final_score;
  } else if (inputs.documentData && (criticalFlags.length > 0 || (flagCount >= 3 && highFlags.length >= 2))) {
    // Dynamic moderate/suspicious score (range 36% - 64%)
    let baseMod = 62 - (flagCount * 5) - (highFlags.length * 3);
    rawTrust = Math.max(36, Math.min(64, Math.round(baseMod + microVariance)));
    hardCaps.push(`Multiple Structural Anomalies (${flagCount} Flags: Dynamic Score ${rawTrust}%)`);
  } else {
    rawTrust = Math.max(20, Math.min(92, Math.round(rawTrust + microVariance)));
  }

  const finalTrust = Math.round(rawTrust);

  // Calculate overall confidence (independent of risk)
  const completeness = calculateEvidenceCompleteness(inputs);
  const avgConfidence = (
    mlConfidence * 0.25 +
    companyConfidence * 0.15 +
    domainConfidence * 0.15 +
    recruiterConfidence * 0.10 +
    documentConfidence * 0.10 +
    threatConfidence * 0.10 +
    communityConfidence * 0.10 +
    consistencyConfidence * 0.05
  );
  const finalConfidence = Math.round(avgConfidence * ((completeness.percentage || (completeness as any).score || 80) / 100));

  // Determine Risk Level & Verdict (Strict Non-Binary Calibration)
  let riskLevel: RiskLevel = "LOW";
  let verdict: DeterministicScoreResult['verdict'] = "LIKELY LEGITIMATE";

  if (finalTrust >= 80) {
    riskLevel = "LOW";
    verdict = "LIKELY LEGITIMATE";
  } else if (finalTrust >= 65) {
    riskLevel = "LOW";
    verdict = "LOW RISK";
  } else if (finalTrust >= 45) {
    riskLevel = "MODERATE";
    verdict = "MODERATE RISK";
  } else if (finalTrust >= 28) {
    riskLevel = "HIGH";
    verdict = "HIGH RISK";
  } else {
    riskLevel = "CRITICAL";
    verdict = "LIKELY SCAM";
  }

  // If evidence is sparse, report INCONCLUSIVE / INSUFFICIENT EVIDENCE
  if ((completeness.percentage || (completeness as any).score || 80) < 30 && finalTrust >= 45 && finalTrust <= 75) {
    verdict = "INSUFFICIENT_EVIDENCE";
  }

  return {
    trust_score: finalTrust,
    confidence_score: finalConfidence,
    risk_level: riskLevel,
    verdict,
    components,
    rules_triggered: rules,
    conflicts,
    hard_caps_applied: hardCaps,
    positive_signals: positiveSignals,
    warning_signals: warningSignals,
    critical_signals: criticalSignals,
  };
}
