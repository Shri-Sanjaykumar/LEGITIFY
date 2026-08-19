// ==============================================================================
// PUBLIC COMMUNITY EXPERIENCES SEARCH SERVICE
// Gathers, clusters, deduplicates, and evaluates community reports
// ==============================================================================
import { EvidenceItem } from '../../types';
import { RedditProvider, PublicExperienceItem, ExperienceCategory } from './redditProvider';
import { supabaseAdmin } from '../../lib/supabase/server';

export interface CommunitySearchResult {
  query: string;
  results: PublicExperienceItem[];
  totalRelevantResults: number;
  uniqueExperienceClusters: number;
  riskSignals: string[];
  positiveSignals: string[];
  mixedSignals: string[];
  communityConfidence: number;
  evidence: EvidenceItem[];
  summary: string;
  disclaimer: string;
}

const redditProvider = new RedditProvider();

export async function searchPublicExperiences(params: {
  companyName?: string;
  domain?: string;
  recruiterEmail?: string;
}): Promise<CommunitySearchResult> {
  const { companyName = '', domain = '', recruiterEmail = '' } = params;
  const query = [companyName, domain, recruiterEmail].filter(Boolean).join(' ');

  // 1. Fetch from Reddit / Public Discussion Provider
  const { experiences } = await redditProvider.searchExperiences({
    companyName,
    domain,
    recruiterEmail,
  });

  const riskSignals: string[] = [];
  const positiveSignals: string[] = [];
  const mixedSignals: string[] = [];
  const evidence: EvidenceItem[] = [];

  // 2. Deduplication & Unique Experience Cluster Identification
  const clusterMap = new Map<string, PublicExperienceItem[]>();
  for (const exp of experiences) {
    const existing = clusterMap.get(exp.experience_cluster_id) || [];
    existing.push(exp);
    clusterMap.set(exp.experience_cluster_id, existing);
  }

  const uniqueClusters = clusterMap.size;

  let negativeCount = 0;
  let positiveCount = 0;

  for (const exp of experiences) {
    const isNegative = [
      "PAYMENT_REQUEST", "NO_STIPEND", "FAKE_OFFER", "FAKE_CERTIFICATE",
      "DOMAIN_IMPERSONATION", "NON_PAYMENT", "TRAINING_FEE", "DEPOSIT_REQUEST"
    ].includes(exp.category);

    const isPositive = ["GOOD_EXPERIENCE", "REAL_INTERNSHIP"].includes(exp.category);

    if (isNegative) {
      negativeCount++;
      riskSignals.push(`Public report (${exp.source}): ${exp.category.replace(/_/g, ' ')} mentioned in '${exp.title}'`);
    } else if (isPositive) {
      positiveCount++;
      positiveSignals.push(`Public report (${exp.source}): Verified candidate experience reported for ${companyName || 'the opportunity'}`);
    } else {
      mixedSignals.push(`Public discussion (${exp.source}): ${exp.title}`);
    }

    evidence.push({
      category: "PUBLIC_REPORT",
      evidence_type_category: isNegative ? "WEAK_INDICATOR" : "STRONG_INDICATOR",
      evidence_type: `COMMUNITY_${exp.category}`,
      source_name: exp.source,
      source_url: exp.source_url,
      title: exp.title,
      snippet: exp.summary.substring(0, 140) + '...',
      evidence_text: `Public community user report (${exp.author || 'Anonymous'}): "${exp.summary}". Note: Community reports are unverified user experiences and should not be treated as independent proof of fraud.`,
      evidence_strength: exp.source_reliability > 0.90 ? "STRONG" : "MEDIUM",
      status: isNegative ? "NEGATIVE" : "VERIFIED",
      severity: isNegative ? "HIGH" : "INFO",
      verified: false,
      confidence: Math.round(exp.source_reliability * 100),
    });
  }

  // 3. Compute Community Corroboration & Confidence
  let communityConfidence = 0.50;
  if (uniqueClusters >= 3 && negativeCount >= 3) {
    communityConfidence = 0.85; // High corroboration across independent clusters
  } else if (uniqueClusters >= 1 && negativeCount === 1) {
    communityConfidence = 0.45; // Single isolated post = low confidence
  } else if (positiveCount > 0 && negativeCount === 0) {
    communityConfidence = 0.90;
  }

  let summary = "";
  if (negativeCount > 0 && uniqueClusters >= 3) {
    summary = `Identified ${experiences.length} relevant public user discussions across ${uniqueClusters} independent discussion clusters detailing upfront fees or unfulfilled stipends.`;
  } else if (negativeCount === 1) {
    summary = "Single unverified public community post found. Isolated reports carry low reliability and are not treated as proof of fraud.";
  } else if (positiveCount > 0) {
    summary = `Identified ${positiveCount} positive public user experiences confirming legitimate corporate internship programs.`;
  } else {
    summary = "No corroborated public community complaints or fraudulent experience clusters detected.";
  }

  const disclaimer = "Community reports are unverified user experiences and should not be treated as independent proof of fraud.";

  return {
    query,
    results: experiences,
    totalRelevantResults: experiences.length,
    uniqueExperienceClusters: uniqueClusters,
    riskSignals,
    positiveSignals,
    mixedSignals,
    communityConfidence,
    evidence,
    summary,
    disclaimer,
  };
}
