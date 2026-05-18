import { describe, expect, it } from "vitest";

import {
  AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD,
  isPublicSourceCandidate,
  shouldAutoApproveEventCandidate,
  shouldAutoApproveSourceCandidate,
} from "@/lib/sources/sourceAutoApproval";
import type { SourceResearchCandidatePayload } from "@/lib/ai/schemas/sourceResearchSchema";

function basePayload(
  overrides: Partial<SourceResearchCandidatePayload> = {},
): SourceResearchCandidatePayload {
  return {
    source_name: "Sacramento Public Library",
    source_url: "https://saclibrary.org/events",
    source_category: "Public Libraries",
    source_type: "official",
    city_or_area_served: "Sacramento",
    county_or_region: "Sacramento County",
    event_types: ["storytime"],
    family_relevance: "high",
    why_useful_for_sacfam_events: "county-wide kids programs",
    estimated_update_frequency: "weekly",
    freshness_likelihood: "high",
    automation_fit: "excellent",
    recommended_ingestion_method: "official_calendar_monitoring",
    review_priority: "high",
    relevance_score: 9,
    verification_status: "verified",
    status: "proposed",
    notes: null,
    ...overrides,
  };
}

describe("sourceAutoApproval", () => {
  it("treats verified and likely_valid as public", () => {
    expect(isPublicSourceCandidate({ verification_status: "verified" })).toBe(true);
    expect(isPublicSourceCandidate({ verification_status: "likely_valid" })).toBe(true);
    expect(isPublicSourceCandidate({ verification_status: "needs_verification" })).toBe(
      false,
    );
  });

  it("auto-approves candidates above the score threshold", () => {
    expect(
      shouldAutoApproveSourceCandidate({
        deterministicScore: AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD + 0.01,
        importStatus: "needs_verification",
        duplicateOfSourceId: null,
      }),
    ).toBe(true);
    expect(
      shouldAutoApproveSourceCandidate({
        deterministicScore: 0.9,
        importStatus: "pending_review",
        duplicateOfSourceId: null,
      }),
    ).toBe(true);
  });

  it("skips rejected, duplicate, imported, and at-or-below-threshold candidates", () => {
    expect(
      shouldAutoApproveSourceCandidate({
        deterministicScore: AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD,
        importStatus: "needs_verification",
        duplicateOfSourceId: null,
      }),
    ).toBe(false);

    expect(
      shouldAutoApproveSourceCandidate({
        deterministicScore: 0.9,
        importStatus: "rejected",
        duplicateOfSourceId: null,
      }),
    ).toBe(false);

    expect(
      shouldAutoApproveSourceCandidate({
        deterministicScore: 0.9,
        importStatus: "imported",
        duplicateOfSourceId: null,
      }),
    ).toBe(false);

    expect(
      shouldAutoApproveSourceCandidate({
        deterministicScore: 0.9,
        importStatus: "needs_verification",
        duplicateOfSourceId: "src_existing",
      }),
    ).toBe(false);
  });
});

describe("eventAutoApproval", () => {
  it("auto-approves event candidates above the score threshold", () => {
    expect(
      shouldAutoApproveEventCandidate({
        confidenceScore: AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD + 0.01,
        reviewStatus: "pending",
      }),
    ).toBe(true);
  });

  it("skips at-or-below-threshold and already-decided event candidates", () => {
    expect(
      shouldAutoApproveEventCandidate({
        confidenceScore: AUTO_APPROVE_DETERMINISTIC_SCORE_THRESHOLD,
        reviewStatus: "pending",
      }),
    ).toBe(false);
    expect(
      shouldAutoApproveEventCandidate({
        confidenceScore: 0.9,
        reviewStatus: "approved",
      }),
    ).toBe(false);
    expect(
      shouldAutoApproveEventCandidate({
        confidenceScore: 0.9,
        reviewStatus: "rejected",
      }),
    ).toBe(false);
  });
});
