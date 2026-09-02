// ==============================================================================
// LEGITIFY DOCUMENT CHUNKING SERVICE
// Splits documents into semantic chunks for forensic analysis
// DETERMINISTIC: same input always produces same chunks
// ==============================================================================
import crypto from 'crypto';
import { DocumentChunk, DocumentSection } from '../../types/forensicTypes';

export interface ChunkingOptions {
  targetCharSize?: number;   // Target chunk character size (default: 1000)
  overlapChars?: number;     // Overlap between chunks (default: 100)
  preserveSections?: boolean; // Try to preserve semantic sections (default: true)
}

const DEFAULT_OPTIONS: Required<ChunkingOptions> = {
  targetCharSize: 1000,
  overlapChars: 100,
  preserveSections: true,
};

/**
 * Section detection patterns
 * Order matters — more specific patterns should come first
 */
const SECTION_PATTERNS: { pattern: RegExp; section: DocumentSection }[] = [
  { pattern: /(?:dear\s+(?:candidate|applicant|sir|madam)|to\s+whomsoever)/i, section: 'LETTERHEAD' },
  { pattern: /(?:compensation|salary|ctc|cost\s+to\s+company|package|remuneration|stipend|emolument)/i, section: 'COMPENSATION' },
  { pattern: /(?:payment|fee|deposit|upi|bank\s+transfer|registration\s+fee|training\s+fee|security\s+deposit)/i, section: 'PAYMENT_TERMS' },
  { pattern: /(?:joining\s+date|date\s+of\s+joining|reporting\s+date|commencement|start\s+date)/i, section: 'JOINING_INFORMATION' },
  { pattern: /(?:terms\s+and\s+conditions|terms\s+of\s+employment|employment\s+conditions|confidentiality|nda|non.?disclosure)/i, section: 'EMPLOYMENT_TERMS' },
  { pattern: /(?:contact\s+us|for\s+queries|reach\s+us|helpdesk|hr\s+department|human\s+resources)/i, section: 'CONTACT_INFORMATION' },
  { pattern: /(?:authorized\s+signatory|hr\s+manager|sincerely|regards|yours\s+faithfully|signed\s+by)/i, section: 'SIGNATURE' },
  { pattern: /(?:wherefore|whereas|pursuant|notwithstanding|hereinafter|agreement\s+between)/i, section: 'LEGAL_CLAUSES' },
  { pattern: /(?:company\s+(?:name|profile|overview|about)|organization|employer)/i, section: 'ORGANIZATION_DETAILS' },
];

/**
 * Classify a text chunk into a semantic section.
 * Based on actual content — deterministic.
 */
export function classifySection(text: string): DocumentSection {
  const textLower = text.toLowerCase();
  
  for (const { pattern, section } of SECTION_PATTERNS) {
    if (pattern.test(textLower)) {
      return section;
    }
  }
  
  return 'BODY';
}

/**
 * Split text into semantic chunks.
 * DETERMINISTIC: same text always produces same chunks.
 */
export function chunkDocument(
  text: string,
  documentId: string,
  options: ChunkingOptions = {}
): DocumentChunk[] {
  const opts = { ...DEFAULT_OPTIONS, ...options };
  
  if (!text || text.trim().length === 0) {
    return [];
  }
  
  const chunks: DocumentChunk[] = [];
  let chunkIndex = 0;
  
  // Split by double newlines first (paragraphs)
  const paragraphs = text
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(p => p.length > 0);
  
  let currentChunkText = '';
  let currentPage = 1;
  
  for (const paragraph of paragraphs) {
    // Detect page boundaries (common in PDF extractions)
    const pageBreaks = (paragraph.match(/\[?page\s*\d+\]?/gi) || []).length;
    
    // Determine if we should start a new chunk
    const wouldExceedTarget = (currentChunkText + '\n\n' + paragraph).length > opts.targetCharSize;
    const isNewSection = opts.preserveSections && isNewSemanticSection(paragraph, currentChunkText);
    
    if (wouldExceedTarget || isNewSection) {
      if (currentChunkText.trim().length > 0) {
        chunks.push(buildChunk(
          currentChunkText,
          documentId,
          ++chunkIndex,
          currentPage
        ));
      }
      
      // Start new chunk with overlap from previous chunk end
      if (opts.overlapChars > 0 && currentChunkText.length > opts.overlapChars) {
        const overlapText = currentChunkText.slice(-opts.overlapChars);
        currentChunkText = overlapText + '\n\n' + paragraph;
      } else {
        currentChunkText = paragraph;
      }
    } else {
      currentChunkText = currentChunkText ? currentChunkText + '\n\n' + paragraph : paragraph;
    }
    
    currentPage += pageBreaks;
  }
  
  // Add final chunk
  if (currentChunkText.trim().length > 0) {
    chunks.push(buildChunk(
      currentChunkText,
      documentId,
      ++chunkIndex,
      currentPage
    ));
  }
  
  return chunks;
}

