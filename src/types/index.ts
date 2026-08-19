// ==============================================================================
// LEGITIFY DOMAIN & TYPE DEFINITIONS
// Evidence-First Trust Intelligence Matrix
// ==============================================================================

export type ScanEntityType =
  | "company"
  | "recruiter"
  | "domain"
  | "certificate"
  | "offer"
  | "document"
  | "job_offer"
  | "website";

export type ScanStatus =
  | "QUEUED"
  | "EXTRACTING"
  | "VALIDATING"
  | "NORMALIZING"
  | "LOOKING_UP"
  | "VERIFYING"
  | "SCORING"
  | "ML_ANALYSIS"
  | "AI_SYNTHESIS"
  | "GENERATING_REPORT"
  | "COMPLETED"
  | "FAILED";

export type RiskLevel =
  | "CRITICAL"
  | "HIGH"
  | "MODERATE"
  | "LOW"
  | "VERY LOW"
  | "UNKNOWN";

export type Verdict =
  | "LIKELY LEGITIMATE"
  | "LOW RISK"
  | "MODERATE RISK"
  | "HIGH RISK"
  | "LIKELY SCAM"
  | "INSUFFICIENT EVIDENCE";

export type CertificateStatus =
  | "VERIFIED_AUTHENTIC"
  | "LIKELY_AUTHENTIC"
  | "UNVERIFIED"
  | "SUSPICIOUS"
  | "LIKELY_FRAUDULENT";

export type EvidenceTypeCategory =
  | "VERIFIED_FACT"
  | "STRONG_INDICATOR"
  | "WEAK_INDICATOR"
  | "COMMUNITY_SIGNAL"
  | "UNVERIFIED"
  | "CONTRADICTORY_EVIDENCE"
  | "MISSING_EVIDENCE";

export type EvidenceCategory =
  | "COMPANY"
  | "REGISTRY"
  | "DOMAIN"
  | "EMAIL"
  | "RECRUITER"
  | "CERTIFICATE"
  | "OFFER"
  | "DOCUMENT"
  | "THREAT"
  | "PUBLIC_REPORT"
  | "CONSISTENCY"
  | "RULE_ENGINE"
  | "ML_MODEL"
  | "AI_ANALYSIS";

export type EvidenceStatus = "VERIFIED" | "WARNING" | "NEGATIVE" | "UNKNOWN";
export type EvidenceSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW" | "INFO";
export type EvidenceStrength = "VERY_STRONG" | "STRONG" | "MEDIUM" | "WEAK" | "UNVERIFIED";

export interface EvidenceItem {
  id?: string;
  scan_id?: string;
  category: EvidenceCategory;
  evidence_type_category?: EvidenceTypeCategory;
  evidence_type?: string;
  source_name: string;
  source_url?: string;
  title: string;
  snippet?: string;
  evidence_text?: string;
  claim?: string;
  evidence_strength: EvidenceStrength;
  status: EvidenceStatus;
  severity: EvidenceSeverity;
  verified: boolean;
  confidence: number; // 0 - 100
  raw_reference?: string;
  supporting_data?: Record<string, any>;
  collected_at?: string;
}

export interface RuleEvaluation {
  rule_id: string;
  name: string;
  description: string;
  triggered: boolean;
  severity: EvidenceSeverity;
  score_impact: number;
  explanation: string;
  evidence_required: string[];
}

export interface MLPredictionResult {
  model_name: string;
  model_version: string;
  feature_version: string;
  predicted_class: "LEGITIMATE" | "SUSPICIOUS" | "SCAM";
  scam_probability: number; // 0.0 - 1.0
  confidence: number; // 0 - 100
  feature_importances: { feature: string; weight: number; contribution: string }[];
  evaluated_at: string;
}

export interface EvidenceCompleteness {
  overall_percentage: number; // 0 - 100
  breakdown: {
    company: { observed: number; expected: number; percentage: number };
    domain: { observed: number; expected: number; percentage: number };
    recruiter: { observed: number; expected: number; percentage: number };
    certificate: { observed: number; expected: number; percentage: number };
    document: { observed: number; expected: number; percentage: number };
    threat: { observed: number; expected: number; percentage: number };
  };
  missing_evidence: string[];
}

export interface GraphNode {
  id: string;
  label: string;
  type: "company" | "legal_entity" | "domain" | "recruiter" | "offer" | "certificate" | "issuer" | "threat" | "document";
  status: "verified" | "neutral" | "suspicious" | "threat" | "unverified";
  details?: string;
}

export interface GraphEdge {
  from: string;
  to: string;
  label: string;
  type: "OWNS" | "USES" | "SENDS" | "AUTHORED" | "REFERENCES" | "ISSUED_BY" | "FLAGGED_BY" | "SPOOFED_BY";
  status: "verified" | "neutral" | "suspicious" | "threat";
}

export interface EntityGraphData {
  nodes: GraphNode[];
  edges: GraphEdge[];
}

export interface CertificateVerificationData {
  certificate_id?: string;
  recipient_name?: string;
  course_or_program?: string;
  issuer_name?: string;
  issuer_domain?: string;
  issue_date?: string;
  expiry_date?: string;
  verification_url?: string;
  qr_code_detected: boolean;
  qr_code_payload?: string;
  qr_domain_match: boolean;
  status: CertificateStatus;
  verification_level: number; // 1 - 10
  authenticity_confidence: number; // 0 - 100
  issuer_verified: boolean;
  id_verified: boolean;
  summary: string;
  evidence: EvidenceItem[];
}

