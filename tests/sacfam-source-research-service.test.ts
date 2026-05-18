import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  sourceResearchRun: { create: vi.fn(), update: vi.fn() },
  sourceResearchCandidate: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  eventSource: { findMany: vi.fn(), findUnique: vi.fn(), create: vi.fn() },
};

const mockResponsesCreate = vi.fn();

vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));
vi.mock("@/lib/ai/openaiClient", () => ({
  tryGetAgentOpenAIClient: () =>
    ({ ok: true, client: { responses: { create: mockResponsesCreate } } } as const),
}));

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function validResponseText() {
  return JSON.stringify({
    project: "SacFamEvents",
    purpose: "Sacramento-area family event discovery and calendar-planning source database",
    target_region: ["Sacramento County", "Placer County"],
    source_count: 1,
    sources: [
      {
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
        relevance_score: 9.2,
        verification_status: "verified",
        status: "proposed",
        notes: null,
      },
    ],
    warnings: [],
  });
}

describe("runSourceResearch", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setEnv({
      OPENAI_API_KEY: "test-key",
      SACFAM_AI_SOURCE_AGENT_ENABLED: "true",
      SACFAM_SOURCE_AGENT_MAX_SOURCES: "10",
      SACFAM_SOURCE_AGENT_DRY_RUN: "true",
      OPENAI_MODEL: "gpt-test",
      SACFAM_AIRTABLE_WRITE_ENABLED: "false",
    });
    mockPrisma.eventSource.findMany.mockResolvedValue([]);
    mockPrisma.sourceResearchRun.create.mockResolvedValue({ id: "run_1" });
    mockPrisma.sourceResearchRun.update.mockResolvedValue({});
    mockPrisma.sourceResearchCandidate.create.mockResolvedValue({ id: "cand_1" });
    mockResponsesCreate.mockResolvedValue({ output_text: validResponseText() });
  });

  afterEach(() => {
    setEnv({
      SACFAM_AI_SOURCE_AGENT_ENABLED: undefined,
      SACFAM_SOURCE_AGENT_MAX_SOURCES: undefined,
      SACFAM_SOURCE_AGENT_DRY_RUN: undefined,
      OPENAI_API_KEY: undefined,
      OPENAI_MODEL: undefined,
      SACFAM_AIRTABLE_WRITE_ENABLED: undefined,
    });
  });

  it("returns disabled when the feature flag is off", async () => {
    process.env.SACFAM_AI_SOURCE_AGENT_ENABLED = "false";
    const { runSourceResearch } = await import("@/lib/sources/sourceResearchService");
    const result = await runSourceResearch({});
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "source_agent_flag_off" }),
    );
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("persists candidates in dry-run without creating EventSource rows", async () => {
    const { runSourceResearch } = await import("@/lib/sources/sourceResearchService");
    const result = await runSourceResearch({ requestedSourceCount: 1 });
    expect(result.ok).toBe(true);
    expect(mockPrisma.sourceResearchRun.create).toHaveBeenCalled();
    expect(mockPrisma.sourceResearchCandidate.create).toHaveBeenCalled();
    expect(mockPrisma.eventSource.create).not.toHaveBeenCalled();
    if (result.ok) {
      expect(result.dryRun).toBe(true);
      expect(result.parsedSourceCount).toBe(1);
      expect(result.savedCandidateCount).toBe(1);
      expect(result.autoApprovedCount).toBe(0);
    }
  });

  it("auto-imports public verified candidates when dry-run is off", async () => {
    process.env.SACFAM_SOURCE_AGENT_DRY_RUN = "false";
    mockPrisma.sourceResearchCandidate.findUnique.mockResolvedValue({
      id: "cand_1",
      sourceName: "Sacramento Public Library",
      sourceUrl: "https://saclibrary.org/events",
      sourceCategory: "Public Libraries",
      sourceType: "official",
      cityOrAreaServed: "Sacramento",
      countyOrRegion: "Sacramento County",
      eventTypesJson: "[]",
      familyRelevance: "high",
      whyUsefulForSacfamEvents: "county-wide kids programs",
      estimatedUpdateFrequency: "weekly",
      freshnessLikelihood: "high",
      automationFit: "excellent",
      recommendedIngestionMethod: "official_calendar_monitoring",
      reviewPriority: "high",
      relevanceScore: 9.2,
      deterministicScore: 0.9,
      verificationStatus: "verified",
      notes: null,
      duplicateOfSourceId: null,
      importStatus: "needs_verification",
      runId: "run_1",
    });
    mockPrisma.eventSource.findUnique.mockResolvedValue(null);
    mockPrisma.eventSource.create.mockResolvedValue({ id: "src_new" });
    mockPrisma.sourceResearchCandidate.update.mockResolvedValue({});

    const { runSourceResearch } = await import("@/lib/sources/sourceResearchService");
    const result = await runSourceResearch({ requestedSourceCount: 1 });
    expect(result.ok).toBe(true);
    expect(mockPrisma.eventSource.create).toHaveBeenCalled();
    if (result.ok) {
      expect(result.autoApprovedCount).toBe(1);
    }
  });

  it("marks the run failed when schema validation fails", async () => {
    mockResponsesCreate.mockResolvedValue({ output_text: "{}" });
    const { runSourceResearch } = await import("@/lib/sources/sourceResearchService");
    const result = await runSourceResearch({});
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "schema_validation_failed" }),
    );
    expect(mockPrisma.sourceResearchRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "failed" }),
      }),
    );
  });
});

describe("approveSourceCandidate", () => {
  beforeEach(() => {
    vi.resetAllMocks();
    setEnv({
      OPENAI_API_KEY: "test-key",
      SACFAM_AI_SOURCE_AGENT_ENABLED: "true",
    });
  });

  it("refuses to import in dry-run mode", async () => {
    setEnv({ SACFAM_SOURCE_AGENT_DRY_RUN: "true" });
    const { approveSourceCandidate } = await import(
      "@/lib/sources/sourceResearchService"
    );
    const result = await approveSourceCandidate({ candidateId: "cand_1" });
    expect(result).toEqual(
      expect.objectContaining({ ok: false, reason: "dry_run_blocked" }),
    );
    expect(mockPrisma.eventSource.create).not.toHaveBeenCalled();
  });

  it("creates an EventSource when dry-run is off and no duplicate exists", async () => {
    setEnv({ SACFAM_SOURCE_AGENT_DRY_RUN: "false" });
    mockPrisma.sourceResearchCandidate.findUnique.mockResolvedValue({
      id: "cand_1",
      sourceName: "Davis Library",
      sourceUrl: "https://davis.example/events",
      sourceCategory: "Public Libraries",
      sourceType: "official",
      cityOrAreaServed: "Davis",
      countyOrRegion: "Yolo County",
      deterministicScore: 0.8,
      recommendedIngestionMethod: "rss_or_feed_monitoring",
      importStatus: "pending_review",
      notes: null,
    });
    mockPrisma.eventSource.findUnique.mockResolvedValue(null);
    mockPrisma.eventSource.create.mockResolvedValue({ id: "src_new" });
    mockPrisma.sourceResearchCandidate.update.mockResolvedValue({});
    const { approveSourceCandidate } = await import(
      "@/lib/sources/sourceResearchService"
    );
    const result = await approveSourceCandidate({ candidateId: "cand_1" });
    expect(result).toEqual(
      expect.objectContaining({ ok: true, eventSourceId: "src_new", created: true }),
    );
    expect(mockPrisma.eventSource.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          name: "Davis Library",
          fetchStrategy: "rss_parse",
        }),
      }),
    );
  });
});