function isNewSemanticSection(newParagraph: string, currentText: string): boolean {
  if (!currentText) return false;
  
  const currentSection = classifySection(currentText);
  const newSection = classifySection(newParagraph);
  
  if (newSection === 'PAYMENT_TERMS' || currentSection === 'PAYMENT_TERMS') {
    return newSection !== currentSection;
  }
  
  if (newSection === 'SIGNATURE') return true;
  
  return false;
}

function buildChunk(
  text: string,
  documentId: string,
  index: number,
  page: number
): DocumentChunk {
  const hash = crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
  
  return {
    chunkId: `CHK-${String(index).padStart(3, '0')}`,
    documentId,
    pageStart: page,
    pageEnd: page,
    text,
    section: classifySection(text),
    charCount: text.length,
    hash,
    confidence: 0.85,
  };
}

/**
 * Extract forensic entities from a single chunk.
 * Returns findings specific to that chunk.
 */
export interface ChunkFindings {
  chunkId: string;
  entities: {
    emails: string[];
    phones: string[];
    urls: string[];
    upiIds: string[];
    domains: string[];
    amounts: string[];
    dates: string[];
    organizationNames: string[];
    cinNumbers: string[];
  };
  paymentSignals: {
    hasPaymentRequest: boolean;
    hasPaymentNegation: boolean;
    amounts: { value: string; currency: string; context: string }[];
    methods: string[];
    confidence: number;
  };
  urgencySignals: string[];
  suspiciousPatterns: string[];
}

