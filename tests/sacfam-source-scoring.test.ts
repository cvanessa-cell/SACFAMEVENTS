import { describe, expect, it } from "vitest";

import { computeDeterministicSourceScore } from "@/lib/sources/sourceScoring";

describe("computeDeterministicSourceScore", () => {
  it("returns a value in [0, 1]", () => {
    const score = computeDeterministicSourceScore({
      source_type: "official",
      freshness_likelihood: "high",
      automation_fit: "excellent",
      verification_status: "verified",
      review_priority: "high",
      relevance_score: 9,
    });
    expect(score).toBeGreaterThanOrEqual(0);
    expect(score).toBeLessThanOrEqual(1);
  });

  it("ranks official + high freshness above poor social", () => {
    const high = computeDeterministicSourceScore({
      source_type: "official",
      freshness_likelihood: "high",
      automation_fit: "excellent",
      verification_status: "verified",
      review_priority: "high",
      relevance_score: 8.5,
    });
    const low = computeDeterministicSourceScore({
      source_type: "social",
      freshness_likelihood: "low",
      automation_fit: "manual_only",
      verification_status: "needs_verification",
      review_priority: "low",
      relevance_score: 8.5,
    });
    expect(high).toBeGreaterThan(low);
  });

  it("does not let model relevance dominate structural signals", () => {
    const structural = computeDeterministicSourceScore({
      source_type: "social",
      freshness_likelihood: "low",
      automation_fit: "manual_only",
      verification_status: "needs_verification",
      review_priority: "low",
      relevance_score: 10,
    });
    expect(structural).toBeLessThan(0.7);
  });

  it("normalizes 1-10 relevance scores gracefully", () => {
    const score = computeDeterministicSourceScore({
      source_type: "official",
      freshness_likelihood: "high",
      automation_fit: "excellent",
      verification_status: "verified",
      review_priority: "high",
      relevance_score: 9,
    });
    expect(score).toBeLessThanOrEqual(1);
  });
});
