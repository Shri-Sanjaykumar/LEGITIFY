// ==============================================================================
// LEGITIFY RAG KNOWLEDGE RETRIEVAL SERVICE
// Multi-Tiered Knowledge Chunks (Authoritative, High-Quality, Community)
// ==============================================================================
import { RAGKnowledgeChunk } from '../../types';

// Built-in Knowledge Base for Grounded Corporate, Regulatory & Threat Verification
const KNOWLEDGE_STORE: RAGKnowledgeChunk[] = [
  // TIER 1: Official Regulatory & Government Cybercrime Advisories
  {
    document_id: "DOC-REG-001",
    chunk_id: "CHK-REG-001",
    title: "National Cybercrime Reporting Portal Advisory on Employment Fraud",
    content: "Under Indian Cybercrime Advisories & Ministry of Labour Guidelines, legitimate companies NEVER charge candidates upfront registration, document verification, caution deposit, or training fees. Demanding payment before joining via UPI or bank transfer is a primary indicator of employment fraud. Report incidents to Cybercrime Helpline 1930.",
    source: "National Cybercrime Reporting Portal (cybercrime.gov.in)",
    source_type: "CYBERCRIME_ADVISORY",
    source_url: "https://cybercrime.gov.in",
    authority_level: "TIER_1_AUTHORITATIVE",
  },
  {
    document_id: "DOC-REG-002",
    chunk_id: "CHK-REG-002",
    title: "Ministry of Corporate Affairs (MCA21) Verification Protocol",
    content: "Companies incorporated in India carry a 21-digit Corporate Identification Number (CIN) or 7-digit LLP Identification Number (LLPIN). An active status in MCA21 confirms legal existence, but does not verify whether external recruiters communicating via free webmail (@gmail.com) are authorized agents.",
    source: "Ministry of Corporate Affairs, Government of India (mca.gov.in)",
    source_type: "GOVERNMENT_REGISTRY",
    source_url: "https://www.mca.gov.in",
    authority_level: "TIER_1_AUTHORITATIVE",
  },
  {
    document_id: "DOC-REG-003",
    chunk_id: "CHK-REG-003",
    title: "AICTE & UGC Guidelines on Student Internships",
    content: "AICTE strictly prohibits charging fees from students for academic or industry internships. Stipendiary or non-stipendiary internships must not mandate purchasing training kits, courses, or certificates as a prerequisite for commencement.",
    source: "All India Council for Technical Education (aicte-india.org)",
    source_type: "CYBERCRIME_ADVISORY",
    source_url: "https://www.aicte-india.org",
    authority_level: "TIER_1_AUTHORITATIVE",
  },
  // TIER 1: Corporate Enterprise Recruitment Policies
  {
    document_id: "DOC-CORP-TCS",
    chunk_id: "CHK-CORP-TCS",
    title: "Tata Consultancy Services (TCS) Official Careers Authentication Policy",
    content: "TCS does not charge any fee at any stage of the recruitment process. All official communications are sent exclusively from @tcs.com email domains. TCS does not use Gmail, Yahoo, WhatsApp, or Telegram for recruitment offers.",
    source: "Tata Consultancy Services Official Career Portal",
    source_type: "COMPANY_CAREERS",
    source_url: "https://www.tcs.com/careers",
    authority_level: "TIER_1_AUTHORITATIVE",
  },
  {
    document_id: "DOC-CORP-INFOSYS",
    chunk_id: "CHK-CORP-INFOSYS",
    title: "Infosys Official Recruitment Fraud Warning",
    content: "Infosys never asks for money or security deposits for internships or employment. Offer letters are verified through the official Infosys Launchpad portal and originate exclusively from @infosys.com.",
    source: "Infosys Official Career Portal",
    source_type: "COMPANY_CAREERS",
    source_url: "https://www.infosys.com/careers",
    authority_level: "TIER_1_AUTHORITATIVE",
  },
  {
    document_id: "DOC-CORP-INDIGO",
    chunk_id: "CHK-CORP-INDIGO",
    title: "IndiGo (InterGlobe Aviation Limited) Job Scam Advisory",
    content: "IndiGo does not solicit money for interviews, uniforms, medical checkups, or training. Official correspondence comes solely from @goindigo.in. Candidates should never transfer funds to individual bank accounts or UPI handles.",
    source: "IndiGo Official Career Advisories",
    source_type: "COMPANY_CAREERS",
    source_url: "https://www.goindigo.in/careers",
    authority_level: "TIER_1_AUTHORITATIVE",
  },
  // TIER 2: Threat Intelligence & Scam Patterns
  {
    document_id: "DOC-THR-001",
    chunk_id: "CHK-THR-001",
    title: "Task-Based & Fake Certificate Recruitment Scam Syndicate Pattern",
    content: "Fraudulent entities impersonate recognized IT brands or registered startups to offer remote internships. They issue authentic-looking appointment letters, assign trivial tasks (form-filling, social media follows), and subsequently demand payment for certificate generation, registration fees, or training portals.",
    source: "Cyber Intelligence Threat Feed",
    source_type: "SECURITY_DATABASE",
    authority_level: "TIER_2_HIGH_QUALITY",
  },
  {
    document_id: "DOC-THR-002",
    chunk_id: "CHK-THR-002",
    title: "Lookalike Corporate Domain Impersonation Tactics",
    content: "Adversaries register typo-squatted domains (e.g. company-careers.com, company-portal.in) with valid SSL certificates to send fake offer letters. Verification requires checking domain registration age on ICANN RDAP and matching MX records to official corporate nameservers.",
    source: "DNS & Domain Security Research",
    source_type: "SECURITY_DATABASE",
    authority_level: "TIER_2_HIGH_QUALITY",
  }
];