const EMAIL_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g;
const PHONE_REGEX = /(?:\+91|0)?[6-9]\d{9}|\(\d{3}\)\s*\d{3}-\d{4}/g;
const URL_REGEX = /https?:\/\/[^\s<>"{}|\\^\[\]`]+/g;
const UPI_REGEX = /[a-zA-Z0-9._%+-]+@(?:paytm|phonepe|ybl|okhdfcbank|okaxis|okicici|oksbi|upi|apl|ibl|kotak)/gi;
const AMOUNT_REGEX = /(?:rs\.?|inr|₹|usd|\$)\s*[\d,]+(?:\.\d{1,2})?|[\d,]+(?:\.\d{1,2})?\s*(?:rs\.?|inr|₹)/gi;
const DATE_REGEX = /\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}|\d{1,2}\s+(?:jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+\d{4}/gi;
const CIN_REGEX = /[UL]\d{5}[A-Z]{2}\d{4}[A-Z]{3}\d{6}/gi;
const DOMAIN_REGEX = /\b(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+(?:com|in|org|net|gov|edu|co\.in|io|tech)\b/gi;

const PAYMENT_NEGATION_PATTERNS = [
  /no\s+(?:registration|application|processing|training|onboarding|security)\s+fee/i,
  /(?:never|do\s+not|will\s+not|shall\s+not)\s+(?:charge|collect|demand|request|ask\s+for)\s+(?:any\s+)?(?:[\w-]+\s+)?(?:fee|money|payment|deposit)/i,
  /free\s+of\s+(?:any\s+)?(?:charge|cost|fee)/i,
  /(?:no\s+)?(?:fee|payment)\s+(?:is\s+)?(?:not\s+required|is\s+not\s+required|not\s+applicable|is\s+waived|required\s+from)/i,
  /no\s+payment\s+is\s+required/i,
  /we\s+do\s+not\s+collect/i,
  /do\s+not\s+pay\s+anyone/i,
];

const PAYMENT_REQUEST_PATTERNS = [
  /(?:pay|transfer|deposit|remit|purchase|buy)\s+(?:(?:the|a|for|towards|worth)\s+)?(?:training\s+kit|laptop|uniform)?.*?(?:rs\.?|inr|₹)?\s*[\d,]+/i,
  /(?:registration|processing|training|onboarding|security|laptop|uniform|id\s+card|kit)\s+fee/i,
  /(?:training\s+kit|security\s+deposit|laptop\s+deposit)/i,
  /(?:fee|deposit|charge|payment)\s+(?:of|is|required|must\s+be|should\s+be)/i,
  /(?:upi|bank\s+transfer|neft|imps|rtgs)\s+(?:payment|transfer)/i,
];

export function analyzeChunk(chunk: DocumentChunk): ChunkFindings {
  const text = chunk.text;
  
  const emails = [...new Set(text.match(EMAIL_REGEX) || [])];
  const phones = [...new Set(text.match(PHONE_REGEX) || [])];
  const urls = [...new Set(text.match(URL_REGEX) || [])];
  const upiIds = [...new Set(text.match(UPI_REGEX) || [])];
  const domains = [...new Set(text.match(DOMAIN_REGEX) || [])].filter(
    d => !emails.some(e => e.includes(d))
  );
  const amounts = [...new Set(text.match(AMOUNT_REGEX) || [])];
  const dates = [...new Set(text.match(DATE_REGEX) || [])];
  const cinNumbers = [...new Set(text.match(CIN_REGEX) || [])];
  
  const hasPaymentNegation = PAYMENT_NEGATION_PATTERNS.some(p => p.test(text));
  const hasPaymentRequest = !hasPaymentNegation && PAYMENT_REQUEST_PATTERNS.some(p => p.test(text));
  
  const paymentAmounts = amounts.map(a => ({
    value: a.trim(),
    currency: a.includes('₹') || /rs\.?|inr/i.test(a) ? 'INR' : 'UNKNOWN',
    context: extractContext(text, a, 50),
  }));
  
  const paymentMethods: string[] = [];
  if (/upi/i.test(text)) paymentMethods.push('UPI');
  if (/bank\s+transfer|neft|imps|rtgs/i.test(text)) paymentMethods.push('BANK_TRANSFER');
  if (/crypto|bitcoin|usdt|eth/i.test(text)) paymentMethods.push('CRYPTO');
  if (/cash/i.test(text)) paymentMethods.push('CASH');
  
  const paymentConfidence = hasPaymentRequest
    ? Math.min(0.99, 0.5 + (paymentAmounts.length > 0 ? 0.3 : 0) + (paymentMethods.length > 0 ? 0.2 : 0))
    : 0;
  
  const urgencySignals: string[] = [];
  if (/urgent|immediately|within\s+24|within\s+48|before\s+\d/i.test(text)) urgencySignals.push('URGENCY_LANGUAGE');
  if (/limited\s+(?:seats|positions|slots|openings)/i.test(text)) urgencySignals.push('SCARCITY_CLAIM');
  if (/last\s+chance|final\s+notice|immediate\s+response/i.test(text)) urgencySignals.push('PRESSURE_LANGUAGE');
  
  const suspiciousPatterns: string[] = [];
  if (/whatsapp|telegram|instagram|facebook/i.test(text)) suspiciousPatterns.push('INFORMAL_CHANNEL_RECRUITMENT');
  if (upiIds.length > 0) suspiciousPatterns.push('UPI_ID_IN_OFFER');
  if (hasPaymentRequest && !hasPaymentNegation) suspiciousPatterns.push('PAYMENT_REQUEST_DETECTED');
  
  return {
    chunkId: chunk.chunkId,
    entities: {
      emails,
      phones,
      urls,
      upiIds,
      domains,
      amounts,
      dates,
      organizationNames: [],
      cinNumbers,
    },
    paymentSignals: {
      hasPaymentRequest,
      hasPaymentNegation,
      amounts: paymentAmounts,
      methods: paymentMethods,
      confidence: paymentConfidence,
    },
    urgencySignals,
    suspiciousPatterns,
  };
}

function extractContext(text: string, match: string, contextChars: number): string {
  const index = text.indexOf(match);
  if (index === -1) return '';
  const start = Math.max(0, index - contextChars);
  const end = Math.min(text.length, index + match.length + contextChars);
  return text.slice(start, end).trim();
}
