import type {
  Scan,
  Report,
  TrustScore,
  DashboardStats,
  ActivityItem,
  Company,
  InvestigationStep,
} from "@/types";

// ── Dashboard Stats ──
export const mockDashboardStats: DashboardStats = {
  totalScans: 1247,
  scamsDetected: 89,
  averageTrustScore: 72.4,
  reportsGenerated: 1198,
  scansTrend: 12.5,
  scamsTrend: -8.3,
};

// ── Recent Scans ──
export const mockRecentScans: Scan[] = [
  {
    id: "scan-001",
    userId: "user-1",
    input: {
      id: "input-1",
      type: "pdf",
      content: "offer_letter_techcorp.pdf",
      fileName: "Offer_Letter_TechCorp.pdf",
      fileSize: 245000,
    },
    status: "completed",
    trustScore: 87,
    createdAt: new Date(Date.now() - 1000 * 60 * 15),
    completedAt: new Date(Date.now() - 1000 * 60 * 14),
  },
  {
    id: "scan-002",
    userId: "user-1",
    input: {
      id: "input-2",
      type: "url",
      content: "https://suspicious-company.xyz",
      url: "https://suspicious-company.xyz",
    },
    status: "completed",
    trustScore: 18,
    createdAt: new Date(Date.now() - 1000 * 60 * 45),
    completedAt: new Date(Date.now() - 1000 * 60 * 43),
  },
  {
    id: "scan-003",
    userId: "user-1",
    input: {
      id: "input-3",
      type: "linkedin",
      content: "https://linkedin.com/in/verified-recruiter",
      url: "https://linkedin.com/in/verified-recruiter",
    },
    status: "completed",
    trustScore: 92,
    createdAt: new Date(Date.now() - 1000 * 60 * 120),
    completedAt: new Date(Date.now() - 1000 * 60 * 118),
  },
  {
    id: "scan-004",
    userId: "user-1",
    input: {
      id: "input-4",
      type: "email",
      content: "Dear candidate, congratulations on your selection...",
    },
    status: "completed",
    trustScore: 42,
    createdAt: new Date(Date.now() - 1000 * 60 * 240),
    completedAt: new Date(Date.now() - 1000 * 60 * 238),
  },
  {
    id: "scan-005",
    userId: "user-1",
    input: {
      id: "input-5",
      type: "pdf",
      content: "appointment_letter_global_solutions.pdf",
      fileName: "Appointment_Letter.pdf",
      fileSize: 312000,
    },
    status: "processing",
    createdAt: new Date(Date.now() - 1000 * 60 * 2),
  },
];

