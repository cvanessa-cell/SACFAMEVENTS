import { describe, expect, it } from "vitest";

import {
  parseSourceResearchCandidates,
  sourceResearchSchema,
  type SourceResearchCandidatePayload,
} from "@/lib/ai/schemas/sourceResearchSchema";

function makeValidCandidate(
  overrides: Partial<SourceResearchCandidatePayload> = {},
): SourceResearchCandidatePayload {
  return {
    source_name: "Sacramento Public Library",
    source_url: "https://saclibrary.org/events",
    source_category: "Public Libraries",
    source_type: "official",
    city_or_area_served: "Sacramento",
    county_or_region: "Sacramento County",
    event_types: ["storytime", "kids_workshops"],
    family_relevance: "Strong: programs are designed for kids and families.",
    why_useful_for_sacfam_events:
      "Library system publishes a county-wide calendar of free family programs.",
    estimated_update_frequency: "weekly",
    freshness_likelihood: "high",
    automation_fit: "excellent",
    recommended_ingestion_method: "official_calendar_monitoring",
    review_priority: "high",
    relevance_score: 9.5,
    verification_status: "verified",
    status: "proposed",
    notes: null,
    ...overrides,
  };
}

describe("sourceResearchSchema", () => {
  it("accepts a representative valid payload", () => {
    const payload = {
      project: "SacFamEvents",
      purpose: "Sacramento-area family event discovery and calendar-planning source database",
      target_region: ["Sacramento County", "Placer County"],
      source_count: 2,
      sources: [makeValidCandidate(), makeValidCandidate({ source_name: "Folsom Parks" })],
      warnings: [],
    };
    const result = sourceResearchSchema.parse(payload);
    expect(result.sources).toHaveLength(2);
    expect(result.sources[0].source_category).toBe("Public Libraries");
  });

  it("rejects an unknown source_type enum value", () => {
    const payload = {
      project: "SacFamEvents",
      purpose: "x",
      target_region: ["Sacramento County"],
      source_count: 1,
      sources: [
        makeValidCandidate({
          // @ts-expect-error invalid enum on purpose
          source_type: "definitely_not_a_source_type",
        }),
      ],
      warnings: [],
    };
    expect(() => sourceResearchSchema.parse(payload)).toThrow();
  });

  it("rejects a relevance_score outside 0..1", () => {
    const payload = {
      project: "SacFamEvents",
      purpose: "x",
      target_region: ["Sacramento County"],
      source_count: 1,
      sources: [makeValidCandidate({ relevance_score: 11 })],
      warnings: [],
    };
    expect(() => sourceResearchSchema.parse(payload)).toThrow();
  });

  it("keeps valid records while reporting invalid records", () => {
    const result = parseSourceResearchCandidates([
      makeValidCandidate(),
      { source_name: "", source_url: "not-a-url" },
    ]);
    expect(result.validCandidates).toHaveLength(1);
    expect(result.invalidRecordErrors).toHaveLength(1);
  });
});