export function retrieveRAGKnowledge(query: {
  entityName?: string;
  domain?: string;
  email?: string;
  hasFeeDemand?: boolean;
  contextText?: string;
}): { chunks: RAGKnowledgeChunk[]; summary: string } {
  const qStr = `${query.entityName || ''} ${query.domain || ''} ${query.email || ''} ${query.contextText || ''}`.toLowerCase();
  const matched: (RAGKnowledgeChunk & { score: number })[] = [];

  for (const chunk of KNOWLEDGE_STORE) {
    let score = 0;
    const chunkText = `${chunk.title} ${chunk.content}`.toLowerCase();

    if (query.entityName && (chunkText.includes(query.entityName.toLowerCase()) || query.entityName.toLowerCase().includes(chunk.title.toLowerCase()))) {
      score += 50;
    }
    if (query.hasFeeDemand && (chunk.chunk_id.includes('REG-001') || chunk.chunk_id.includes('REG-003') || chunk.chunk_id.includes('THR-001'))) {
      score += 40;
    }
    if (query.email && (query.email.includes('gmail') || query.email.includes('yahoo')) && chunk.content.includes('@gmail')) {
      score += 30;
    }
    if (score > 0) {
      matched.push({ ...chunk, score, similarity_score: Math.min(0.99, (score + 20) / 100) });
    }
  }

  // If no specific company rule matched, include standard regulatory & anti-fraud baselines
  if (matched.length === 0) {
    matched.push(
      { ...KNOWLEDGE_STORE[0], score: 20, similarity_score: 0.85 },
      { ...KNOWLEDGE_STORE[1], score: 20, similarity_score: 0.80 },
      { ...KNOWLEDGE_STORE[6], score: 20, similarity_score: 0.75 }
    );
  }

  matched.sort((a, b) => b.score - a.score);
  const topChunks = matched.slice(0, 4);

  const summary = topChunks.map((c, i) => `[RAG-${i + 1}] (${c.authority_level}) ${c.title}: ${c.content}`).join('\n\n');

  return { chunks: topChunks, summary };
}
