// ==============================================================================
// LEGITIFY FORENSIC & INTELLIGENCE REASONING ENGINE (AI PROVIDER)
// Supports Dual AI (OpenAI/Gemini) + Comprehensive Built-in Cybercrime Legal Reasoning
// ==============================================================================
import { GoogleGenAI } from '@google/genai';
import { z } from 'zod';
import { EvidenceItem, RuleEvaluation, MLPredictionResult } from '../../types';

export interface AISynthesisInput {
  entityName: string;
  entityType: string;
  trustScore: number;
  confidence: number;
  riskLevel: string;
  verdict: string;
  evidence: EvidenceItem[];
  rulesTriggered: RuleEvaluation[];
  mlEvaluation?: MLPredictionResult;
  untrustedUserText?: string;
}

export interface AISynthesisOutput {
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
  limitations: string[];
  provider_used: "LOCAL_AI" | "GEMINI_FLASH" | "DETERMINISTIC_FALLBACK";
}

export interface IAIProvider {
  isAvailable(): Promise<boolean>;
  generateSynthesis(input: AISynthesisInput): Promise<AISynthesisOutput>;
  answerCopilot(question: string, context: Record<string, any>): Promise<string>;
}

// ----------------------------------------------------------------------------
// BUILT-IN EXPERT COPILOT REASONING ENGINE (With Personalized Name Greetings)
// ----------------------------------------------------------------------------
export function generateExpertCopilotAnswer(question: string, context: Record<string, any>): string {
  const q = question.toLowerCase().trim();
  const userName = context.user_name || context.candidate_name || (context.user_email ? context.user_email.split('@')[0] : 'Candidate');
  const greeting = `Hello ${userName}! 👋\n\n`;

  const rawName = String(context.entity_name || context.company_name || context.entity_value || 'this investigated opportunity');
  const name = (rawName.match(/\.(png|jpg|jpeg|pdf)$/i) || rawName.includes("images ("))
    ? (context.document_analysis?.extracted_entities?.detected_company || "this investigated opportunity")
    : rawName;

  const score = typeof context.trust_score === 'number' ? context.trust_score : (typeof context.confidence_score === 'number' ? context.confidence_score : 85);
  const riskLevel = String(context.risk_level || (score <= 40 ? 'CRITICAL' : score >= 80 ? 'LOW' : 'MODERATE')).toUpperCase();
  const verdict = String(context.verdict || (score <= 40 ? 'LIKELY SCAM' : score >= 80 ? 'LIKELY LEGITIMATE' : 'MODERATE RISK')).toUpperCase();
  const isHighRisk = score <= 40 || riskLevel === 'CRITICAL' || riskLevel === 'HIGH' || verdict.includes('SCAM');

  // Case 1: Fees, Upfront Charges, Caution Deposits, Training Costs, UPI, Registration
  if (q.includes('fee') || q.includes('pay') || q.includes('money') || q.includes('deposit') || q.includes('charge') || q.includes('upi') || q.includes('cost') || q.includes('amount') || q.includes('registration') || q.includes('laptop') || q.includes('uniform') || q.includes('caution')) {
    return greeting + `### 🛑 Mandatory Forensic Advisory: Recruitment Fees & Caution Deposits

**1. Enterprise Zero-Fee Standard:**
Under standardized corporate governance and international recruitment ethics (ILO Fair Recruitment Initiative), **no legitimate corporate enterprise, Tier-1 MNC (TCS, Infosys, Wipro, Google, Microsoft, Accenture, IBM), or statutory government body ever charges candidates fees** for application processing, interview rounds, training materials, ID card issuance, uniform caution deposits, or laptop allocations.

**2. Fraud Pattern Evaluation for ${name}:**
${isHighRisk
  ? `* **Direct Risk Identified:** The offer under evaluation for **${name}** was flagged with a **Trust Score of ${score}/100 (${riskLevel})**. Demanding money prior to joining is the single most definitive indicator of an organized employment scam.`
  : `* **Active Assessment:** No unauthorized fee clauses were identified in the verified documentation for **${name}** (Trust Score: ${score}/100).`}

**3. Legal Provisions in India:**
* **Section 66D of the Information Technology Act, 2000:** Imposes strict criminal liability and imprisonment up to 3 years for cheating by personation using computer resources.
* **Section 318 of Bharatiya Nyaya Sanhita (BNS) / Section 420 of IPC:** Categorizes fraudulent money collection under false pretenses of employment as cognizable fraud.

**4. Decisive Action Steps:**
1. **Never transfer funds** via UPI (Google Pay, PhonePe, Paytm), QR codes, or personal bank accounts.
2. If payment has already been transferred, immediately dial **1930 (National Cybercrime Helpline)** and report the transaction UTR number.
3. Register a formal complaint with evidence at **[cybercrime.gov.in](https://cybercrime.gov.in)**.`;
  }

  // Case 2: Legal Protection, Reporting, 1930, Cybercrime, Police, Law
  if (q.includes('law') || q.includes('legal') || q.includes('report') || q.includes('police') || q.includes('1930') || q.includes('cybercrime') || q.includes('complain') || q.includes('punishment') || q.includes('ipc') || q.includes('it act')) {
    return greeting + `### ⚖️ Legal Framework & Incident Reporting Protocols

**1. Immediate Statutory Reporting Channels (India):**
* **National Cybercrime Reporting Portal:** File a formal first-information complaint at **[cybercrime.gov.in](https://cybercrime.gov.in)** under "Financial / Job Fraud".
* **Toll-Free 24x7 Helpline:** Dial **1930** immediately to report financial fraud and initiate bank account freeze on the fraudster's beneficiary account.
* **UGC / AICTE Student Grievance Redressal:** If the scam is targeted at college students or campus placements, submit a grievance at **samadhaan.ugc.ac.in**.

**2. Applicable Legal Statutes:**
* **Section 66D, IT Act 2000:** Cheating by personation by using computer resources or fraudulent domains.
* **Section 318 & 319, BNS (formerly Sections 419 & 420, IPC):** Criminal cheating, impersonation, and fraudulent inducement to deliver property.
* **Section 336 & 338, BNS (formerly Sections 468 & 471, IPC):** Forgery for the purpose of cheating and using forged documents (fake offer letterheads/stamps) as genuine.

**3. Evidence Preservation Checklist:**
* Maintain original PDF offer letters, email headers (\`.eml\` format), and sender IP routing.
* Take full timestamped screenshots of WhatsApp / Telegram correspondence.
* Record the Bank Reference Number / UTR number for any attempted or executed UPI payments.`;
  }

  // Case 3: Ministry of Corporate Affairs (MCA), CIN, Company Registration
  if (q.includes('mca') || q.includes('cin') || q.includes('register') || q.includes('company') || q.includes('corporate') || q.includes('roc') || q.includes('gst')) {
    return greeting + `### 🏢 Statutory Corporate Registry & MCA Verification Intelligence

**1. Verification on Official MCA21 Portal:**
* Every legitimate registered private/public enterprise in India possesses a 21-digit alphanumeric **Corporate Identification Number (CIN)** issued by the Registrar of Companies (RoC).
* Navigate to the official Ministry portal: **[mca.gov.in/mcafoportal](https://www.mca.gov.in/mcafoportal/viewCompanyMasterData.do)**.
* Search for **"${name}"** under "Company / LLP Master Data" to verify active incorporation, registered office address, and authorized directors.

**2. Critical Discrepancies to Flag:**
* **Status "Strike Off / Dissolved":** Company has ceased lawful operations.
* **Lookalike Names:** Scammers frequently register shell companies with names subtly mimicking established brands (e.g. *Tata Technologies Consulting Ltd* vs *Tata Consultancy Services Limited*).
* **Missing Registered Address:** Formal offer letters must state the complete physical corporate office address corresponding to MCA master records.`;
  }

  // Case 4: Recruiter Email Domains, Gmail, Yahoo, WhatsApp Hiring
  if (q.includes('email') || q.includes('gmail') || q.includes('domain') || q.includes('whatsapp') || q.includes('telegram') || q.includes('google form') || q.includes('recruiter') || q.includes('hr')) {
    return greeting + `### 📧 Recruiter Domain & Communications Analysis

**1. Enterprise Email Security Standards:**
* Authentic recruitment correspondence originates strictly from **corporate domain email servers** (e.g., \`recruitment@company.com\`, \`careers@infosys.com\`).
* Human Resources departments at established firms **never conduct official onboarding or extend binding employment offers from free public webmail services** (\`@gmail.com\`, \`@yahoo.com\`, \`@outlook.com\`).

**2. Channel Legitimacy Assessment:**
* **WhatsApp & Telegram:** Official recruitment workflows use enterprise applicant tracking systems (Workday, Taleo, Greenhouse). Unsolicited interview invitations or offer disbursements over WhatsApp are severe fraud indicators.
* **Public Form Tools:** Legitimate organizations do not request sensitive identity documents (Aadhaar, PAN, banking credentials) via **Google Forms** or **Typeform**.

**3. Verification Best Practice:**
* Extract the domain from the recruiter's email address and check its registration date via WHOIS/RDAP. Newly registered domains (< 90 days old) attempting to mirror known brands represent typosquatting.`;
  }

  // Case 5: Direct Selection, No Interview, Fake Internship Red Flags
  if (q.includes('interview') || q.includes('direct') || q.includes('selected') || q.includes('shortlisted') || q.includes('selection') || q.includes('fake') || q.includes('genuine') || q.includes('legit') || q.includes('check')) {
    return greeting + `### 🔍 Internship & Job Selection Forensic Analysis

**1. The "Direct Selection" Scam Hallmark:**
* If you received an offer letter stating you were **"Directly Selected" or "Shortlisted without an Interview"**, this is a classic high-volume scam pattern.
* Legitimate employers require at least one technical assessment, aptitude screening, or video interview round before extending a formal offer.

**2. Key Indicators of Authentic vs Fraudulent Letters:**
* **Authentic Offers:** Personalized greeting with your full legal name, detailed CTC breakdown, specific reporting manager, physical office address, clear notice period, and statutory benefits (PF/ESI).
* **Scam Letters:** Generic salutations ("Dear Candidate", "Dear Student"), extreme urgency ("Respond within 24 hours or offer will expire"), demands for refundable training/laptop deposits, and informal contact numbers.

**3. What You Should Do Right Now:**
1. Check the official company careers website directly — never trust phone numbers or links inside an unsolicited PDF.
2. Contact your college training & placement cell (TPO) to confirm if this company is an accredited campus recruiter.`;
  }

  // Case 6: Aadhaar, PAN, Bank Details, Personal Document Safety
  if (q.includes('aadhaar') || q.includes('pan') || q.includes('bank') || q.includes('document') || q.includes('identity') || q.includes('privacy') || q.includes('data')) {
    return greeting + `### 🔒 Personal Identity & Document Safety Protocols

**1. Critical Precaution:**
* **Do NOT share high-resolution copies of your Aadhaar card, PAN card, cancelled cheques, or bank account details** with any unverified organization or via WhatsApp/Google Forms.
* Scammers harvest student identity documents to open fraudulent mule bank accounts or apply for illicit credit lines.

**2. Masked Aadhaar Best Practice:**
* If an employer is verified and requires ID proof, always provide a **Masked Aadhaar** (downloaded from the UIDAI portal \`myaadhaar.uidai.gov.in\`), which displays only the last 4 digits of your Aadhaar number.

**3. What if you already shared documents?**
* Immediately lock your Aadhaar biometrics via the official **mAadhaar app** or UIDAI website.
* Notify your bank to monitor for unauthorized transaction attempts.
* File an incident report on **[cybercrime.gov.in](https://cybercrime.gov.in)**.`;
  }

  // General Adaptive Reasoning
  return greeting + `### 🛡️ LEGITIFY Comprehensive Trust Advisory

**Investigation Summary for ${name}:**
* **Evaluated Trust Index:** **${score}/100** (${verdict})
* **Security Posture:** ${isHighRisk ? '🚨 **HIGH RISK** — Multiple structural or recruitment anomalies detected.' : '✅ **LOW RISK** — Document displays verified corporate characteristics.'}

**Key Principles to Safeguard Your Career:**
1. **Zero Upfront Payments:** Legitimate corporate employers never demand registration fees, security deposits, or laptop charges.
2. **Corporate Domain Email:** Ensure correspondence originates from official company domain servers (\`@company.com\`), not free public webmail.
3. **Independent Verification:** Verify company CIN on **[mca.gov.in](https://www.mca.gov.in/mcafoportal)** and check with your college placement cell.
4. **Emergency Support:** Dial **1930** (Govt of India Cyber Helpline) to report any suspicious recruitment activity immediately.

Feel free to ask any further specific question regarding contract clauses, stipend rules, legal rights, or verification steps!`;
}

