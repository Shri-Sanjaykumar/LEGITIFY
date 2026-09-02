// ==============================================================================
// LEGITIFY 10-DIMENSION EVIDENCE FUSION & SCORING ENGINE
// Deterministic multi-source evidence fusion with configurable weights & hard safety caps
// Architecture Version: LEGITIFY-SCORE-v2.0
//
// DETERMINISTIC ≠ STATIC
// Same input + same external evidence state → SAME RESULT
// Different input/evidence → DIFFERENT RESULT
// No Math.random(), no microVariance, no hashSeed jitter, no hardcoded score ranges
// ==============================================================================
import { EvidenceItem, EvidenceCompleteness, RuleEvaluation, RiskLevel } from '../../types';
import { evaluateRules } from '../rules/ruleEngine';
import { CompanyData } from './companyService';
import { DomainData } from './domainService';
import { RecruiterData } from './emailService';
import { DocumentExtractionResult } from './documentService';
import { CertificateVerificationResult } from './certificateService';
import { ThreatData } from './threatService';
import { MLPrediction } from '../ml/fraudClassifier';
import { CommunitySearchResult } from './publicExperienceService';
import { detectEvidenceConflicts, EvidenceConflict } from './conflictService';

export const SCORING_MODEL_VERSION = 'LEGITIFY-SCORE-v2.0';

/**
 * Mandatory 10-Dimension Weights (sum to 1.0 / 100%)
 */
