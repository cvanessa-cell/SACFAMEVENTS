import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import type { SourceResearchCandidatePayload } from "@/lib/ai/schemas/sourceResearchSchema";
function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

describe("Airtable source workflow repositories", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    setEnv({
      AIRTABLE_API_KEY: "key",
      AIRTABLE_BASE_ID: "base",
      SACFAM_AIRTABLE_WRITE_ENABLED: "true",
      AIRTABLE_SOURCE_CANDIDATES_TABLE: "Source Candidates",
    });
  });

  afterEach(() => {
    setEnv({
      AIRTABLE_API_KEY: undefined,
      AIRTABLE_BASE_ID: undefined,
      SACFAM_AIRTABLE_WRITE_ENABLED: undefined,
      AIRTABLE_SOURCE_CANDIDATES_TABLE: undefined,
    });
  });

  it("batches candidate records in groups of 10 or fewer", async () => {
    const fetchMock = vi.fn(async () =>
      new Response(JSON.stringify({ records: [{ id: "rec", fields: {} }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { createSourceCandidateRecords } = await import(
      "@/lib/airtable/sourceCandidateRepository"
    );

    const payload: SourceResearchCandidatePayload = {
      source_name: "Sacramento Public Library",
      source_url: "https://saclibrary.org/events",
      source_category: "Public Libraries",
      source_type: "official",
      city_or_area_served: "Sacramento",
      county_or_region: "Sacramento County",
      event_types: ["storytime"],
      family_relevance: "high",
      why_useful_for_sacfam_events: "County-wide free family programs",
      estimated_update_frequency: "weekly",
      freshness_likelihood: "high",
      automation_fit: "excellent",
      recommended_ingestion_method: "official_calendar_monitoring",
      review_priority: "high",
      relevance_score: 9,
      verification_status: "verified",
      status: "proposed",
      notes: null,
    };
    const inputs = Array.from({ length: 11 }, (_, index) => ({
      candidateId: `cand_${index}`,
      runId: "run_1",
      payload: { ...payload, source_name: `${payload.source_name} ${index}` },
      importStatus: "pending_review",
    }));
    const result = await createSourceCandidateRecords(inputs);
    expect(result.ok).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const calls = fetchMock.mock.calls as unknown as Array<[string, { body: string }]>;
    expect(calls[0]?.[1]?.body).toBeDefined();
    expect(calls[1]?.[1]?.body).toBeDefined();
    const firstBody = JSON.parse(calls[0]![1]!.body) as {
      records: unknown[];
    };
    const secondBody = JSON.parse(calls[1]![1]!.body) as {
      records: unknown[];
    };
    expect(firstBody.records).toHaveLength(10);
    expect(secondBody.records).toHaveLength(1);
  });
});