// ── Sample Trust Score ──
export const mockTrustScore: TrustScore = {
  overall: 23,
  confidence: 94,
  level: "danger",
  dimensions: {
    document: {
      name: "Document Analysis",
      score: 15,
      weight: 0.25,
      label: "High Risk",
      evidence: [
        {
          id: "ev-1",
          source: "Document Parser",
          description: "Company letterhead contains low-resolution logo with JPEG artifacts, suggesting it was scraped from the internet",
          severity: "high",
          timestamp: new Date(),
        },
        {
          id: "ev-2",
          source: "Document Parser",
          description: "Offer letter references a CTC of ₹18 LPA for a fresher role — significantly above industry standard for an unknown company",
          severity: "medium",
          timestamp: new Date(),
        },
        {
          id: "ev-3",
          source: "NLP Engine",
          description: "Language patterns match known scam templates with 89% confidence",
          severity: "critical",
          timestamp: new Date(),
        },
      ],
    },
    domain: {
      name: "Domain Intelligence",
      score: 8,
      weight: 0.20,
      label: "Critical Risk",
      evidence: [
        {
          id: "ev-4",
          source: "WHOIS Lookup",
          description: "Domain registered only 6 days ago via anonymous proxy registrar",
          severity: "critical",
          timestamp: new Date(),
        },
        {
          id: "ev-5",
          source: "SSL Checker",
          description: "Free Let's Encrypt SSL certificate issued 5 days ago — no organizational validation",
          severity: "high",
          timestamp: new Date(),
        },
      ],
    },
    company: {
      name: "Company Verification",
      score: 12,
      weight: 0.20,
      label: "Critical Risk",
      evidence: [
        {
          id: "ev-6",
          source: "MCA Registry",
          description: "No company found in Ministry of Corporate Affairs database with matching CIN",
          severity: "critical",
          timestamp: new Date(),
        },
        {
          id: "ev-7",
          source: "GST Verification",
          description: "GST number provided in the document does not exist in the GST registry",
          severity: "critical",
          timestamp: new Date(),
        },
      ],
    },
    recruiter: {
      name: "Recruiter Verification",
      score: 35,
      weight: 0.15,
      label: "Suspicious",
      evidence: [
        {
          id: "ev-8",
          source: "LinkedIn Analysis",
          description: "Recruiter's LinkedIn profile created 2 weeks ago with only 12 connections",
          severity: "high",
          timestamp: new Date(),
        },
      ],
    },
    community: {
      name: "Community Reputation",
      score: 45,
      weight: 0.10,
      label: "Needs Caution",
      evidence: [
        {
          id: "ev-9",
          source: "Reddit Analysis",
          description: "3 posts on r/indianworkplace mentioning similar scam pattern from same company name",
          severity: "high",
          url: "https://reddit.com/r/indianworkplace",
          timestamp: new Date(),
        },
      ],
    },
    technical: {
      name: "Technical Analysis",
      score: 20,
      weight: 0.10,
      label: "High Risk",
      evidence: [
        {
          id: "ev-10",
          source: "Email Header Analysis",
          description: "Email sent from a free Gmail account despite claiming to be an official corporate communication",
          severity: "high",
          timestamp: new Date(),
        },
      ],
    },
  },
};

// ── Investigation Steps ──
export const mockInvestigationSteps: InvestigationStep[] = [
  {
    id: "step-1",
    agentName: "Document Agent",
    action: "Extracted text and metadata from uploaded PDF",
    result: "Found company name, CIN, recruiter name, salary details, and contact information",
    status: "completed",
    duration: 1.2,
    timestamp: new Date(Date.now() - 1000 * 28),
  },
  {
    id: "step-2",
    agentName: "Domain Agent",
    action: "Performed WHOIS lookup and SSL verification on company domain",
    result: "Domain age: 6 days. Registrar: anonymous proxy. SSL: Let's Encrypt (free tier)",
    status: "completed",
    duration: 2.8,
    timestamp: new Date(Date.now() - 1000 * 25),
  },
  {
    id: "step-3",
    agentName: "Company Agent",
    action: "Verified CIN against MCA/ROC registry",
    result: "CIN not found in Ministry of Corporate Affairs database",
    status: "completed",
    duration: 3.5,
    timestamp: new Date(Date.now() - 1000 * 21),
  },
  {
    id: "step-4",
    agentName: "Company Agent",
    action: "Verified GST number against GST registry",
    result: "GST number does not exist",
    status: "completed",
    duration: 2.1,
    timestamp: new Date(Date.now() - 1000 * 18),
  },
  {
    id: "step-5",
    agentName: "Recruiter Agent",
    action: "Analyzed LinkedIn profile of the recruiter",
    result: "Profile created 14 days ago. 12 connections. No endorsements.",
    status: "completed",
    duration: 4.2,
    timestamp: new Date(Date.now() - 1000 * 14),
  },
  {
    id: "step-6",
    agentName: "Reputation Agent",
    action: "Searched Reddit, Glassdoor, and forums for company mentions",
    result: "Found 3 negative posts on Reddit matching scam patterns",
    status: "completed",
    duration: 5.7,
    timestamp: new Date(Date.now() - 1000 * 8),
  },
  {
    id: "step-7",
    agentName: "Risk Agent",
    action: "Calculated weighted trust score from all dimensions",
    result: "Overall Trust Score: 23/100 — HIGH RISK. Recommendation: Do not proceed.",
    status: "completed",
    duration: 0.8,
    timestamp: new Date(Date.now() - 1000 * 2),
  },
];