export interface ScoringWeights {
  document_authenticity: number;    // 0.10 — Document structural analysis & layout
  company_registry: number;         // 0.15 — MCA / Statutory Registry
  domain_intelligence: number;      // 0.10 — DNS/RDAP/TLS/Lookalike
  recruiter_email: number;          // 0.10 — Email provider & domain alignment
  financial_fee_safety: number;     // 0.20 — Fee demand, candidate payment (CRITICAL)
  certificate_verification: number; // 0.05 — Certificate / credential checks
  ml_probability: number;           // 0.10 — Kaggle Supervised ML model
  community_evidence: number;       // 0.05 — Public forum complaints & reviews
  threat_intelligence: number;      // 0.05 — VirusTotal + Safe Browsing + AbuseIPDB
  consistency_conflict: number;     // 0.10 — Cross-signal contradiction engine
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  document_authenticity:    0.10,
  company_registry:         0.15,
  domain_intelligence:      0.10,
  recruiter_email:          0.10,
  financial_fee_safety:     0.20,  // HIGHEST: payment demand is the #1 fraud signal
  certificate_verification: 0.05,
  ml_probability:           0.10,
  community_evidence:       0.05,
  threat_intelligence:      0.05,
  consistency_conflict:     0.10,
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
  contextText?: string;
  entityValue?: string;
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
  verdict: "LIKELY LEGITIMATE" | "LOW RISK" | "MODERATE RISK" | "NEUTRAL / REVIEW REQUIRED" | "HIGH RISK" | "LIKELY SCAM" | "INSUFFICIENT_EVIDENCE";
  components: {
    document_authenticity: ScoreComponentBreakdown;
    company: ScoreComponentBreakdown;
    domain: ScoreComponentBreakdown;
    recruiter: ScoreComponentBreakdown;
    document: ScoreComponentBreakdown; // Financial & fee safety
    certificate: ScoreComponentBreakdown;
    ml_probability: ScoreComponentBreakdown;
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
  scoring_model_version?: string;
}

/**
 * Calculates Evidence Completeness based on actual data presence and quality,
 * NOT mere object existence.
 */
export function calculateEvidenceCompleteness(inputs: ScoringInputs): EvidenceCompleteness {
  let score = 0;
  const missing: string[] = [];

  // 1. Company: only count if registry produced an actual verification or structured check
  const companyChecked = Boolean(
    inputs.companyData &&
    inputs.companyData.registry_status !== undefined &&
    (inputs.companyData.registry_status as any) !== 'UNKNOWN' &&
    (inputs.companyData.registry_status as any) !== 'NOT_INDEPENDENTLY_VERIFIED'
  );
  if (companyChecked) {
    score += 15;
  } else {
    missing.push("Independent Statutory Company Registry Record");
  }

  // 2. Domain: only count if live DNS was resolved
  if (inputs.domainData && inputs.domainData.has_dns) {
    score += 15;
  } else if (inputs.domainData) {
    score += 5;
    missing.push("Live Domain DNS & TLS Resolution");
  } else {
    missing.push("Domain Security Intelligence");
  }

  // 3. Recruiter: count if email was actually provided and analyzed
  if (inputs.recruiterData && inputs.recruiterData.email) {
    score += 10;
  } else {
    missing.push("Direct Recruiter Email Headers & Routing");
  }

  // 4. Document: count if meaningful text was extracted
  const docTextLength = (inputs.documentData?.extracted_text || '').trim().length;
  if (docTextLength > 50) {
    score += 15;
  } else if (docTextLength > 0) {
    score += 5;
    missing.push("Complete Offer Document Text (Insufficient length)");
  } else {
    missing.push("Offer Document Text Extraction");
  }

  // 5. ML Model: count if ML fraud classifier ran
  if (inputs.mlPrediction && inputs.mlPrediction.fraudProbability !== undefined) {
    score += 15;
  } else {
    missing.push("Supervised ML Fraud Prediction");
  }

  // 6. Threat Intel: count if threat feeds were queried
  if (inputs.threatData && !(inputs.threatData as any).source_unavailable) {
    score += 15;
  } else {
    missing.push("Live Threat Intelligence Feeds");
  }

  // 7. Community: count if search was executed
  if (inputs.communityData && inputs.communityData.totalRelevantResults > 0) {
    score += 10;
  } else {
    missing.push("Community Discussion Reports");
  }

  // 8. Certificate: count if checked when relevant
  if (inputs.certificateData) {
    score += 5;
  }

  const category = score >= 70 ? "HIGH" : score >= 40 ? "MODERATE" : "LOW";
  const percentage = Math.min(100, Math.round(score));

  return {
    score,
    overall_percentage: percentage,
    percentage,
    category,
    summary: `${percentage}% of expected evidence collected (${category} Completeness)`,
    missing_evidence: missing,
    breakdown: {
      company: { observed: companyChecked ? 1 : 0, expected: 1, percentage: companyChecked ? 100 : 0 },
      domain: { observed: inputs.domainData?.has_dns ? 1 : 0, expected: 1, percentage: inputs.domainData?.has_dns ? 100 : 0 },
      recruiter: { observed: inputs.recruiterData?.email ? 1 : 0, expected: 1, percentage: inputs.recruiterData?.email ? 100 : 0 },
      certificate: { observed: inputs.certificateData ? 1 : 0, expected: 1, percentage: inputs.certificateData ? 100 : 0 },
      document: { observed: docTextLength > 50 ? 1 : 0, expected: 1, percentage: docTextLength > 50 ? 100 : 0 },
      threat: { observed: inputs.threatData ? 1 : 0, expected: 1, percentage: inputs.threatData ? 100 : 0 },
    },
  };
}

/**
 * Deterministically computes the forensic trust score from actual evidence.
 * 
 * CORE PRINCIPLE:
 * Same evidence snapshot → identical mathematical score.
 * Different evidence → proportionally different score.
 */
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

  // ============================================================================
  // 1. Document Authenticity Score (Weight: 10%)
  // ============================================================================
  let docAuthScore = 50;
  let docAuthConfidence = 40;
  let docAuthReason = "No document provided for visual/structural authenticity analysis.";
  if (inputs.documentData) {
    docAuthConfidence = 85;
    const flagCount = inputs.documentData.triggered_flags?.length || 0;
    if (inputs.documentData.is_confirmed_impersonation) {
      docAuthScore = 5;
      docAuthReason = "Document identified as confirmed corporate impersonation attempt.";
      criticalSignals.push("Document identified as confirmed corporate impersonation attempt.");
    } else if (inputs.documentData.is_suspicious_offer_letter) {
      docAuthScore = 15;
      docAuthReason = "Document exhibits structural anomalies consistent with fabricated offer letters.";
      warningSignals.push("Document structure exhibits anomalies typical of fraudulent offers.");
    } else if (flagCount >= 3) {
      docAuthScore = Math.max(20, 60 - flagCount * 10);
      docAuthReason = `Document triggered ${flagCount} structural anomaly flags.`;
      warningSignals.push(`Multiple document anomaly flags triggered (${flagCount}).`);
    } else {
      docAuthScore = 85;
      docAuthReason = "Document structure and layout align with genuine formal correspondence.";
      positiveSignals.push("Document structure consistent with legitimate offer.");
    }
  }

