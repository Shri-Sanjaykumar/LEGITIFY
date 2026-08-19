// ==============================================================================
// LEGITIFY FORENSIC & INTERNSHIELD DETECTION ENGINE
// 100% Exact Port of InternShield NLP Classifier, NER Extractor, & 10 Rules
// ==============================================================================
import { execFile } from 'child_process';
import { promisify } from 'util';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { EvidenceItem } from '../../types';
import { extractTextFromImage } from '../utils/ocr';

const require = createRequire(import.meta.url);
const pdfParse = require('pdf-parse');
const execFileAsync = promisify(execFile);

export interface TriggeredFlag {
  rule: string;
  severity: "critical" | "high" | "medium" | "low" | "info";
  message: string;
  score: number;
}

export interface DocumentExtractionResult {
  filename?: string;
  mime_type?: string;
  extracted_text: string;
  has_fee_demand: boolean;
  is_confirmed_impersonation?: boolean;
  is_suspicious_offer_letter?: boolean;
  detected_company_name?: string;
  detected_domain?: string;
  detected_email?: string;
  detected_cin?: string;
  detected_stipend?: string;
  detected_dates?: string[];
  has_urgency?: boolean;
  has_informal_channel?: boolean;
  has_grammar_anomalies?: boolean;
  has_generic_greeting?: boolean;
  has_implausible_stipend?: boolean;
  requested_fees?: { amount?: string; reason?: string; channel?: string }[];
  suspicious_patterns: string[];
  extracted_entities: Record<string, any>;
  evidence: EvidenceItem[];
  triggered_flags: TriggeredFlag[];
  dimension_scores: {
    rules: number;
    nlp: number;
    ner: number;
  };
  final_score: number;
  verdict: "LIKELY GENUINE" | "SUSPICIOUS" | "LIKELY FAKE";
  next_steps: string[];
}

export interface DocumentAnalysisResult extends DocumentExtractionResult {
  file_size?: number;
  sanitized_evidence_block: string;
  detected_entities: {
    emails: string[];
    phones: string[];
    urls: string[];
    fees_detected: { amount: string; reason: string }[];
    upi_ids: string[];
    cryptos: string[];
    informal_channels: string[];
    urgency_phrases: string[];
  };
  risk_signals: string[];
}

const KNOWN_FAKE_COMPANIES = [
  "Techserv Solutions", "Global IT Academy", "Genius InfoTech", "Nexus Digital India",
  "ProHire Solutions", "DataMinds Technologies", "CloudNest Innovations", "AlphaEdge IT Solutions",
  "SkillBridge Infotech", "PrimeTech Global", "Zenith IT Hub", "OmniCore Solutions",
  "ByteForce Technologies", "DigiCraft Solutions", "VisionX Technologies", "TechPulse India",
  "NovaTech Services", "InfinityStack Solutions", "CyberNex Technologies", "SwiftCode Academy",
  "Clinchsoft Technologies", "Clinchsoft", "Apex Global Solutions", "FastTrack Placements"
];

const PERSONAL_EMAIL_DOMAINS = new Set([
  "gmail.com", "yahoo.com", "yahoo.in", "outlook.com", "hotmail.com",
  "rediffmail.com", "protonmail.com", "aol.com", "ymail.com",
  "mail.com", "inbox.com", "zoho.com", "icloud.com", "live.com",
  "yandex.com", "tutanota.com", "guerrillamail.com", "tempmail.com"
]);

