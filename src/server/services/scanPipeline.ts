// ==============================================================================
// LEGITIFY COMPLETE EVIDENCE-FIRST SCAN PIPELINE
// Orchestrates Extraction -> Chunking -> Claims -> Registry -> Domain ->
// Recruiter -> Certificate -> Threats -> Cybersecurity -> Community ->
// ML -> Gemini Independent Path -> Evidence Fusion -> Scoring -> AI -> Report
// ==============================================================================
import crypto from 'crypto';
import { LegitifyReport, ScanEntityType, EvidenceItem } from '../../types';
import { supabaseAdmin } from '../../lib/supabase/server';
import { logAuditEvent } from './auditService';
import { lookupCompany, CompanyData } from './companyService';
import { verifyCompanyRegistry } from './companyRegistryService';
import { analyzeDomain, DomainData } from './domainService';
import { analyzeRecruiterEmail, RecruiterData } from './emailService';
import { processDocument, DocumentExtractionResult } from './documentService';
import { checkThreatIndicators, ThreatData } from './threatService';
import { verifyCertificate } from './certificateService';
import { searchPublicExperiences, investigatePublicExperience, CommunitySearchResult } from './publicExperienceService';
import { predictJobOfferRisk, MLPrediction } from '../ml/fraudClassifier';
import { calculateDeterministicScore, calculateEvidenceCompleteness, DeterministicScoreResult } from './scoringService';
import { buildEntityGraph } from './entityGraphService';
import { evaluateFraudPatterns } from './fraudPatternService';
import { evaluateLegitimacyPatterns, isRecognizedStaffingPartner } from './legitimacyPatternService';
import { getActiveAIProvider } from './aiProvider';
import { compileFullReport, persistReport } from './reportService';
import { runWebIntelligence } from './webIntelligenceService';
import { detectEvidenceConflicts, formatContradictionsForReport } from './conflictService';
import { normalizeCompanyName, normalizeDomain, extractEmailDomain } from '../utils/normalizer';
import { retrieveRAGKnowledge } from './ragService';
import { chunkDocument } from './chunkingService';
import { buildClaimLedger } from './claimLedger';
import { runCybersecurityAnalysis } from './cybersecurityService';
import { runGeminiInvestigation } from './geminiInvestigator';
import { runEvidenceFusion } from './evidenceFusionEngine';

export interface ExecuteScanParams {
  userId: string;
  entityType: ScanEntityType;
  entityValue: string;
  contextText?: string;
  fileBuffer?: Buffer;
  filename?: string;
  mimeType?: string;
  ip?: string;
  userAgent?: string;
}