  // ============================================================================
  // 2. Company Legal Verification Score (Weight: 15%)
  // ============================================================================
  let companyScore = 50;
  let companyConfidence = 40;
  let companyReason = "Company identity not independently verified in statutory register.";
  if (inputs.companyData) {
    const isLiveReg = ['VERIFIED', 'VERIFIED_INDEPENDENTLY', 'ACTIVE'].includes(inputs.companyData.registry_status as string) && inputs.companyData.status === 'ACTIVE';
    const isLocalRef = (inputs.companyData.registry_status as string) === 'LOCAL_REFERENCE_FOUND';

    if (isLiveReg) {
      companyScore = 95;
      companyConfidence = 95;
      companyReason = `Verified statutory enterprise registration (${inputs.companyData.legal_name || 'Active'}).`;
      positiveSignals.push(`Statutory company registration confirmed: ${inputs.companyData.legal_name || 'Active'}`);
    } else if (isLocalRef) {
      companyScore = 80;
      companyConfidence = 65;
      companyReason = `Matched local reference dataset (${inputs.companyData.legal_name || 'Active'}). Note: Live MCA21 statutory verification is not configured.`;
      positiveSignals.push(`Company found in local reference records: ${inputs.companyData.legal_name || 'Active'}`);
    } else if (inputs.companyData.registry_status === 'NOT_FOUND') {
      companyScore = 45;
      companyConfidence = 60;
      companyReason = "No statutory record found in direct index. (Absence does not imply fraud).";
    }
  }