// ── Activity Feed ──
export const mockActivityFeed: ActivityItem[] = [
  {
    id: "act-1",
    type: "alert",
    title: "Scam Detected",
    description: "Fraudulent offer letter from 'Global Tech Solutions' flagged with trust score 12",
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    trustLevel: "danger",
  },
  {
    id: "act-2",
    type: "scan",
    title: "Scan Completed",
    description: "TechCorp internship offer verified — Trust Score 87",
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    trustLevel: "safe",
  },
  {
    id: "act-3",
    type: "report",
    title: "Report Generated",
    description: "Comprehensive investigation report for suspicious-company.xyz",
    timestamp: new Date(Date.now() - 1000 * 60 * 45),
    trustLevel: "danger",
  },
  {
    id: "act-4",
    type: "scan",
    title: "New Scan Started",
    description: "LinkedIn recruiter profile verification in progress",
    timestamp: new Date(Date.now() - 1000 * 60 * 60),
  },
  {
    id: "act-5",
    type: "system",
    title: "System Update",
    description: "MCA verification database updated with latest company registrations",
    timestamp: new Date(Date.now() - 1000 * 60 * 120),
  },
];

// ── Sample Report ──
export const mockReport: Report = {
  id: "report-001",
  scanId: "scan-002",
  trustScore: mockTrustScore,
  aiSummary: `## Investigation Summary

This document has been flagged as **HIGH RISK** with a trust score of **23/100**.

### Key Findings

1. **Domain Fraud Indicators**: The company website domain was registered only **6 days ago** through an anonymous proxy registrar, which is a strong indicator of a fraudulent operation. Legitimate companies typically have domain ages of several years.

2. **Company Registration Failure**: The CIN (Corporate Identity Number) provided in the offer letter **does not exist** in the Ministry of Corporate Affairs (MCA) database. The GST number is also invalid. This means the company is **not legally registered** in India.

3. **Document Pattern Matching**: The language patterns in the offer letter match known scam templates with **89% confidence**. The salary offer of ₹18 LPA for a fresher position at an unverified company is significantly above market rate — a common tactic used by scammers.

4. **Recruiter Profile**: The recruiter's LinkedIn profile was created only **2 weeks ago** with minimal connections and no endorsements, suggesting a fabricated professional identity.

5. **Community Reports**: Multiple Reddit posts describe similar scam patterns associated with this company name, including requests for upfront payment and personal document collection.

### Recommendation

**Do not share personal information, documents, or make any payments.** This appears to be a sophisticated recruitment scam. Report this to your university placement cell and local cyber crime authorities.`,
  investigationSteps: mockInvestigationSteps,
  recommendations: [
    "Do not share any personal documents (Aadhaar, PAN, bank details) with this entity",
    "Do not make any payments or deposits as requested in the offer letter",
    "Report this to your university's placement cell immediately",
    "File a complaint with the Cyber Crime Portal (cybercrime.gov.in)",
    "Block the recruiter's email and phone number",
    "Warn other students in your network about this fraudulent company",
  ],
  createdAt: new Date(),
};

// ── Sample Company ──
export const mockCompany: Company = {
  id: "comp-001",
  name: "Global Tech Solutions Pvt. Ltd.",
  website: "https://suspicious-company.xyz",
  registrationStatus: "not_found",
  cin: "U72200MH2024PTC123456",
  trustScore: 12,
  domain: {
    domain: "suspicious-company.xyz",
    age: 6,
    registrar: "NameCheap (via WhoisGuard Privacy)",
    expirationDate: "2026-06-09",
    sslValid: true,
    sslIssuer: "Let's Encrypt",
    whoisPrivacy: true,
  },
  scansCount: 47,
};