export interface ScoreComponent {
  name: string;
  weight: number;
  score: number; // 0 - 100
  weighted_score: number; // score * weight
  confidence: number; // 0 - 100
  reason: string;
  evidence_count: number;
}

export interface DeterministicScoreResult {
  trust_score: number; // 0 - 100
  confidence_score: number; // 0 - 100
  risk_level: RiskLevel;
  verdict: Verdict;
  components: {
    company: ScoreComponent;
    domain: ScoreComponent;
    recruiter: ScoreComponent;
    document: ScoreComponent;
    certificate: ScoreComponent;
    threat: ScoreComponent;
    public_evidence: ScoreComponent;
    consistency: ScoreComponent;
  };
  positive_signals: string[];
  warning_signals: string[];
  critical_signals: string[];
  rules_triggered: RuleEvaluation[];
}

export interface ScanRecord {
  id: string;
  user_id: string;
  entity_type: ScanEntityType;
  entity_value: string;
  normalized_entity_name?: string;
  email?: string;
  domain?: string;
  website?: string;
  status: ScanStatus;
  trust_score?: number;
  confidence_score?: number;
  risk_level?: RiskLevel;
  verdict?: Verdict;
  metadata?: Record<string, any>;
  error_message?: string;
  started_at?: string;
  completed_at?: string;
  created_at: string;
  updated_at: string;
}

export interface LegitifyReport {
  scan_id: string;
  entity_name: string;
  entity_type: ScanEntityType;
  trust_score: number;
  confidence: number;
  evidence_completeness: EvidenceCompleteness;
  risk_level: RiskLevel;
  verdict: Verdict;
  executive_summary: string;
  structured_explanation: {
    what_we_found: string[];
    why_it_matters: string[];
    what_supports_it: string[];
    what_contradicts_it: string[];
    what_is_unknown: string[];
    recommendation: string;
  };
  recommendation: string;
  positive_signals: string[];
  warning_signals: string[];
  critical_signals: string[];
  missing_evidence: string[];
  company_verification: {
    legal_name?: string;
    normalized_name?: string;
    status?: string;
    registry_status: string;
    registration_number?: string;
    registered_address?: string;
    country?: string;
    state?: string;
    city?: string;
    website?: string;
    domain?: string;
    last_verified?: string;
    source?: string;
  };
  domain_analysis: {
    domain?: string;
    registrar?: string;
    age_days?: number;
    registration_date?: string;
    expiration_date?: string;
    ssl_valid?: boolean;
    ssl_issuer?: string;
    reputation_score?: number;
    threat_status?: string;
    lookalike_detected?: boolean;
    lookalike_target?: string;
  };
  recruiter_analysis: {
    email?: string;
    display_name?: string;
    domain?: string;
    domain_alignment?: string;
    free_email_provider?: boolean;
    spf_status?: string;
    dkim_status?: string;
    dmarc_status?: string;
    known_threat?: boolean;
  };
  certificate_verification?: CertificateVerificationData;
  document_analysis?: {
    filename?: string;
    mime_type?: string;
    extracted_entities?: Record<string, any>;
    suspicious_patterns_detected?: string[];
    requested_fees?: {
      amount?: string;
      reason?: string;
      channel?: string;
    }[];
  };
  threat_intelligence: {
    matched_iocs_count: number;
    indicators: {
      type: string;
      value: string;
      threat_type: string;
      severity: string;
      source: string;
    }[];
  };
  ml_evaluation?: MLPredictionResult;
  rules_evaluated: RuleEvaluation[];
  public_community_evidence: {
    source: string;
    title: string;
    snippet: string;
    url?: string;
    sentiment: string;
  }[];
  web_intelligence?: {
    searches_conducted: string[];
    official_sources_matched: { title: string; url: string; reliability: number; domain: string }[];
    reputable_reviews_found: { platform: string; sentiment: string; summary: string }[];
    community_complaint_clusters: { pattern: string; count: number; confidence: number; samples: string[] }[];
    total_sources_evaluated: number;
  };
  contradictions_detected?: {
    type: string;
    field: string;
    claimed_value: string;
    verified_value: string;
    severity: "CRITICAL" | "HIGH" | "MEDIUM" | "INFO";
    detail: string;
  }[];
  consistency_analysis: {
    item: string;
    status: "MATCH" | "MISMATCH" | "WARNING" | "UNKNOWN";
    detail: string;
  }[];
  entity_graph: EntityGraphData;
  timeline: {
    time: string;
    event: string;
    detail: string;
    status: "ok" | "warn" | "error";
  }[];
  evidence_sources: {
    provider: string;
    url?: string;
    status: "AVAILABLE" | "UNAVAILABLE" | "CACHED";
    latency?: string;
  }[];
  limitations: string[];
  disclaimer: string;
  company_name?: string;
  confidence_score?: number;
  input_type?: string;
  processing_time_ms?: number;
  dimension_scores?: {
    rules: number;
    nlp: number;
    ner: number;
  };
  triggered_flags?: {
    rule: string;
    severity: "critical" | "high" | "medium" | "low" | "info";
    message: string;
    score: number;
  }[];
  next_steps?: string[];
}

export interface ProviderResult<T = any> {
  provider: string;
  success: boolean;
  available: boolean;
  data?: T;
  evidence: EvidenceItem[];
  source_url?: string;
  retrieved_at: string;
  latency_ms?: number;
  error_code?: string;
  error_message?: string;
}