  // ============================================================================
  // 3. Domain Security Score (Weight: 10%)
  // ============================================================================
  let domainScore = 50;
  let domainConfidence = 40;
  let domainReason = "Domain security intelligence pending lookup.";
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
      // Established domain with valid TLS is capped at 85 unless mature
      const isMature = (inputs.domainData.age_days || 0) > 365;
      domainScore = isMature ? 90 : 75;
      domainReason = isMature
        ? `Established domain (${inputs.domainData.age_days} days old) with valid DNS and TLS.`
        : "Domain has active DNS and valid TLS certificate (infrastructure confirmed).";
      positiveSignals.push("Domain infrastructure verified (active DNS & valid TLS).");
    }
  }

  // ============================================================================
  // 4. Recruiter Authentication Score (Weight: 10%)
  // ============================================================================
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
      recruiterScore = 90;
      recruiterReason = "Recruiter domain aligns with registered corporate domain (authorized alignment).";
      positiveSignals.push("Sender email domain matches verified corporate domain.");
    }
  }

  // ============================================================================
  // 5. Financial / Fee Safety Score (Weight: 20% — HIGHEST WEIGHT)
  // ============================================================================
  let documentScore = 50;
  let documentConfidence = 40;
  let documentReason = "No document text available for fee & monetary clause analysis.";
  if (inputs.documentData) {
    documentConfidence = 95;
    if (inputs.documentData.has_fee_demand) {
      documentScore = 5;
      documentReason = "Mandatory candidate payment, deposit, or registration fee detected.";
      criticalSignals.push("Mandatory candidate fee/security deposit requested in offer.");
    } else {
      documentScore = 90;
      documentReason = "Offer document text is free of upfront payment clauses.";
      positiveSignals.push("Offer contains no monetary deposit requests (Zero-Fee Standard respected).");
    }
  }

  // ============================================================================
  // 6. Certificate Verification Score (Weight: 5%)
  // ============================================================================
  let certScore = 50;
  let certConfidence = 30;
  let certReason = "No certificate verification performed.";
  if (inputs.certificateData) {
    certConfidence = 80;
    if (inputs.certificateData.status === 'VERIFIED_AUTHENTIC' || (inputs.certificateData.status as any) === 'VERIFIED') {
      certScore = 90;
      certReason = "Certificate independently verified against issuer records.";
      positiveSignals.push("Certificate independently authenticated.");
    } else if (inputs.certificateData.status === 'LIKELY_FRAUDULENT' || (inputs.certificateData.status as any) === 'SUSPICIOUS' || (inputs.certificateData.status as any) === 'INVALID') {
      certScore = 15;
      certReason = "Certificate verification failed or flagged as invalid.";
      warningSignals.push("Certificate verification returned suspicious or invalid status.");
    } else {
      certScore = 50;
      certReason = "Certificate could not be independently authenticated.";
    }
  }

  // ============================================================================
  // 7. ML Fraud Model Score (Weight: 10%)
  // ============================================================================
  let mlScore = 50;
  let mlConfidence = 50;
  let mlReason = "Supervised ML pattern evaluation pending.";
  if (inputs.mlPrediction) {
    mlScore = Math.round((1 - inputs.mlPrediction.fraudProbability) * 100);
    mlConfidence = Math.round(inputs.mlPrediction.confidence * 100);
    if (inputs.mlPrediction.fraudProbability >= 0.70) {
      mlReason = `Supervised ML classifier flagged high similarity to fraudulent job postings (${Math.round(inputs.mlPrediction.fraudProbability * 100)}%).`;
      warningSignals.push(`Supervised ML Model (${inputs.mlPrediction.algorithm}) flagged ${Math.round(inputs.mlPrediction.fraudProbability * 100)}% fraud probability — requires corroboration`);
    } else if (inputs.mlPrediction.fraudProbability <= 0.20) {
      mlReason = `Supervised ML classifier predicts high probability of legitimate offer (${Math.round((1 - inputs.mlPrediction.fraudProbability) * 100)}%).`;
      positiveSignals.push("Supervised ML classifier verified legitimate job listing syntax.");
    }
  }

  // ============================================================================
  // 8. Threat Intelligence Score (Weight: 5%)
  // ============================================================================
  let threatScore = 80;
  let threatConfidence = 70;
  let threatReason = "No known malicious IOCs matched in active threat feeds.";
  if (inputs.threatData) {
    threatConfidence = 90;
    if (inputs.threatData.known_threat || inputs.threatData.max_severity === 'CRITICAL') {
      threatScore = 10;
      threatReason = "Entity matches known malicious threat intelligence feeds (IOC confirmed).";
      criticalSignals.push("Direct match in global security threat feeds (AbuseIPDB/URLhaus).");
    } else {
      positiveSignals.push("Entity clean in threat intelligence databases.");
    }
  }

  // ============================================================================
  // 9. Community Evidence Score (Weight: 5%)
  // ============================================================================
  let communityScore = 50;
  let communityConfidence = 40;
  let communityReason = "No verified community discussion records found.";
  if (inputs.communityData && inputs.communityData.totalRelevantResults > 0) {
    const experiences = (inputs.communityData as any).experiences || [];
    const fraudSignals = experiences.filter((e: any) => e.experienceType?.includes('SCAM') || e.experienceType?.includes('FRAUD') || e.experienceType?.includes('PAYMENT'));
    const posSignals = experiences.filter((e: any) => e.experienceType?.includes('POSITIVE') || e.experienceType?.includes('VERIFIED'));
    communityConfidence = 80;
    if (fraudSignals.length >= 2) {
      communityScore = 20;
      communityReason = `Multiple independent public complaints corroborated (${fraudSignals.length} reports).`;
      criticalSignals.push(`Public forums record ${fraudSignals.length} independent complaints regarding recruitment irregularities.`);
    } else if (fraudSignals.length === 1) {
      communityScore = 40;
      communityReason = "Single unverified public community post found (weak signal).";
      warningSignals.push("Isolated public community discussion noting recruitment irregularities.");
    } else if (posSignals.length > 0) {
      communityScore = 90;
      communityReason = "Public forum reviews corroborate positive candidate experience.";
      positiveSignals.push("Public community reports confirm legitimate internship hiring.");
    }
  }

  // ============================================================================
  // 10. Cross-Source Consistency Score (Weight: 10%)
  // ============================================================================
  const communityExperiences = (inputs.communityData as any)?.experiences || [];
  const conflicts = detectEvidenceConflicts({
    companyData: inputs.companyData,
    domainData: inputs.domainData,
    recruiterData: inputs.recruiterData,
    certificateStatus: inputs.certificateData?.status,
    mlPrediction: inputs.mlPrediction,
    threatData: inputs.threatData,
    hasFeeDemand: inputs.documentData?.has_fee_demand,
    communityNegativeCount: communityExperiences.filter((e: any) => e.experienceType?.includes('SCAM') || e.experienceType?.includes('FRAUD')).length,
    communityPositiveCount: communityExperiences.filter((e: any) => e.experienceType?.includes('POSITIVE')).length,
  });

  let consistencyScore = 85;
  let consistencyConfidence = 75;
  let consistencyReason = "Cross-source signals are internally consistent.";
  if (conflicts.length > 0) {
    consistencyScore = Math.max(15, 85 - (conflicts.length * 20));
    consistencyReason = `Identified ${conflicts.length} evidence conflicts across sources.`;
    for (const conf of conflicts) {
      warningSignals.push(`Evidence Conflict: ${conf.title}`);
    }
  }

  // ============================================================================
  // Compile 10 Components Breakdown
  // ============================================================================
  const components: DeterministicScoreResult['components'] = {
    document_authenticity: {
      name: "Document Authenticity",
      weight: weights.document_authenticity,
      score: docAuthScore,
      weighted_score: Number((docAuthScore * weights.document_authenticity).toFixed(2)),
      confidence: docAuthConfidence,
      reason: docAuthReason,
      evidence_count: evidenceList.filter(e => e.category === 'DOCUMENT' || (e.category as any) === 'VISUAL').length,
    },
    company: {
      name: "Company Legal Verification",
      weight: weights.company_registry,
      score: companyScore,
      weighted_score: Number((companyScore * weights.company_registry).toFixed(2)),
      confidence: companyConfidence,
      reason: companyReason,
      evidence_count: evidenceList.filter(e => e.category === 'COMPANY' || e.category === 'REGISTRY').length,
    },
    domain: {
      name: "Domain Security",
      weight: weights.domain_intelligence,
      score: domainScore,
      weighted_score: Number((domainScore * weights.domain_intelligence).toFixed(2)),
      confidence: domainConfidence,
      reason: domainReason,
      evidence_count: evidenceList.filter(e => e.category === 'DOMAIN').length,
    },
    recruiter: {
      name: "Recruiter Authentication",
      weight: weights.recruiter_email,
      score: recruiterScore,
      weighted_score: Number((recruiterScore * weights.recruiter_email).toFixed(2)),
      confidence: recruiterConfidence,
      reason: recruiterReason,
      evidence_count: evidenceList.filter(e => e.category === 'RECRUITER' || e.category === 'EMAIL').length,
    },
    document: {
      name: "Financial / Fee Safety",
      weight: weights.financial_fee_safety,
      score: documentScore,
      weighted_score: Number((documentScore * weights.financial_fee_safety).toFixed(2)),
      confidence: documentConfidence,
      reason: documentReason,
      evidence_count: evidenceList.filter(e => e.category === 'OFFER' || (e.category as any) === 'PAYMENT' || e.category === 'DOCUMENT').length,
    },
    certificate: {
      name: "Certificate Verification",
      weight: weights.certificate_verification,
      score: certScore,
      weighted_score: Number((certScore * weights.certificate_verification).toFixed(2)),
      confidence: certConfidence,
      reason: certReason,
      evidence_count: evidenceList.filter(e => e.category === 'CERTIFICATE').length,
    },
    ml_probability: {
      name: "ML Fraud Model",
      weight: weights.ml_probability,
      score: mlScore,
      weighted_score: Number((mlScore * weights.ml_probability).toFixed(2)),
      confidence: mlConfidence,
      reason: mlReason,
      evidence_count: 1,
    },
    threat: {
      name: "Threat Intelligence",
      weight: weights.threat_intelligence,
      score: threatScore,
      weighted_score: Number((threatScore * weights.threat_intelligence).toFixed(2)),
      confidence: threatConfidence,
      reason: threatReason,
      evidence_count: evidenceList.filter(e => e.category === 'THREAT').length,
    },
    community: {
      name: "Community Evidence",
      weight: weights.community_evidence,
      score: communityScore,
      weighted_score: Number((communityScore * weights.community_evidence).toFixed(2)),
      confidence: communityConfidence,
      reason: communityReason,
      evidence_count: evidenceList.filter(e => e.category === 'PUBLIC_REPORT' || (e.category as any) === 'COMMUNITY').length,
    },
    consistency: {
      name: "Cross-Source Consistency",
      weight: weights.consistency_conflict,
      score: consistencyScore,
      weighted_score: Number((consistencyScore * weights.consistency_conflict).toFixed(2)),
      confidence: consistencyConfidence,
      reason: consistencyReason,
      evidence_count: conflicts.length,
    },
  };

  // Base weighted score calculation (10 dimensions)
  let rawTrust = (
    components.document_authenticity.weighted_score +
    components.company.weighted_score +
    components.domain.weighted_score +
    components.recruiter.weighted_score +
    components.document.weighted_score +
    components.certificate.weighted_score +
    components.ml_probability.weighted_score +
    components.threat.weighted_score +
    components.community.weighted_score +
    components.consistency.weighted_score
  );

  // Apply deterministic rule impact (bounded)
  rawTrust = Math.max(5, Math.min(98, rawTrust + ruleScoreImpact));

  // ============================================================================
  // AUDITABLE HARD SAFETY RULES (CAPS — PRESERVE DIRECTION, NO RANDOM NUMBERS)
  // ============================================================================

  // Rule 1: Lookalike domain impersonation cap
  if (inputs.domainData?.lookalike_detected) {
    const prevTrust = rawTrust;
    rawTrust = Math.min(rawTrust, 25);
    hardCaps.push(`LOOKALIKE_DOMAIN_CAP: Trust capped to max 25 (calculated: ${Math.round(prevTrust)}) — suspected domain impersonation`);
  }

  // Rule 2: Confirmed fee demand or confirmed impersonation cap
  if (inputs.documentData?.has_fee_demand || inputs.documentData?.is_confirmed_impersonation) {
    const prevTrust = rawTrust;
    rawTrust = Math.min(rawTrust, 20);
    hardCaps.push(`PAYMENT_REQUEST_CAP: Trust capped to max 20 (calculated: ${Math.round(prevTrust)}) — confirmed candidate payment demand`);
  }

  // Rule 3: Known malicious IOC threat feed cap
  if (inputs.threatData?.known_threat || inputs.threatData?.max_severity === 'CRITICAL') {
    const prevTrust = rawTrust;
    rawTrust = Math.min(rawTrust, 15);
    hardCaps.push(`MALICIOUS_IOC_CAP: Trust capped to max 15 (calculated: ${Math.round(prevTrust)}) — confirmed threat intelligence match`);
  }

  const finalTrust = Math.round(Math.max(1, Math.min(99, rawTrust)));

  // ============================================================================
  // Evidence Confidence Calculation (Dynamic, Separate from Trust Score)
  // ============================================================================
  const completeness = calculateEvidenceCompleteness(inputs);
  const avgConfidence = (
    docAuthConfidence * weights.document_authenticity +
    companyConfidence * weights.company_registry +
    domainConfidence * weights.domain_intelligence +
    recruiterConfidence * weights.recruiter_email +
    documentConfidence * weights.financial_fee_safety +
    certConfidence * weights.certificate_verification +
    mlConfidence * weights.ml_probability +
    threatConfidence * weights.threat_intelligence +
    communityConfidence * weights.community_evidence +
    consistencyConfidence * weights.consistency_conflict
  );

  const finalConfidence = Math.round(
    Math.max(10, Math.min(98, avgConfidence * (completeness.percentage / 100)))
  );

  // ============================================================================
  // Risk Level & Verdict Calibration (Deterministic)
  // ============================================================================
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

  // Sparse evidence guard
  if (completeness.percentage < 25 && finalTrust >= 40 && finalTrust <= 70) {
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
    scoring_model_version: SCORING_MODEL_VERSION,
  };
}