// --- GENUINE INDICATORS (InternShield) ---
const GENUINE_INDICATORS: [RegExp, number, string, boolean][] = [
  [/(terms?\s+and\s+conditions?|terms\s+of\s+employment)/i, 0.04, "Contains terms and conditions", true],
  [/(probation\s+period|probationary\s+period)/i, 0.04, "Mentions probation period", false],
  [/(non[\-\s]?disclosure|nda|confidentiality\s+agreement)/i, 0.05, "Includes NDA/confidentiality clause", false],
  [/(intellectual\s+property|ip\s+rights)/i, 0.03, "References IP rights", false],
  [/(code\s+of\s+conduct|company\s+polic)/i, 0.03, "References company policies", false],
  [/(notice\s+period)/i, 0.03, "Mentions notice period", false],
  [/(termination|dismissal)\s+(clause|policy)/i, 0.03, "Includes termination clause", false],
  [/(ctc|cost\s+to\s+company|compensation\s+breakup)/i, 0.05, "Has compensation breakdown", true],
  [/(basic\s+salary|gross\s+salary|net\s+salary)/i, 0.04, "Mentions specific salary component", true],
  [/(pf|provident\s+fund|esi|gratuity)/i, 0.05, "Mentions statutory benefits (PF/ESI)", true],
  [/(tax\s+deduction|tds|income\s+tax)/i, 0.04, "References tax deductions", false],
  [/(hra|house\s+rent\s+allowance|dearness\s+allowance)/i, 0.04, "Mentions HRA/DA", false],
  [/(medical\s+insurance|health\s+insurance|group\s+insurance)/i, 0.04, "Mentions insurance benefits", false],
  [/(cin|corporate\s+identity\s+number)/i, 0.06, "Contains CIN reference", true],
  [/(registered\s+office|corporate\s+office)/i, 0.04, "Mentions registered office", true],
  [/(authorized\s+signatory)/i, 0.04, "Has authorized signatory", true],
  [/(offer\s+is\s+subject\s+to|contingent\s+upon)/i, 0.04, "Conditional offer language", false],
  [/(background\s+verification|background\s+check)/i, 0.04, "Mentions background verification", false],
  [/(employee\s+id|employee\s+code|employee\s+number)/i, 0.03, "References employee ID", false],
  [/(we\s+are\s+pleased\s+to\s+(offer|inform|extend))/i, 0.02, "Professional offer language", false],
  [/(designation|role|position)\s*:\s*\w+/i, 0.03, "Specifies designation/role", false],
  [/(reporting\s+(to|manager)|supervisor)/i, 0.03, "Mentions reporting structure", false],
  [/(letter\s+of\s+(appointment|offer|intent))/i, 0.03, "Uses formal letter type", false],
  [/(human\s+resources?\s+department|hr\s+department)/i, 0.03, "References HR department", false],
];