// ----------------------------------------------------------------------------
// LOCAL FALLBACK AI SYNTHESIS PROVIDER
// ----------------------------------------------------------------------------
export class LocalAIProvider implements IAIProvider {
  async isAvailable(): Promise<boolean> {
    return true;
  }

  async generateSynthesis(input: AISynthesisInput): Promise<AISynthesisOutput> {
    const isClean = input.trustScore >= 80 && input.riskLevel === 'LOW';
    const isCritical = input.trustScore <= 40 || input.riskLevel === 'CRITICAL';

    const whatWeFound: string[] = [];
    const whyItMatters: string[] = [];
    const whatSupportsIt: string[] = [];
    const whatContradictsIt: string[] = [];
    const whatIsUnknown: string[] = [];

    input.evidence.forEach(e => {
      if (e.severity === 'CRITICAL' || e.severity === 'HIGH') {
        whatWeFound.push(`${e.title}: ${e.snippet}`);
        whyItMatters.push(`[Critical Risk] ${e.evidence_text}`);
        whatContradictsIt.push(`Conflict: ${e.title} failed legitimacy baseline.`);
      } else if (e.verified) {
        whatSupportsIt.push(`Verified: ${e.title} (${e.source_name})`);
      } else {
        whatIsUnknown.push(`Pending confirmation: ${e.title}`);
      }
    });

    if (whatWeFound.length === 0) {
      whatWeFound.push(isClean ? "All statutory checks, domain validation, and email structure passed." : "No explicit fatal indicators identified.");
    }
    if (whyItMatters.length === 0) {
      whyItMatters.push(isClean ? "Corporate profile matches established, verified registry records." : "Requires independent verification.");
    }

    const executive_summary = isCritical
      ? `Critical recruitment risk detected for ${input.entityName}. Document exhibits high-probability employment fraud indicators.`
      : isClean
      ? `${input.entityName} demonstrates authentic structural attributes consistent with verified enterprise recruitment.`
      : `Moderate risk profile for ${input.entityName}. Recommended independent verification before accepting.`;

    const recommendation = isCritical
      ? "Do NOT transfer funds or provide sensitive identification documents. Report to placement cell."
      : isClean
      ? "Proceed with standard review of compensation terms and role responsibilities."
      : "Verify corporate identity on MCA21 portal (mca.gov.in) before proceeding.";

    return {
      executive_summary,
      structured_explanation: {
        what_we_found: whatWeFound,
        why_it_matters: whyItMatters,
        what_supports_it: whatSupportsIt,
        what_contradicts_it: whatContradictsIt,
        what_is_unknown: whatIsUnknown,
        recommendation,
      },
      recommendation,
      limitations: [
        "Analysis is based on automated multi-source evidence extraction and pattern correlation.",
        "Scoring does not substitute formal legal counsel or corporate background checks."
      ],
      provider_used: "LOCAL_AI",
    };
  }

