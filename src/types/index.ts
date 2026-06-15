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
  userId: string;
  input: ScanInput;
  status: ScanStatus;
  trustScore?: number;
  report?: Report;
  createdAt: Date;
  completedAt?: Date;
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
  scanId: string;
  trustScore: TrustScore;
  aiSummary: string;
  investigationSteps: InvestigationStep[];
  recommendations: string[];
  createdAt: Date;
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