export async function runScanPipeline(params: ExecuteScanParams): Promise<LegitifyReport> {
  const scanStartTime = Date.now();
  const {
    userId,
    entityType,
    entityValue,
    contextText = '',
    fileBuffer,
    filename,
    mimeType,
    ip,
    userAgent,
  } = params;

  // Step 1: Initialize Scan in Database (Non-blocking with deterministic ID fallback)
  const fallbackHash = crypto.createHash('sha256').update(`${entityValue}:${scanStartTime}`).digest('hex').slice(0, 8);
  let scanId = `SC-${fallbackHash.toUpperCase()}`;
  try {
    const insertPromise = supabaseAdmin
      .from('scans')
      .insert({
        user_id: (userId && userId !== '00000000-0000-0000-0000-000000000000') ? userId : null,
        entity_type: entityType,
        entity_value: entityValue.trim(),
        status: 'EXTRACTING',
        started_at: new Date().toISOString(),
      })
      .select('id')
      .maybeSingle();

    const timeoutPromise = new Promise<any>((_, reject) =>
      setTimeout(() => reject(new Error('Supabase scan init timeout')), 1500)
    );

    const { data: scanRow } = await Promise.race([insertPromise, timeoutPromise]) as any;
    if (scanRow?.id) {
      scanId = scanRow.id;
    }
  } catch {
    // Fallback scanId already generated
  }

  await logAuditEvent({
    user_id: userId,
    action: 'SCAN_STARTED',
    resource_type: 'scan',
    resource_id: scanId,
    ip,
    user_agent: userAgent,
    metadata: { entityType, entityValue },
  });

  const evidence: EvidenceItem[] = [];

  // Step 2: Document Extraction & Text Signal Extraction
  let docResult: DocumentExtractionResult | undefined;
  const combinedTextCorpus = [contextText, entityValue].filter(Boolean).join('\n').trim();

  if (fileBuffer && filename && mimeType) {
    docResult = await processDocument(fileBuffer, filename, mimeType);
    if ((docResult.extracted_text?.length || 0) < 30 && combinedTextCorpus.length > 10) {
      const pasted = await processDocument(Buffer.from(combinedTextCorpus, 'utf-8'), 'pasted_text.txt', 'text/plain');
      evidence.push(...pasted.evidence);
      docResult.has_fee_demand = docResult.has_fee_demand || pasted.has_fee_demand;
      (docResult as any).suspicious_patterns = [...(docResult.suspicious_patterns || []), ...(pasted.suspicious_patterns || [])];
    }
  } else {
    const textBuffer = Buffer.from(combinedTextCorpus || entityValue, 'utf-8');
    docResult = await processDocument(textBuffer, 'pasted_text.txt', 'text/plain');
  }
  evidence.push(...(docResult.evidence || []));

  const fullTextToAnalyze = [contextText, docResult?.extracted_text, entityValue].filter(Boolean).join('\n').trim();

  // Step 2.5: Semantic Document Chunking & Structured Claim Ledger
  const chunks = chunkDocument(fullTextToAnalyze, scanId);
  const claimLedger = buildClaimLedger(chunks);

  // Step 3: Entity Normalization & Routing
  let targetCompany = '';
  let targetDomain = '';
  let targetEmail = '';
  let targetCin = docResult?.detected_cin || claimLedger.normalizedEntities.cins[0] || '';

  if (entityType === 'company') {
    targetCompany = normalizeCompanyName(entityValue);
  } else if (entityType === 'domain' || entityType === 'website') {
    targetDomain = normalizeDomain(entityValue);
  } else if (entityType === 'recruiter') {
    targetEmail = entityValue.trim().toLowerCase();
    targetDomain = extractEmailDomain(targetEmail);
  } else {
    // Detect entities from document / claims / OCR
    if (claimLedger.normalizedEntities.organizations.length > 0) {
      targetCompany = claimLedger.normalizedEntities.organizations[0];
    } else if (docResult?.detected_company_name) {
      targetCompany = normalizeCompanyName(docResult.detected_company_name);
    } else if (entityValue && !entityValue.includes('.') && entityValue.length >= 2 && !entityValue.toLowerCase().includes('offer letter')) {
      targetCompany = normalizeCompanyName(entityValue);
    }

    if (claimLedger.normalizedEntities.domains.length > 0) {
      targetDomain = claimLedger.normalizedEntities.domains[0];
    } else if (docResult?.detected_domain) {
      targetDomain = normalizeDomain(docResult.detected_domain);
    } else {
      const domainMatch = fullTextToAnalyze.match(/https?:\/\/([^\s/$.?#].[^\s]*)/i) || fullTextToAnalyze.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
      if (domainMatch) targetDomain = normalizeDomain(domainMatch[1]);
    }

    if (claimLedger.normalizedEntities.emails.length > 0) {
      targetEmail = claimLedger.normalizedEntities.emails[0];
    } else if (docResult?.detected_email) {
      targetEmail = docResult.detected_email.toLowerCase();
    } else {
      const emailMatch = fullTextToAnalyze.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
      if (emailMatch) targetEmail = emailMatch[1].toLowerCase();
    }
  }

  // Step 4: Certificate Verification (if certificate entity or certificate text detected)
  let certificateData = undefined;
  if (entityType === 'certificate' || /certificate|credential|issued\s*by|completion/i.test(fullTextToAnalyze)) {
    certificateData = await verifyCertificate(fullTextToAnalyze, undefined, targetCompany, undefined);
    evidence.push(...certificateData.evidence);
  }

  // Step 4.5: Cybersecurity Analysis Engine (DNS, SPF, DMARC, MX, Lookalike, IOC, UPI)
  const cyberResult = await runCybersecurityAnalysis({
    emails: [targetEmail, ...claimLedger.normalizedEntities.emails].filter(Boolean),
    domains: [targetDomain, ...claimLedger.normalizedEntities.domains].filter(Boolean),
    urls: fullTextToAnalyze.match(/https?:\/\/[^\s<>"{}|\\^\[\]`]+/g) || [],
    upiIds: claimLedger.normalizedEntities.upiIds,
    documentText: fullTextToAnalyze,
  }).catch(() => null);

  if (cyberResult && cyberResult.evidence.length > 0) {
    evidence.push(...cyberResult.evidence);
  }

  // Step 5: Concurrent Multi-Source Evidence Lookups
  const [compResult, mcaResult, domResult, threatResult, communityResult, webResult, publicExpResult] = await Promise.all([
    targetCompany ? lookupCompany(targetCompany, targetDomain, targetCin).catch(() => null) : Promise.resolve(null),
    targetCompany ? verifyCompanyRegistry(targetCompany, targetCin).catch(() => null) : Promise.resolve(null),
    targetDomain ? analyzeDomain(targetDomain).catch(() => null) : Promise.resolve(null),
    checkThreatIndicators([targetCompany, targetDomain, targetEmail].filter(Boolean), entityType, fullTextToAnalyze).catch(() => null),
    searchPublicExperiences({ companyName: targetCompany, domain: targetDomain, recruiterEmail: targetEmail }).catch(() => null),
    runWebIntelligence({ companyName: targetCompany, domain: targetDomain, recruiterEmail: targetEmail, documentText: fullTextToAnalyze }).catch(() => null),
    investigatePublicExperience({
      companyName: targetCompany,
      domain: targetDomain,
      recruiterEmail: targetEmail,
      phone: claimLedger.normalizedEntities.phones[0],
      upiId: claimLedger.normalizedEntities.upiIds[0],
      role: (claimLedger.normalizedEntities as any).jobRoles?.[0],
    }).catch(() => null),
  ]);

  let companyData: CompanyData | undefined = compResult ? compResult.data : undefined;
  if (compResult) evidence.push(...compResult.evidence);

  if (mcaResult) {
    evidence.push(...mcaResult.evidence);
    if (companyData && mcaResult.status === 'LOCAL_REFERENCE_FOUND' && mcaResult.record) {
      companyData.legal_name = mcaResult.record.legal_name;
      companyData.registration_number = mcaResult.record.cin || mcaResult.record.llpin;
      companyData.registry_status = 'LOCAL_REFERENCE_FOUND' as any;
      companyData.status = mcaResult.record.status;
    }
  }

  const domainData: DomainData | undefined = domResult ? domResult.data : undefined;
  if (domResult) evidence.push(...domResult.evidence);

  const recResult = targetEmail ? analyzeRecruiterEmail(targetEmail, companyData?.domain || targetDomain, targetCompany) : null;
  const recruiterData: RecruiterData | undefined = recResult ? recResult.data : undefined;
  if (recResult) evidence.push(...recResult.evidence);

  const threatData: ThreatData | undefined = threatResult ? threatResult.data : undefined;
  if (threatResult) evidence.push(...threatResult.evidence);

  const communityData: CommunitySearchResult | undefined = communityResult || undefined;
  if (communityResult) evidence.push(...communityResult.evidence);

  if (webResult && webResult.evidence) {
    evidence.push(...webResult.evidence);
  }

  // Step 5.5: RAG Dynamic Knowledge Retrieval
  const ragResult = retrieveRAGKnowledge({
    entityName: companyData?.legal_name || entityValue,
    domain: domainData?.domain || targetDomain,
    email: targetEmail,
    hasFeeDemand: docResult?.has_fee_demand || claimLedger.normalizedEntities.paymentRequests.length > 0,
    contextText: fullTextToAnalyze,
  });

  // Step 5.6: Gemini Independent Investigation (Path B — separate, independent analysis)
  const geminiResult = await runGeminiInvestigation({
    documentText: fullTextToAnalyze,
    extractedEntities: {
      companyName: targetCompany || undefined,
      recruiterEmail: targetEmail || undefined,
      domain: targetDomain || undefined,
      phone: claimLedger.normalizedEntities.phones[0] || undefined,
      cinNumber: targetCin || undefined,
      paymentRequested: docResult?.has_fee_demand || claimLedger.normalizedEntities.paymentRequests.length > 0,
      paymentAmount: claimLedger.normalizedEntities.paymentRequests[0]?.amount,
    },
  }).catch(() => undefined);

  // Update extracted claims with evidence provenance
  const claims = (docResult as any)?.extracted_claims || [];
  for (const clm of claims) {
    if (clm.claim_type === 'ORGANIZATION') {
      if (mcaResult && mcaResult.status === 'LOCAL_REFERENCE_FOUND' && mcaResult.record) {
        clm.verification_status = 'VERIFIED';
        clm.retrieved_reality = `Local Reference Index: ${mcaResult.record.legal_name} (CIN: ${mcaResult.record.cin || 'Referenced'})`;
        clm.explanation = 'Organization matches entry in local corporate reference dataset. (Live MCA21 not queried).';
        clm.evidence_source = '[E-001] Local Corporate Reference Dataset';
        clm.evidence_ids = ['E-001'];
      } else {
        clm.verification_status = 'UNVERIFIED';
        clm.retrieved_reality = 'No match in local reference dataset for this entity string';
        clm.explanation = 'Organization not found in local index. (Absence does not imply fraud; live MCA21 query unavailable).';
        clm.evidence_source = '[E-001] Local Reference Index';
        clm.evidence_ids = ['E-001'];
      }
    } else if (clm.claim_type === 'CONTACT_EMAIL') {
      if (recruiterData) {
        if (recruiterData.free_email_provider || recruiterData.domain_alignment === 'FREE_EMAIL') {
          clm.verification_status = 'SUSPICIOUS';
          clm.retrieved_reality = `Public Webmail Provider (${targetEmail}) conflicting with enterprise corporate domain`;
          clm.explanation = 'Legitimate enterprise recruiters communicate via corporate domain addresses, not free public webmail.';
          clm.evidence_source = '[E-003] Recruiter Authentication Engine';
          clm.evidence_ids = ['E-003'];
        } else if (recruiterData.domain_alignment === 'EXACT_MATCH' || recruiterData.domain_alignment === 'MATCH') {
          clm.verification_status = 'VERIFIED';
          clm.retrieved_reality = 'Sender address matches verified corporate domain';
          clm.explanation = 'Recruiter email domain aligns with claimed corporate domain. (Note: Domain alignment does not independently verify authorization).';
          clm.evidence_source = '[E-003] Recruiter Authentication Engine';
          clm.evidence_ids = ['E-003'];
        } else {
          clm.verification_status = 'UNVERIFIED';
          clm.retrieved_reality = `Sender domain '${domainData?.domain || targetDomain}' unverified against official company domain`;
          clm.explanation = 'Recruiter email domain could not be independently linked to the claimed corporate entity.';
          clm.evidence_source = '[E-003] Recruiter Authentication Engine';
          clm.evidence_ids = ['E-003'];
        }
      }
    } else if (clm.claim_type === 'PAYMENT_REQUIREMENT') {
      clm.evidence_source = '[E-004] Offer Document Forensics';
      clm.evidence_ids = ['E-004'];
    }
  }

  // False-Positive Counter-Evidence Search
  const falsePositiveCheck: import('../../types').FalsePositiveCheckResult = {
    is_checked: true,
    legitimate_counter_evidence: [],
    suspicious_evidence: [],
    unresolved_ambiguities: [],
    recommendation: "",
  };

  if (companyData && ((companyData.registry_status as string) === 'ACTIVE' || (companyData.registry_status as string) === 'LOCAL_REFERENCE_FOUND')) {
    falsePositiveCheck.legitimate_counter_evidence.push({
      title: "Company Record in Reference Index",
      source: "Local Corporate Reference Index",
      finding: `Entity '${companyData.legal_name}' is documented in corporate reference dataset.`,
      authority: "TIER_2_HIGH_QUALITY",
    });
  }

  if (domainData && domainData.ssl_valid && (domainData.age_days || 0) > 365) {
    falsePositiveCheck.legitimate_counter_evidence.push({
      title: "Established Domain Age & Valid TLS",
      source: "ICANN RDAP",
      finding: `Domain '${domainData.domain}' has been active for ${domainData.age_days} days.`,
      authority: "TIER_2_HIGH_QUALITY",
    });
  }

  const hasPaymentDemand = docResult?.has_fee_demand || claimLedger.normalizedEntities.paymentRequests.length > 0;
  if (hasPaymentDemand) {
    falsePositiveCheck.suspicious_evidence.push({
      title: "Upfront Monetary Charge Detected",
      source: "Uploaded Document",
      finding: "Candidate payment required prior to onboarding.",
    });
    falsePositiveCheck.recommendation = "Upfront monetary demand violates anti-fraud employment standards; risk remains elevated despite organization existence.";
  } else {
    falsePositiveCheck.recommendation = "No direct monetary charges identified in document.";
  }

  // Step 6: Supervised Kaggle ML Risk Prediction (Offline & Real)
  const mlPrediction: MLPrediction = predictJobOfferRisk({
    text: fullTextToAnalyze || entityValue,
    hasCompanyProfile: !!companyData?.legal_name,
    hasCompanyLogo: !domainData?.lookalike_detected,
    telecommuting: fullTextToAnalyze.toLowerCase().includes('remote') || fullTextToAnalyze.toLowerCase().includes('work from home'),
  });

  // Step 7: Evidence Completeness Metric
  const completeness = calculateEvidenceCompleteness({
    companyData,
    domainData,
    recruiterData,
    documentData: docResult,
    certificateData,
    threatData,
    mlPrediction,
    communityData,
    evidence,
  });

  // Step 8: Deterministic 10-Dimension Score (LEGITIFY Path A)
  const legitifyScore = calculateDeterministicScore({
    companyData,
    domainData,
    recruiterData,
    documentData: docResult,
    certificateData,
    threatData,
    mlPrediction,
    communityData,
    evidence,
  });

  // Step 8.4: Multi-Hop Entity Relationship Graph & Anomaly Detection
  const entityGraph = buildEntityGraph({
    companyName: targetCompany,
    officialDomain: companyData?.domain,
    recruiterEmail: targetEmail,
    recruiterName: (docResult as any)?.detected_recruiter_name,
    domain: targetDomain,
    claims: claimLedger.claims,
    chunks: chunks,
    stipend: claimLedger.claims.find(c => c.type === 'STIPEND')?.normalizedValue,
    salary: claimLedger.claims.find(c => c.type === 'SALARY')?.normalizedValue,
    hasPaymentRequest: hasPaymentDemand,
    paymentAmount: claimLedger.normalizedEntities.paymentRequests[0]?.amount,
    upiId: claimLedger.normalizedEntities.upiIds[0],
    signatoryName: (docResult as any)?.detected_signatory_name,
  });

  // Step 8.45: Multi-Signal Fraud Pattern & Legitimate Pattern Analysis
  const isLookalike = Boolean(
    domainData?.lookalike_detected ||
    cyberResult?.lookalikeDomains.some(l => l.classification === 'HIGH_CONFIDENCE_LOOKALIKE')
  );
  const isMaliciousIOC = Boolean(
    threatData?.known_threat ||
    (cyberResult && cyberResult.highRiskIOCCount > 0)
  );

  const fraudPatterns = evaluateFraudPatterns({
    hasPaymentDemand,
    paymentAmount: claimLedger.normalizedEntities.paymentRequests[0]?.amount,
    isInternship: fullTextToAnalyze.toLowerCase().includes('intern'),
    isEmploymentPromise: fullTextToAnalyze.toLowerCase().includes('offer') || fullTextToAnalyze.toLowerCase().includes('employment'),
    isRegisteredCompanyClaimed: Boolean(mcaResult?.record || companyData?.legal_name),
    isLookalikeDomain: isLookalike,
    isFreeWebmail: Boolean(targetEmail && (targetEmail.endsWith('@gmail.com') || targetEmail.endsWith('@yahoo.com') || targetEmail.endsWith('@outlook.com') || targetEmail.endsWith('@hotmail.com'))),
    isRecruiterUnverified: recruiterData ? (recruiterData.domain_alignment !== 'EXACT_MATCH' && recruiterData.domain_alignment !== 'SUBSIDIARY_MATCH') : true,
    hasTrainingFee: /training\s+fee|processing\s+fee/i.test(fullTextToAnalyze),
    hasUrgentDeadline: /urgent|within\s+24|immediate/i.test(fullTextToAnalyze),
    requestsSensitiveCredentials: /bank\s+pin|password|otp/i.test(fullTextToAnalyze),
    suspiciousUrlPresent: false,
    offPlatformMigration: /telegram|whatsapp|wa\.me|t\.me/i.test(fullTextToAnalyze),
    evidenceList: evidence,
  });

  const { patterns: legitimatePatterns, counterEvidence } = evaluateLegitimacyPatterns({
    isCorporateDomainAligned: recruiterData ? (recruiterData.domain_alignment === 'EXACT_MATCH' || recruiterData.domain_alignment === 'SUBSIDIARY_MATCH') : false,
    hasValidMx: Boolean(domainData?.mx_records && domainData.mx_records.length > 0),
    hasCareersPageMatch: Boolean(webResult?.official_sources_matched && webResult.official_sources_matched.length > 0),
    hasZeroFeeCompliance: !hasPaymentDemand,
    isStatutoryRegistered: Boolean(mcaResult?.record),
    cinNumber: targetCin,
    hasInternalCoherence: entityGraph.coherenceScore >= 70,
    isRecognizedStaffingAgency: isRecognizedStaffingPartner(`${targetCompany || ''} ${targetEmail || ''}`),
    isYoungStartup: domainData?.age_days !== undefined && domainData.age_days < 365,
    evidenceList: evidence,
    companyName: targetCompany,
    domain: targetDomain,
    recruiterEmail: targetEmail,
  });

  // Step 8.5: Evidence Fusion Engine (Merges Path A + Path B + Patterns + Public Intelligence)
  const fusionResult = runEvidenceFusion({
    legitifyResult: legitifyScore,
    legitifyEvidence: evidence,
    geminiResult,
    hasFeeDemand: hasPaymentDemand,
    hasLookalikeDomain: isLookalike,
    hasKnownThreat: isMaliciousIOC,
    companyName: targetCompany,
    domain: targetDomain,
    recruiterEmail: targetEmail,
    publicExperience: publicExpResult || undefined,
    entityGraph: entityGraph as any,
    fraudPatterns,
    legitimatePatterns,
    counterEvidence,
    isYoungStartup: domainData?.age_days !== undefined && domainData.age_days < 365,
  });

  // Final fused score result
  const scoreResult: DeterministicScoreResult = {
    ...legitifyScore,
    trust_score: fusionResult.finalTrustScore,
    confidence_score: fusionResult.finalEvidenceConfidence,
    risk_level: (fusionResult.finalRiskLevel === 'INSUFFICIENT EVIDENCE' ? 'MODERATE' : fusionResult.finalRiskLevel) as any,
    verdict: (fusionResult.finalVerdict === 'INSUFFICIENT EVIDENCE / REVIEW' ? 'INSUFFICIENT_EVIDENCE' : fusionResult.finalVerdict) as any,
    hard_caps_applied: [
      ...legitifyScore.hard_caps_applied,
      ...fusionResult.hardRulesTriggered.map(r => `${r.name}: ${r.effect}`),
    ],
  };

  // Step 9: Contradiction Engine & Cross-Validation
  const rawConflicts = detectEvidenceConflicts({
    companyData,
    domainData,
    recruiterData,
    certificateStatus: certificateData?.status,
    mlPrediction,
    threatData,
    hasFeeDemand: hasPaymentDemand,
    communityNegativeCount: webResult?.community_complaint_clusters?.length || 0,
    communityPositiveCount: webResult?.reputable_reviews_found?.length || 0,
  });
  const contradictions = formatContradictionsForReport(rawConflicts);

  // Step 11: Two-Stage AI Verification Reasoner (Summarizes evidence, does not override score)
  const aiProvider = await getActiveAIProvider();
  const aiSynthesis = await aiProvider.generateSynthesis({
    entityName: entityValue,
    entityType,
    trustScore: scoreResult.trust_score,
    confidence: scoreResult.confidence_score,
    riskLevel: scoreResult.risk_level,
    verdict: scoreResult.verdict,
    evidence,
    rulesTriggered: scoreResult.rules_triggered,
    mlEvaluation: mlPrediction as any,
    untrustedUserText: fullTextToAnalyze,
  });

  const processingTimeMs = Date.now() - scanStartTime;

  // Step 12: Compile Full 22-Section Structured Report
  const finalReport = compileFullReport({
    scanId,
    entityName: entityValue,
    entityType,
    scoreResult,
    completeness,
    mlPrediction: mlPrediction as any,
    entityGraph,
    aiSynthesis,
    companyData,
    domainData,
    recruiterData,
    documentData: docResult,
    certificateData,
    threatData,
    webIntelligence: webResult || undefined,
    contradictions,
    evidence,
    processingTimeMs,
    publicExperience: publicExpResult || undefined,
    fraudPatterns,
    legitimatePatterns,
    counterEvidence,
    fraudConfidence: fusionResult.fraudConfidence,
    explanationSummary: fusionResult.explanationSummary,
  });

  // Step 13: Persist to Supabase Database
  await persistReport(scanId, userId, finalReport, evidence, companyData);

  await logAuditEvent({
    user_id: userId,
    action: 'SCAN_COMPLETED',
    resource_type: 'scan',
    resource_id: scanId,
    ip,
    user_agent: userAgent,
    metadata: {
      trustScore: finalReport.trust_score,
      verdict: finalReport.verdict,
      riskLevel: finalReport.risk_level,
    },
  });

  return finalReport;
}