  async answerCopilot(question: string, context: Record<string, any>): Promise<string> {
    return generateExpertCopilotAnswer(question, context);
  }
}

// ----------------------------------------------------------------------------
// GEMINI FLASH AI PROVIDER
// ----------------------------------------------------------------------------
export class GeminiFlashProvider implements IAIProvider {
  private ai: GoogleGenAI | null = null;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY;
    if (apiKey) {
      this.ai = new GoogleGenAI({ apiKey });
    }
  }

  async isAvailable(): Promise<boolean> {
    return !!(this.ai && (process.env.GEMINI_API_KEY || process.env.VITE_GEMINI_API_KEY));
  }

  async generateSynthesis(input: AISynthesisInput): Promise<AISynthesisOutput> {
    if (!this.ai) {
      return new LocalAIProvider().generateSynthesis(input);
    }

    try {
      const prompt = `You are the lead intelligence analyst at LEGITIFY. Generate a forensic analysis for:
Entity: ${input.entityName} (${input.entityType})
Score: ${input.trustScore}/100, Risk: ${input.riskLevel}, Verdict: ${input.verdict}
Evidence items: ${JSON.stringify(input.evidence.map(e => ({ title: e.title, verified: e.verified, severity: e.severity, snippet: e.snippet })))}

Return strictly a JSON object matching this schema:
{
  "executive_summary": string,
  "structured_explanation": {
    "what_we_found": [string],
    "why_it_matters": [string],
    "what_supports_it": [string],
    "what_contradicts_it": [string],
    "what_is_unknown": [string],
    "recommendation": string
  },
  "recommendation": string,
  "limitations": [string]
}`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
        config: { responseMimeType: 'application/json' },
      });

      const parsed = JSON.parse(response.text || '{}');
      return {
        ...parsed,
        provider_used: "GEMINI_FLASH",
      };
    } catch {
      return new LocalAIProvider().generateSynthesis(input);
    }
  }

  async answerCopilot(question: string, context: Record<string, any>): Promise<string> {
    if (!this.ai) {
      return generateExpertCopilotAnswer(question, context);
    }

    try {
      const userName = context.user_name || context.candidate_name || 'Candidate';
      const prompt = `You are the Senior Cybercrime & Employment Trust Copilot at LEGITIFY.
The user is ${userName}.
Always begin your answer by greeting ${userName} politely (e.g. "Hello ${userName}! 👋\n\n").
Answer this student's inquiry thoroughly, professionally, and clearly using clean formatted Markdown (headers, bold accents, bullet points):

Context:
Target Entity: ${context.entity_name || context.company_name || 'Offer Letter'}
Trust Score: ${context.trust_score || 85}/100
Verdict: ${context.verdict || 'Analysis Complete'}

Student Question: "${question}"

Provide authoritative guidance, citing Indian Law (Section 66D IT Act, Section 318 BNS / 420 IPC), National Cybercrime Helpline 1930, cybercrime.gov.in, and MCA21 verification where relevant.`;

      const response = await this.ai.models.generateContent({
        model: 'gemini-1.5-flash',
        contents: prompt,
      });

      return response.text || generateExpertCopilotAnswer(question, context);
    } catch {
      return generateExpertCopilotAnswer(question, context);
    }
  }
}

export function getActiveAIProvider(): IAIProvider {
  return new GeminiFlashProvider();
}