// --- FRAUD INDICATORS (InternShield) ---
const FRAUD_INDICATORS: [RegExp, number, string][] = [
  [/(pay|deposit|transfer|send)\s*(rs\.?|₹|inr|money|amount|fee)/i, 0.18, "Requests money/payment from candidate"],
  [/(registration\s+fee|processing\s+fee|security\s+deposit)/i, 0.20, "Demands registration/processing fee"],
  [/(training\s+fee|kit\s+charge|laptop\s+deposit)/i, 0.15, "Charges for training/equipment"],
  [/(refundable\s+(deposit|amount|fee))/i, 0.15, "Mentions 'refundable deposit' — common scam tactic"],
  [/(pay\s+before\s+joining|advance\s+payment)/i, 0.18, "Demands payment before joining"],
  [/(guaranteed?\s+(placement|job|salary|income))/i, 0.12, "Guarantees placement/job"],
  [/(100\s*%\s*(placement|guaranteed|success))/i, 0.14, "Claims 100% guarantee"],
  [/(earn\s+(up\s+to|upto)\s*₹?\s*\d+\s*lakh)/i, 0.12, "Unrealistic earning claims"],
  [/(no\s+(experience|skills?)\s+(required|needed))/i, 0.10, "No experience required for skilled role"],
  [/(work\s+from\s+home.*earn|earn.*work\s+from\s+home)/i, 0.10, "WFH earning scheme language"],
  [/(unlimited\s+(earning|income|potential))/i, 0.10, "Unlimited earning claims"],
  [/(whatsapp|telegram|signal)\s*(for|to|at|:)?\s*(details|more|joining|info|contact)/i, 0.12, "Uses WhatsApp/Telegram for official comms"],
  [/(join\s+(our|the)\s+(whatsapp|telegram)\s+group)/i, 0.14, "Directs to WhatsApp/Telegram group"],
  [/(call\s+this\s+number|contact\s+on\s+(mobile|cell|phone))/i, 0.08, "Directs to personal phone number"],
  [/(click\s+(here|this\s+link|below).*register)/i, 0.10, "Pushes registration via link"],
  [/(google\s*form|typeform|jotform)/i, 0.12, "Uses Google Forms/Typeform for hiring"],
  [/(bit\.ly|tinyurl|short\.link|goo\.gl)/i, 0.10, "Uses URL shortener — obfuscation"],
  [/(selected|shortlisted)\s+(based\s+on\s+(your\s+)?(resume|profile|cv))/i, 0.09, "Unsolicited selection claim"],
  [/(you\s+have\s+been\s+(selected|chosen|picked))\s+(without|from\s+our\s+database)/i, 0.10, "Unsolicited selection without application"],
  [/(congratulations!?\s+you\s+(have\s+been|are)\s+selected)/i, 0.08, "Over-enthusiastic congratulations"],
  [/(respond\s+within\s+24\s+hours?|immediately|urgent|asap)/i, 0.06, "Uses urgency/pressure language"],
  [/(limited\s+slots?|seats?\s+filling\s+fast|only\s+\d+\s+seats?)/i, 0.08, "Creates artificial scarcity"],
  [/(offer\s+(will\s+)?expire|last\s+chance|final\s+call)/i, 0.07, "Pressures with expiry threats"],
  [/(no\s+interview|direct\s+selection|skip\s+interview)/i, 0.12, "Claims no interview needed"],
  [/(refer\s+and\s+earn|referral\s+bonus\s+for\s+candidates)/i, 0.10, "Referral scheme pattern"],
];

const URGENCY_PHRASES = [
  "respond within 24 hours", "within 48 hours", "limited slots", "offer expires",
  "act immediately", "don't miss this opportunity", "limited time offer", "respond urgently",
  "seats filling fast", "last date to respond", "immediate joining required", "confirm within",
  "hurry up", "first come first serve", "last few seats", "offer valid till", "respond today", "do not delay"
];

export async function extractTextFromPdfBuffer(buffer: Buffer): Promise<string> {
  try {
    const PDFClass = (pdfParse as any).PDFParse || (pdfParse as any).default?.PDFParse;
    if (typeof PDFClass === 'function') {
      const parser = new PDFClass({ data: buffer });
      const data = await parser.getText();
      const parsedText = (typeof data === 'string' ? data : data?.text || '').trim();
      if (parsedText.length > 20) return parsedText;
    } else if (typeof pdfParse === 'function') {
      const data = await (pdfParse as any)(buffer);
      const parsedText = data?.text?.trim() || '';
      if (parsedText.length > 20) return parsedText;
    }
  } catch {}

  try {
    const ocrText = await extractTextFromImage(buffer, 'application/pdf');
    if (ocrText && ocrText.trim().length > 15) return ocrText.trim();
  } catch {}

  const rawStr = buffer.toString('utf-8');
  const printable = rawStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return printable.length > 20 ? printable : "";
}

export async function extractTextFromImageBuffer(buffer: Buffer, mimeType: string = 'image/jpeg'): Promise<string> {
  try {
    const text = await extractTextFromImage(buffer, mimeType);
    if (text && text.length > 20) return text;
  } catch {}

  const rawStr = buffer.toString('utf-8');
  const printable = rawStr.replace(/[^\x20-\x7E\n\r\t]/g, ' ').replace(/\s+/g, ' ').trim();
  return printable.length > 20 ? printable : "";
}

