// ==============================================================================
// LEGITIFY COMPLETE EVIDENCE-FIRST SCAN PIPELINE
// Orchestrates Extraction -> Normalization -> MCA Registry -> Domain -> Recruiter -> Certificate -> Threats -> Community -> ML -> Scoring -> AI -> Report
// ==============================================================================
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
import { searchPublicExperiences, CommunitySearchResult } from './publicExperienceService';
import { predictJobOfferRisk, MLPrediction } from '../ml/fraudClassifier';
import { calculateDeterministicScore, calculateEvidenceCompleteness } from './scoringService';
import { buildEntityGraph } from './graphService';
import { getActiveAIProvider } from './aiProvider';
import { compileFullReport, persistReport } from './reportService';
import { runWebIntelligence } from './webIntelligenceService';
import { detectEvidenceConflicts, formatContradictionsForReport } from './conflictService';
import { normalizeCompanyName, normalizeDomain, extractEmailDomain } from '../utils/normalizer';



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

  // Step 1: Initialize Scan in Database (Non-blocking with safe fallback)
  let scanId = `SC-${Math.floor(1000 + Math.random() * 9000)}`;
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
    userAgent,
    metadata: { entityType, entityValue },
  });

  const evidence: EvidenceItem[] = [];

  // Step 2: Document Extraction & Text Signal Extraction
  // Always run document analysis: on file upload, pasted text, or entity value combined
  let docResult: DocumentExtractionResult | undefined;
  const combinedTextCorpus = [contextText, entityValue].filter(Boolean).join('\n').trim();

  if (fileBuffer && filename && mimeType) {
    // Uploaded PDF/image — extract via OCR/pdf-parse
    docResult = await processDocument(fileBuffer, filename, mimeType);
    // If file extraction got very little text, also analyze pasted text
    if ((docResult.extracted_text?.length || 0) < 30 && combinedTextCorpus.length > 10) {
      const pasted = await processDocument(Buffer.from(combinedTextCorpus, 'utf-8'), 'pasted_text.txt', 'text/plain');
      evidence.push(...pasted.evidence);
      // Merge the document extraction data
      docResult.has_fee_demand = docResult.has_fee_demand || pasted.has_fee_demand;
      (docResult as any).suspicious_patterns = [...(docResult.suspicious_patterns || []), ...(pasted.suspicious_patterns || [])];
    }
  } else {
    // Text-only scan — always analyze combined entity value + context text
    const textBuffer = Buffer.from(combinedTextCorpus || entityValue, 'utf-8');
    docResult = await processDocument(textBuffer, 'pasted_text.txt', 'text/plain');
  }
  evidence.push(...(docResult.evidence || []));

  const fullTextToAnalyze = [contextText, docResult?.extracted_text, entityValue].filter(Boolean).join('\n').trim();

  // Step 3: Entity Normalization & Routing
  let targetCompany = '';
  let targetDomain = '';
  let targetEmail = '';
  let targetCin = docResult?.detected_cin || '';

  if (entityType === 'company') {
    targetCompany = normalizeCompanyName(entityValue);
  } else if (entityType === 'domain' || entityType === 'website') {
    targetDomain = normalizeDomain(entityValue);
  } else if (entityType === 'recruiter') {
    targetEmail = entityValue.trim().toLowerCase();
    targetDomain = extractEmailDomain(targetEmail);
  } else {
    // Detect entities from job offer / text / OCR
    if (docResult?.detected_company_name) {
      targetCompany = normalizeCompanyName(docResult.detected_company_name);
    } else if (entityValue && !entityValue.includes('.') && entityValue.length >= 2 && !entityValue.toLowerCase().includes('offer letter')) {
      targetCompany = normalizeCompanyName(entityValue);
    }
    
    if (docResult?.detected_domain) {
      targetDomain = normalizeDomain(docResult.detected_domain);
    } else {
      const domainMatch = fullTextToAnalyze.match(/https?:\/\/([^\s/$.?#].[^\s]*)/i) || fullTextToAnalyze.match(/@([A-Za-z0-9.-]+\.[A-Za-z]{2,})/);
      if (domainMatch) targetDomain = normalizeDomain(domainMatch[1]);
    }

    if (docResult?.detected_email) {
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

  // Step 5: Concurrent Multi-Source Evidence Lookups (Registry + DNS + Threats + Community + Web Intelligence)
  const [compResult, mcaResult, domResult, threatResult, communityResult, webResult] = await Promise.all([
    targetCompany ? lookupCompany(targetCompany, targetDomain, targetCin).catch(() => null) : Promise.resolve(null),
    targetCompany ? verifyCompanyRegistry(targetCompany, targetCin).catch(() => null) : Promise.resolve(null),
    targetDomain ? analyzeDomain(targetDomain).catch(() => null) : Promise.resolve(null),
    checkThreatIndicators([targetCompany, targetDomain, targetEmail].filter(Boolean), entityType, fullTextToAnalyze).catch(() => null),
    searchPublicExperiences({ companyName: targetCompany, domain: targetDomain, recruiterEmail: targetEmail }).catch(() => null),
    runWebIntelligence({ companyName: targetCompany, domain: targetDomain, recruiterEmail: targetEmail, documentText: fullTextToAnalyze }).catch(() => null),
  ]);

  let companyData: CompanyData | undefined = compResult ? compResult.data : undefined;
  if (compResult) evidence.push(...compResult.evidence);

  if (mcaResult) {
    evidence.push(...mcaResult.evidence);
    if (companyData && mcaResult.status === 'VERIFIED_REGISTERED' && mcaResult.record) {
      companyData.legal_name = mcaResult.record.legal_name;
      companyData.registration_number = mcaResult.record.cin || mcaResult.record.llpin;
      companyData.registry_status = 'VERIFIED';
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

  // Step 8: Deterministic 8-Dimension Evidence Fusion & Conflict Engine
  const scoreResult = calculateDeterministicScore({
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

  // Step 9: Contradiction Engine & Cross-Validation
  const rawConflicts = detectEvidenceConflicts({
    companyData,
    domainData,
    recruiterData,
    certificateStatus: certificateData?.status,
    mlPrediction,
    threatData,
    hasFeeDemand: docResult?.has_fee_demand || false,
    communityNegativeCount: webResult?.community_complaint_clusters?.length || 0,
    communityPositiveCount: webResult?.reputable_reviews_found?.length || 0,
  });
  const contradictions = formatContradictionsForReport(rawConflicts);

  // Step 10: Dynamic Multi-Hop Entity Relationship Graph
  const entityGraph = buildEntityGraph({
    entityName: entityValue,
    entityType,
    companyData,
    domainData,
    recruiterData,
    documentData: docResult,
    certificateData,
    threatData,
  });

  // Step 11: Two-Stage AI Verification Reasoner
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
  });

  // Step 13: Persist to Supabase Database
  await persistReport(scanId, userId, finalReport, evidence, companyData);

  await logAuditEvent({
    user_id: userId,
    action: 'SCAN_COMPLETED',
    resource_type: 'scan',
    resource_id: scanId,
    ip,
    userAgent,
    metadata: {
      trustScore: finalReport.trust_score,
      verdict: finalReport.verdict,
      riskLevel: finalReport.risk_level,
    },
  });

  return finalReport;
}
