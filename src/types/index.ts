/* ═══════════════════════════════════════════
   LEGITIFY TYPE DEFINITIONS
   Single source of truth for all TypeScript types
   ═══════════════════════════════════════════ */

// ── User & Auth ──
export type UserRole = "user" | "admin" | "placement_cell";

export interface User {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  avatar?: string;
  organization?: string;
  createdAt: Date;
}

// ── Scan & Input ──
export type ScanInputType =
  | "pdf"
  | "docx"
  | "txt"
  | "url"
  | "linkedin"
  | "email"
  | "image"
  | "text";

export type ScanStatus =
  | "pending"
  | "processing"
  | "analyzing"
  | "completed"
  | "failed";

export interface ScanInput {
  id: string;
  type: ScanInputType;
  content: string;
  fileName?: string;
  fileSize?: number;
  url?: string;
}
export interface Scan {
  id: string;
  user_id: string;
  userId?: string;
  file_id?: string;
  input?: ScanInput;
  scan_type?: string;
  raw_input_text?: string;
  status: ScanStatus | string;
  trustScore?: number;
  trust_score?: number;
  report?: Report;
  created_at: string;
  createdAt?: Date;
  completedAt?: Date;
  completed_at?: string;
}

// ── Report & Trust Score ──
export type TrustLevel = "safe" | "warning" | "danger";

export interface RiskDimension {
  name: string;
  score: number;
  weight: number;
  evidence: Evidence[];
  label: string;
}

export interface Evidence {
  id: string;
  source: string;
  description: string;
  severity: "low" | "medium" | "high" | "critical";
  url?: string;
  timestamp: Date;
}

export interface TrustScore {
  overall: number;
  confidence: number;
  level: TrustLevel;
  dimensions: {
    document: RiskDimension;
    domain: RiskDimension;
    company: RiskDimension;
    recruiter: RiskDimension;
    community: RiskDimension;
    technical: RiskDimension;
  };
}

export interface InvestigationStep {
  id: string;
  agentName: string;
  action: string;
  result: string;
  status: "completed" | "failed" | "skipped";
  duration: number;
  timestamp: Date;
}
export interface Report {
  id: string;
  scan_id: string;
  trust_score: number;
  risk_score: number;
  confidence_score: number;
  risk_level: string;
  summary: string;
  recommendation?: string;
  report_version: string;
  report_status: string;
  created_at: string;
  updated_at?: string;
}

export interface EvidenceItem {
  id: string;
  report_id: string;
  evidence_type: string;
  title: string;
  description: string;
  severity: "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" | string;
  confidence: number;
  source: string;
  source_reference?: string;
  created_at: string;
}

export interface TrustScoreBreakdown {
  id: string;
  report_id: string;
  rule_name: string;
  rule_category: string;
  weight: number;
  score_change: number;
  confidence: "LOW" | "MEDIUM" | "HIGH" | string;
  reason: string;
  source: string;
  created_at: string;
}

// ── Company ──
export interface Company {
  id: string;
  name: string;
  website?: string;
  registrationStatus: "verified" | "unverified" | "suspicious" | "not_found";
  cin?: string;
  incorporationDate?: string;
  registeredAddress?: string;
  trustScore: number;
  domain?: DomainInfo;
  linkedinUrl?: string;
  glassdoorUrl?: string;
  scansCount: number;
}

export interface DomainInfo {
  domain: string;
  age: number;
  registrar?: string;
  expirationDate?: string;
  sslValid: boolean;
  sslIssuer?: string;
  whoisPrivacy: boolean;
  dnsRecords?: string[];
}

// ── Dashboard ──
export interface DashboardStats {
  totalScans: number;
  scamsDetected: number;
  averageTrustScore: number;
  reportsGenerated: number;
  scansTrend: number;
  scamsTrend: number;
}

export interface ActivityItem {
  id: string;
  type: "scan" | "report" | "alert" | "system";
  title: string;
  description: string;
  timestamp: Date;
  trustLevel?: TrustLevel;
}

// ── Navigation ──
export interface NavItem {
  label: string;
  href: string;
  icon?: string;
  badge?: string;
}

// ── Company Verification (Enterprise Engine) ──
export interface CompanyVerification {
  id: string;
  company_name: string;
  website: string;
  company_email?: string;
  contact_number?: string;
  address?: string;
  verification_score: number;
  verification_status: string; // PENDING, PROCESSING, COMPLETED, FAILED
  verification_level: string; // VERIFIED, LIKELY_VERIFIED, PARTIALLY_VERIFIED, SUSPICIOUS, UNVERIFIED
  verification_confidence: string; // LOW, MEDIUM, HIGH
  verification_version: string;
  verification_source: string;
  last_verified_at?: string;
  next_verification_at?: string;
  verification_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface CompanyVerificationBreakdown {
  id: string;
  verification_id: string;
  rule_name: string;
  category: string;
  score_change: number;
  confidence: string;
  source_reliability: string;
  reason: string;
  source: string;
  created_at: string;
}

export interface CompanyVerificationEvidence {
  id: string;
  verification_id: string;
  evidence_type: string;
  description: string;
  source: string;
  severity: string;
  confidence: string;
  created_at: string;
}

export interface CompanyVerificationDetail {
  verification: CompanyVerification;
  breakdowns: CompanyVerificationBreakdown[];
  evidence: CompanyVerificationEvidence[];
}

// ── Domain Verification (Enterprise Engine) ──
export interface DomainVerification {
  id: string;
  domain: string;
  verification_score: number;
  verification_status: string; // PENDING, PROCESSING, COMPLETED, FAILED
  verification_level: string; // VERIFIED, LIKELY_VERIFIED, PARTIALLY_VERIFIED, SUSPICIOUS, UNVERIFIED, INTERNAL_DOMAIN
  verification_confidence: string; // LOW, MEDIUM, HIGH
  dns_status: string;
  mx_status: string;
  spf_status: string;
  dmarc_status: string;
  dkim_status: string; // PRESENT, ABSENT, UNKNOWN
  ssl_status: string;
  certificate_expiry?: string;
  last_verified_at?: string;
  next_verification_at?: string;
  verification_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface DomainVerificationBreakdown {
  id: string;
  verification_id: string;
  rule_name: string;
  category: string;
  score_change: number;
  confidence: string; // LOW, MEDIUM, HIGH
  source_reliability: string; // LOW, MEDIUM, HIGH
  reason: string;
  source: string;
  timestamp: string;
}

export interface DomainVerificationEvidence {
  id: string;
  verification_id: string;
  evidence_type: string;
  description: string;
  source: string;
  severity: string; // INFO, LOW, MEDIUM, HIGH, CRITICAL
  confidence: string; // LOW, MEDIUM, HIGH
  timestamp: string;
}

export interface DomainReputationSnapshot {
  id: string;
  domain: string;
  verification_score: number;
  verification_level: string;
  captured_at: string;
}

export interface DomainVerificationDetail {
  verification: DomainVerification;
  breakdowns: DomainVerificationBreakdown[];
  evidence: DomainVerificationEvidence[];
}


