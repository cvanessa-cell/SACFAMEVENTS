import type { SourceResearchCandidatePayload } from "@/lib/ai/schemas/sourceResearchSchema";

export const AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD = 0.5;

export const AUTO_APPROVE_NOTE =
  "Auto-approved: deterministic score above 0.5 — added to Event Sources (Prisma + Airtable).";

export const AUTO_APPROVE_EVENT_NOTE =
  "Auto-approved: confidence score above 0.5 — promoted to FamilyEvent (needs_review).";

/** Agent-marked sources that are publicly accessible (not login-only or private). */
const PUBLIC_VERIFICATION_STATUSES = new Set<
  SourceResearchCandidatePayload["verification_status"]
>(["verified", "likely_valid"]);

export function isPublicSourceCandidate(
  payload: Pick<SourceResearchCandidatePayload, "verification_status">,
): boolean {
  return PUBLIC_VERIFICATION_STATUSES.has(payload.verification_status);
}

export function shouldAutoApproveSourceCandidate(input: {
  deterministicScore: number;
  importStatus: string;
  duplicateOfSourceId: string | null;
}): boolean {
  if (input.duplicateOfSourceId) return false;
  if (
    input.importStatus === "rejected" ||
    input.importStatus === "duplicate" ||
    input.importStatus === "imported"
  ) {
    return false;
  }
  return input.deterministicScore > AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD;
}

export function shouldAutoApproveEventCandidate(input: {
  confidenceScore: number | null;
  reviewStatus: string;
}): boolean {
  if (
    input.reviewStatus === "approved" ||
    input.reviewStatus === "rejected" ||
    input.reviewStatus === "duplicate"
  ) {
    return false;
  }
  return (input.confidenceScore ?? 0) > AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD;
}
