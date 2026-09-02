// ==============================================================================
// LEGITIFY CLAIM LEDGER SERVICE
// Extracts, normalizes, and manages claims from document chunks
// DETERMINISTIC: same chunks produce same claims and IDs
// ==============================================================================

import { DocumentChunk, ForensicClaim, ClaimType } from '../../types/forensicTypes';
import { analyzeChunk } from './chunkingService';
import { normalizeCompanyName, normalizeDomain } from '../utils/normalizer';

export interface ClaimLedgerResult {
  claims: ForensicClaim[];
  normalizedEntities: {
    organizations: string[];
    emails: string[];
    domains: string[];
    phones: string[];
    cins: string[];
    upiIds: string[];
    paymentRequests: { amount: string; method: string; chunkId: string }[];
  };
}

/**
 * Builds the claim ledger from extracted document chunks.
 * Every claim traces back to a specific chunk (and page).
 */
export function buildClaimLedger(chunks: DocumentChunk[]): ClaimLedgerResult {
  const claims: ForensicClaim[] = [];
  let claimCounter = 0;

  const organizations = new Set<string>();
  const emails = new Set<string>();
  const domains = new Set<string>();
  const phones = new Set<string>();
  const cins = new Set<string>();
  const upiIds = new Set<string>();
  const paymentRequests: { amount: string; method: string; chunkId: string }[] = [];

  for (const chunk of chunks) {
    const findings = analyzeChunk(chunk);

    // 1. Organization claims (if section is LETTERHEAD or ORGANIZATION_DETAILS)
    if (chunk.section === 'LETTERHEAD' || chunk.section === 'ORGANIZATION_DETAILS') {
      const orgMatch = chunk.text.match(/(?:at|for|with|from)\s+([A-Z][A-Za-z0-9&., ]+(?:Limited|Ltd|Pvt|Private|Inc|Corporation|LLC|LLP))/);
      if (orgMatch) {
        const rawOrg = orgMatch[1].trim();
        const normOrg = normalizeCompanyName(rawOrg);
        organizations.add(normOrg);
        claimCounter++;
        claims.push({
          claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
          chunkId: chunk.chunkId,
          page: chunk.pageStart,
          type: 'ORGANIZATION',
          rawText: rawOrg,
          normalizedValue: normOrg,
          extractionConfidence: 0.90,
          verification: {
            status: 'UNVERIFIED',
            checks: [],
            evidenceIds: [],
          },
        });
      }
    }

    // 2. Email claims
    for (const email of findings.entities.emails) {
      emails.add(email.toLowerCase());
      claimCounter++;
      claims.push({
        claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
        chunkId: chunk.chunkId,
        page: chunk.pageStart,
        type: 'RECRUITER_EMAIL',
        rawText: email,
        normalizedValue: email.toLowerCase(),
        extractionConfidence: 0.98,
        verification: {
          status: 'UNVERIFIED',
          checks: [],
          evidenceIds: [],
        },
      });
    }

    // 3. Domain claims
    for (const domain of findings.entities.domains) {
      const normDom = normalizeDomain(domain);
      domains.add(normDom);
      claimCounter++;
      claims.push({
        claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
        chunkId: chunk.chunkId,
        page: chunk.pageStart,
        type: 'COMPANY_DOMAIN',
        rawText: domain,
        normalizedValue: normDom,
        extractionConfidence: 0.95,
        verification: {
          status: 'UNVERIFIED',
          checks: [],
          evidenceIds: [],
        },
      });
    }

    // 4. CIN claims
    for (const cin of findings.entities.cinNumbers) {
      cins.add(cin.toUpperCase());
      claimCounter++;
      claims.push({
        claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
        chunkId: chunk.chunkId,
        page: chunk.pageStart,
        type: 'CIN_NUMBER',
        rawText: cin,
        normalizedValue: cin.toUpperCase(),
        extractionConfidence: 0.99,
        verification: {
          status: 'UNVERIFIED',
          checks: [],
          evidenceIds: [],
        },
      });
    }

    // 5. Phone claims
    for (const phone of findings.entities.phones) {
      const cleanPhone = phone.replace(/[^0-9+]/g, '');
      phones.add(cleanPhone);
      claimCounter++;
      claims.push({
        claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
        chunkId: chunk.chunkId,
        page: chunk.pageStart,
        type: 'PHONE_NUMBER',
        rawText: phone,
        normalizedValue: cleanPhone,
        extractionConfidence: 0.92,
        verification: {
          status: 'UNVERIFIED',
          checks: [],
          evidenceIds: [],
        },
      });
    }

    // 6. Payment requests
    if (findings.paymentSignals.hasPaymentRequest && !findings.paymentSignals.hasPaymentNegation) {
      for (const amt of findings.paymentSignals.amounts) {
        paymentRequests.push({
          amount: amt.value,
          method: findings.paymentSignals.methods.join(', ') || 'UNSPECIFIED',
          chunkId: chunk.chunkId,
        });

        claimCounter++;
        claims.push({
          claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
          chunkId: chunk.chunkId,
          page: chunk.pageStart,
          type: 'PAYMENT_REQUEST',
          rawText: amt.context || amt.value,
          normalizedValue: amt.value,
          extractionConfidence: findings.paymentSignals.confidence,
          verification: {
            status: 'CONTRADICTED', // Payment requests contradict legitimate employment standards
            checks: [
              {
                name: 'Zero-Fee Recruitment Standard',
                status: 'FAIL',
                finding: `Monetary demand of ${amt.value} contradicts ILO and national fair recruitment standards`,
              }
            ],
            evidenceIds: [],
          },
        });
      }
    }

    // 7. UPI IDs
    for (const upi of findings.entities.upiIds) {
      upiIds.add(upi.toLowerCase());
      claimCounter++;
      claims.push({
        claimId: `CLM-${String(claimCounter).padStart(3, '0')}`,
        chunkId: chunk.chunkId,
        page: chunk.pageStart,
        type: 'UPI_ID',
        rawText: upi,
        normalizedValue: upi.toLowerCase(),
        extractionConfidence: 0.98,
        verification: {
          status: 'CONTRADICTED',
          checks: [
            {
              name: 'Corporate Payment Channel',
              status: 'FAIL',
              finding: 'Personal/direct UPI ID in employment document is an anomalous payment channel',
            }
          ],
          evidenceIds: [],
        },
      });
    }
  }

  return {
    claims,
    normalizedEntities: {
      organizations: Array.from(organizations),
      emails: Array.from(emails),
      domains: Array.from(domains),
      phones: Array.from(phones),
      cins: Array.from(cins),
      upiIds: Array.from(upiIds),
      paymentRequests,
    },
  };
}