export function extractDocumentSignals(text: string, filename?: string, mimeType?: string): DocumentAnalysisResult {
  const textLower = text.toLowerCase();
  const flags: TriggeredFlag[] = [];
  const evidence: EvidenceItem[] = [];
  const suspiciousPatterns: string[] = [];

  const emails = Array.from(new Set(text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g) || []));
  const phones = Array.from(new Set(text.match(/(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}|\b[6-9]\d{9}\b/g) || []));
  const urls = Array.from(new Set(text.match(/https?:\/\/[^\s<>"]+/g) || []));
  const upiMatches = Array.from(new Set(text.match(/[a-zA-Z0-9.\-_]{2,256}@(paytm|upi|ybl|okhdfcbank|okaxis|okicici|oksbi|axl|ibl|barodampay|postbank)/gi) || []));

  // --- 1. Company Name Extraction ---
  let detectedCompanyName: string | undefined;
  for (const fake of KNOWN_FAKE_COMPANIES) {
    if (textLower.includes(fake.toLowerCase())) {
      detectedCompanyName = fake;
      flags.push({
        rule: "known_fake_company",
        severity: "critical",
        message: `Company '${fake}' matches a known fraudulent recruitment entity in our intelligence database.`,
        score: 1.0,
      });
      break;
    }
  }

  if (!detectedCompanyName) {
    const entMatch = text.match(/\b(Tata Consultancy Services|TCS|Tata Motors|Infosys|Wipro|Microsoft|Google|Amazon|Accenture|Cognizant|Capgemini|IndiGo|InterGlobe|Airports Authority of India|AAI|Reliance|HCL Tech|Tech Mahindra|Adobe|IBM|Swiggy|Zomato|Flipkart|Paytm|Deloitte|Clinchsoft Technologies)\b/i);
    if (entMatch) detectedCompanyName = entMatch[1].trim();
  }

  if (!detectedCompanyName) {
    const prefixMatch = text.match(/(?:Offer\s*Letter\s*(?:from|for|by)|Welcome\s*to|Employment\s*Offer\s*-\s*|Sub:\s*Appointment\s*at|Company\s*Name\s*:\s*|Organisation\s*:\s*)([A-Z0-9][A-Za-z0-9\s&.,-]{2,40}(?:Pvt\s*Ltd|Private\s*Limited|Limited|Ltd|LLC|Inc|Corp|Technologies|Solutions|Enterprises|Infotech|Services|Global))/i);
    if (prefixMatch) detectedCompanyName = prefixMatch[1].trim();
  }

  if (!detectedCompanyName) {
    // Check first 3 lines of text
    const firstLines = text.split('\n').map(l => l.trim()).filter(Boolean).slice(0, 3);
    for (const l of firstLines) {
      if (l.length >= 4 && l.length <= 45 && !/(offer|internship|appointment|letter|date|dear|sub)/i.test(l)) {
        detectedCompanyName = l;
        break;
      }
    }
  }

  // --- 2. NLP Classification (InternShield Exact Algorithm) ---
  let genuineBoost = 0.0;
  let fraudPenalty = 0.0;
  let genuineMatches = 0;
  let criticalGenuineMatches = 0;
  let criticalGenuineTotal = 0;

  for (const [pattern, boost, desc, isCrit] of GENUINE_INDICATORS) {
    if (isCrit) criticalGenuineTotal++;
    if (pattern.test(textLower)) {
      genuineBoost += boost;
      genuineMatches++;
      if (isCrit) criticalGenuineMatches++;
    }
  }

  let fraudMatches = 0;
  for (const [pattern, penalty, desc] of FRAUD_INDICATORS) {
    if (pattern.test(textLower)) {
      fraudPenalty += penalty;
      fraudMatches++;
      flags.push({
        rule: "nlp_classifier",
        severity: penalty >= 0.12 ? "high" : "medium",
        message: desc,
        score: penalty,
      });
      suspiciousPatterns.push(desc);
    }
  }

  let absencePenalty = 0.0;
  if (criticalGenuineTotal > 0) {
    const ratio = criticalGenuineMatches / criticalGenuineTotal;
    if (ratio < 0.2) absencePenalty = 0.12;
    else if (ratio < 0.4) absencePenalty = 0.07;
    else if (ratio < 0.6) absencePenalty = 0.03;
  }
  if (genuineMatches === 0) absencePenalty += 0.10;

  let nlpConfidence = 0.5;
  genuineBoost = Math.min(genuineBoost, 0.40);
  fraudPenalty = Math.min(fraudPenalty, 0.50);
  nlpConfidence += genuineBoost - fraudPenalty - absencePenalty;

  const words = text.split(/\s+/).filter(Boolean);
  if (words.length < 80) nlpConfidence -= 0.10;
  else if (words.length < 150) nlpConfidence -= 0.05;
  else if (words.length > 500) nlpConfidence += 0.03;

  const centered = nlpConfidence - 0.5;
  nlpConfidence = Math.abs(centered) > 0.001 ? 0.5 + 0.5 * (centered / (Math.abs(centered) + 0.15)) : 0.5;
  nlpConfidence = Math.max(0.05, Math.min(0.98, nlpConfidence));

  // --- 3. NER Extractor & Verification ---
  let nerVerification = 0.0;
  let companyCheck = detectedCompanyName ? (detectedCompanyName.split(' ').length >= 2 ? 1.0 : 0.6) : 0.0;
  if (!detectedCompanyName) {
    flags.push({
      rule: "ner_company",
      severity: "high",
      message: "Could not identify a clear company name in the letter. Legitimate offer letters prominently display company name.",
      score: 0.0,
    });
  }

  const hasHRSignatory = /(?:hr\s+manager|human\s+resources|authorized\s+signatory|sincerely|regards)[,\s:]*\n?\s*[A-Z][a-z]+\s+[A-Z][a-z]+/i.test(text);
  const personCheck = hasHRSignatory ? 1.0 : (text.length > 300 ? 0.0 : 0.5);
  if (!hasHRSignatory && text.length > 300) {
    flags.push({
      rule: "ner_person",
      severity: "high",
      message: "No HR contact person name identified. Legitimate letters include HR signatory details.",
      score: 0.0,
    });
  }

  const hasCorporateEmail = emails.some(e => !PERSONAL_EMAIL_DOMAINS.has(e.split('@')[1]?.toLowerCase() || ''));
  let contactCheck = 0.0;
  if (hasCorporateEmail && phones.length > 0) contactCheck = 1.0;
  else if (hasCorporateEmail) contactCheck = 0.8;
  else if (emails.length > 0 && phones.length > 0) contactCheck = 0.5;
  else if (emails.length > 0 || phones.length > 0) contactCheck = 0.3;
  else {
    flags.push({
      rule: "ner_contact",
      severity: "high",
      message: "No contact information (email or phone) found in the letter.",
      score: 0.0,
    });
  }

  const hasAddress = /(?:address|office|building|tower|sector|plot|bangalore|bengaluru|mumbai|delhi|hyderabad|pune|chennai|noida|gurugram|kolkata)/i.test(textLower);
  const locationCheck = hasAddress ? 1.0 : (text.length > 300 ? 0.0 : 0.5);
  if (!hasAddress && text.length > 300) {
    flags.push({
      rule: "ner_location",
      severity: "medium",
      message: "No company location/address identified in the letter.",
      score: 0.0,
    });
    flags.push({
      rule: "missing_fields",
      severity: "low",
      message: "Letter is missing: company address.",
      score: 0.0,
    });
  }

  const dates = text.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/g) || [];
  const dateCheck = dates.length >= 2 ? 1.0 : (dates.length === 1 ? 0.6 : 0.2);

  nerVerification = 0.25 * companyCheck + 0.20 * personCheck + 0.25 * contactCheck + 0.15 * locationCheck + 0.15 * dateCheck;

  // --- 4. Rule Suspicion ---
  let ruleSuspicion = 0.0;
  let ruleCount = 0;

  // Email Rule
  if (emails.length === 0) {
    ruleSuspicion += 0.4; ruleCount++;
  } else {
    const personalFound = emails.filter(e => PERSONAL_EMAIL_DOMAINS.has(e.split('@')[1]?.toLowerCase() || ''));
    if (personalFound.length === emails.length) {
      ruleSuspicion += 0.8; ruleCount++;
      flags.push({
        rule: "email_domain",
        severity: "high",
        message: `Email domain is ${personalFound[0].split('@')[1]} — a personal email service. Legitimate companies use corporate email domains.`,
        score: 0.8,
      });
    }
  }

  // Payment demands
  const hasNoFeeDisclaimer = /(?:no\s*(?:fees?|charges?|cost)|never\s*charges?\s*fees?|free\s*of\s*(?:cost|charge)|without\s*any\s*fee|does\s*not\s*charge)/i.test(text);
  const feeTriggerRegex = /(?:registration\s*fee|training\s*(?:fee|cost|charge)|security\s*deposit|laptop\s*deposit|caution\s*deposit|mandatory\s*(?:fee|payment|deposit|charge)|pay\s*(?:mandatory|immediately|before\s*joining|to\s*join|security\s*deposit|registration|via\s*upi)|application\s*fee|onboarding\s*fee|document\s*verification\s*charge|id\s*card\s*fee|uniform\s*deposit|processing\s*fee|deposit\s*(?:of\s*)?(?:₹|rs\.?|inr|\$)\s*[0-9,]+)/gi;
  const isFeeDemand = (feeTriggerRegex.test(text) || upiMatches.length > 0) && !hasNoFeeDisclaimer;
  if (isFeeDemand) {
    ruleSuspicion += 1.0; ruleCount++;
    flags.push({
      rule: "payment_demand",
      severity: "critical",
      message: "Letter asks candidate to pay money / registration fee / security deposit. Legitimate employers NEVER charge candidates.",
      score: 1.0,
    });
  }

  // Urgency
  const urgencyFound = URGENCY_PHRASES.filter(p => textLower.includes(p));
  if (urgencyFound.length > 0) {
    ruleSuspicion += 0.6; ruleCount++;
  }

  // Suspicious links
  if (/(?:docs\.google\.com\/forms|forms\.gle|typeform\.com|jotform\.com|chat\.whatsapp\.com|t\.me\/|bit\.ly|tinyurl)/i.test(textLower)) {
    ruleSuspicion += 0.7; ruleCount++;
  }

  const avgRuleSuspicion = ruleCount > 0 ? Math.min(1.0, ruleSuspicion / 5) : 0.0;
  const ruleConfidence = 1.0 - avgRuleSuspicion;

  // --- 5. Final Ensemble Scorer (InternShield Exact Math) ---
  let rawScore = 0.45 * nlpConfidence + 0.35 * ruleConfidence + 0.20 * nerVerification;

  if (rawScore >= 0.5) {
    const norm = (rawScore - 0.5) * 2;
    const scaled = Math.pow(norm, 0.8);
    rawScore = 0.5 + scaled * 0.5;
  } else {
    const norm = (0.5 - rawScore) * 2;
    const scaled = Math.pow(norm, 0.8);
    rawScore = 0.5 - scaled * 0.5;
  }

  const flagCount = flags.length;
  if (flagCount >= 6) rawScore -= 0.12;
  else if (flagCount >= 4) rawScore -= 0.08;
  else if (flagCount >= 2) rawScore -= 0.04;

  const disagreement = Math.abs(nlpConfidence - ruleConfidence);
  if (disagreement > 0.5) rawScore -= 0.05;

  if (nerVerification < 0.2) rawScore = Math.min(rawScore, 0.55);

  let finalPercent = Math.round(rawScore * 100);
  finalPercent = Math.max(5, Math.min(98, finalPercent));

  let finalVerdict: "LIKELY GENUINE" | "SUSPICIOUS" | "LIKELY FAKE" = "LIKELY GENUINE";
  if (finalPercent >= 72) finalVerdict = "LIKELY GENUINE";
  else if (finalPercent >= 40) finalVerdict = "SUSPICIOUS";
  else finalVerdict = "LIKELY FAKE";

  const nextSteps = finalVerdict === "LIKELY FAKE" ? [
    "🚨 Do NOT share any personal documents (Aadhaar, PAN, bank details) with this organization.",
    "Report this offer letter to your college placement cell immediately.",
    "If you found this on Internshala or LinkedIn, report the listing on the platform.",
    "File a complaint on the National Cyber Crime Portal (cybercrime.gov.in) if you've already shared any information.",
    "Do NOT pay any 'registration fee', 'security deposit', or 'training charges'. Legitimate companies never ask candidates for money.",
    `Search for '${detectedCompanyName || "this company"}' on MCA21 (mca.gov.in) to check if it's a registered company.`,
  ] : finalVerdict === "SUSPICIOUS" ? [
    "⚠️ Verify this offer independently before sharing any personal information.",
    "Search for the company on LinkedIn and check if it has a legitimate presence (employee count, verified page).",
    "Call the company's official number (found independently, NOT from this letter) and ask to speak with HR.",
    "Check the company's reviews on Glassdoor and AmbitionBox.",
    `Verify '${detectedCompanyName || "company"}' CIN on MCA21 portal (mca.gov.in/mcafoportal).`,
  ] : [
    "✅ This letter appears to be from a legitimate organization.",
    "Standard next steps: review the compensation and terms carefully before accepting.",
    "Respond within the deadline mentioned in the letter.",
    "Keep a copy of this offer letter for your records.",
    "Prepare your joining documents (ID proof, education certificates) for onboarding.",
  ];

  return {
    filename,
    mime_type: mimeType,
    extracted_text: text,
    sanitized_evidence_block: text.slice(0, 1000),
    has_fee_demand: isFeeDemand,
    detected_company_name: detectedCompanyName,
    detected_domain: emails[0]?.split('@')[1]?.toLowerCase(),
    detected_email: emails[0],
    detected_cin: text.match(/\b([UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6})\b/i)?.[1]?.toUpperCase(),
    has_urgency: urgencyFound.length > 0,
    has_informal_channel: suspiciousPatterns.some(p => p.includes("WhatsApp") || p.includes("Telegram")),
    has_grammar_anomalies: false,
    has_generic_greeting: false,
    has_implausible_stipend: false,
    suspicious_patterns: suspiciousPatterns,
    extracted_entities: {
      company: detectedCompanyName,
      emails,
      phones,
      urls,
    },
    detected_entities: {
      emails,
      phones,
      urls,
      fees_detected: [],
      upi_ids: upiMatches,
      cryptos: [],
      informal_channels: [],
      urgency_phrases: urgencyFound,
    },
    risk_signals: flags.map(f => f.message),
    evidence,
    triggered_flags: flags,
    dimension_scores: {
      rules: Math.round(ruleConfidence * 100),
      nlp: Math.round(nlpConfidence * 100),
      ner: Math.round(nerVerification * 100),
    },
    final_score: finalPercent,
    verdict: finalVerdict,
    next_steps: nextSteps,
  };
}

export async function processDocument(
  fileBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<DocumentExtractionResult> {
  let text = "";
  if (mimeType === 'application/pdf' || filename.toLowerCase().endsWith('.pdf')) {
    text = await extractTextFromPdfBuffer(fileBuffer);
  } else if (mimeType.startsWith('image/') || filename.match(/\.(png|jpg|jpeg|webp)$/i)) {
    text = await extractTextFromImageBuffer(fileBuffer, mimeType);
  } else {
    text = fileBuffer.toString('utf-8');
  }

  return extractDocumentSignals(text, filename, mimeType);
}
