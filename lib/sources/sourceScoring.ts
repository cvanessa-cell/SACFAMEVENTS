/**
 * Deterministic source scoring.
 *
 * Supplements the OpenAI-provided relevance_score with a transparent,
 * reproducible weighting. Combined with public verification status for auto-approval.
 */

import type {
  SourceResearchCandidatePayload,
} from "@/lib/ai/schemas/sourceResearchSchema";

const SOURCE_TYPE_WEIGHT: Record<string, number> = {
  official: 1.0,
  education: 0.85,
  recreation: 0.85,
  venue: 0.8,
  nonprofit: 0.75,
  community: 0.7,
  media: 0.65,
  aggregator: 0.6,
  social: 0.45,
  other: 0.4,
};

const FRESHNESS_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.35,
};

const AUTOMATION_WEIGHT: Record<string, number> = {
  excellent: 1.0,
  good: 0.8,
  fair: 0.6,
  poor: 0.35,
  manual_only: 0.2,
};

const VERIFICATION_WEIGHT: Record<string, number> = {
  verified: 1.0,
  likely_valid: 0.7,
  needs_verification: 0.4,
};

const REVIEW_PRIORITY_WEIGHT: Record<string, number> = {
  high: 1.0,
  medium: 0.7,
  low: 0.4,
};

function bounded(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(1, Math.max(0, n));
}

function normalizeModelScore(n: number): number {
  if (Number.isNaN(n)) return 0;
  if (n > 1) return bounded(n / 10);
  return bounded(n);
}

export interface DeterministicScoreInput {
  source_type: SourceResearchCandidatePayload["source_type"];
  freshness_likelihood: SourceResearchCandidatePayload["freshness_likelihood"];
  automation_fit: SourceResearchCandidatePayload["automation_fit"];
  verification_status: SourceResearchCandidatePayload["verification_status"];
  review_priority: SourceResearchCandidatePayload["review_priority"];
  relevance_score: number;
}

/**
 * Returns a value in [0, 1]. The model relevance_score is blended in but
 * cannot dominate the structural signals.
 */
export function computeDeterministicSourceScore(input: DeterministicScoreInput): number {
  const t = SOURCE_TYPE_WEIGHT[input.source_type] ?? 0.5;
  const f = FRESHNESS_WEIGHT[input.freshness_likelihood] ?? 0.5;
  const a = AUTOMATION_WEIGHT[input.automation_fit] ?? 0.5;
  const v = VERIFICATION_WEIGHT[input.verification_status] ?? 0.5;
  const r = REVIEW_PRIORITY_WEIGHT[input.review_priority] ?? 0.5;
  const m = normalizeModelScore(input.relevance_score);
  // Weighted average: structural signals weigh 0.7, model relevance 0.3.
  const structural = t * 0.3 + f * 0.2 + a * 0.2 + v * 0.2 + r * 0.1;
  return bounded(structural * 0.7 + m * 0.3);
}
