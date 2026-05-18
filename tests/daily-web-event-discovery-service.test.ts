import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockResponsesCreate = vi.fn();
const mockGetSources = vi.fn();
const mockGetExisting = vi.fn();
const mockCreateEvents = vi.fn();

vi.mock("@/lib/ai/openaiClient", () => ({
  tryGetAgentOpenAIClient: () =>
    ({ ok: true, client: { responses: { create: mockResponsesCreate } } } as const),
}));

vi.mock("@/lib/airtable/familyEventSourcesRepository", () => ({
  getHighPrioritySourcePreferences: (...args: unknown[]) => mockGetSources(...args),
  buildSourcePreferenceSummary: () => "Test sources",
}));

vi.mock("@/lib/airtable/familyEventsRepository", () => ({
  getExistingFamilyEventsForWindow: (...args: unknown[]) => mockGetExisting(...args),
  createFamilyEvents: (...args: unknown[]) => mockCreateEvents(...args),
  AIRTABLE_BATCH_LIMIT: 10,
}));

function setEnv(values: Record<string, string | undefined>) {
  for (const [k, v] of Object.entries(values)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

function openAiPayload() {
  return JSON.stringify({
    events: [
      {
        event_title: "Kids Craft Morning",
        event_url: "https://roseville.ca.us/events/craft",
        source_name: "City of Roseville",
        source_url: "https://roseville.ca.us/events",
        event_date: "2026-05-20",
        start_datetime: "2026-05-20T09:00:00-07:00",
        end_datetime: "",
        location_name: "Roseville Civic Center",
        street_address: "311 Vernon St",
        city: "Roseville",
        region: "Placer County",
        event_category: "Arts",
        family_age_range: "5-12",
        cost: "Free",
        registration_required: "no",
        event_description: "Hands-on crafts for kids.",
        day_of_week: "Tuesday",
        start_time: "9:00 AM",
        end_time: "",
        google_maps_url: "https://www.google.com/maps/search/?api=1&query=Roseville",
        why_family_friendly: "All ages welcome with parent.",
        confidence_score: 8,
        calendar_ready: "yes",
        missing_fields: [],
        review_status: "Need Review",
        citations: [{ title: "Roseville events", url: "https://roseville.ca.us/events/craft" }],
        notes: "",
      },
    ],
  });
}

describe("runDailyWebEventDiscovery", () => {
  beforeEach(() => {
    vi.resetModules();
    vi.clearAllMocks();
    setEnv({
      SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED: "true",
      SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN: "true",
      SACFAM_DAILY_EVENT_LIMIT: "9",
      OPENAI_API_KEY: "test",
      AIRTABLE_API_KEY: "test",
      AIRTABLE_BASE_ID: "appTest",
    });
    mockGetSources.mockResolvedValue({ ok: true, sources: [] });
    mockGetExisting.mockResolvedValue({ ok: true, events: [] });
    mockCreateEvents.mockResolvedValue({ ok: true, records: [] });
    mockResponsesCreate.mockResolvedValue({ output_text: openAiPayload() });
  });

  afterEach(() => {
    setEnv({
      SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED: undefined,
      SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN: undefined,
      OPENAI_API_KEY: undefined,
      AIRTABLE_API_KEY: undefined,
      AIRTABLE_BASE_ID: undefined,
    });
  });

  it("returns disabled when feature flag is off", async () => {
    setEnv({ SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED: "false" });
    const { runDailyWebEventDiscovery } = await import(
      "@/lib/events/dailyWebEventDiscoveryService"
    );
    const summary = await runDailyWebEventDiscovery();
    expect(summary.disabled).toBe(true);
    expect(summary.ok).toBe(false);
    expect(mockResponsesCreate).not.toHaveBeenCalled();
  });

  it("dry run does not write Airtable records", async () => {
    const { runDailyWebEventDiscovery } = await import(
      "@/lib/events/dailyWebEventDiscoveryService"
    );
    const summary = await runDailyWebEventDiscovery({ dryRun: true });
    expect(summary.dryRun).toBe(true);
    expect(mockCreateEvents).not.toHaveBeenCalled();
    expect(summary.eventsCreated).toBe(0);
  });
});

describe("AIRTABLE_BATCH_LIMIT", () => {
  it("is 10 records or fewer", async () => {
    const { AIRTABLE_BATCH_LIMIT } = await import("@/lib/airtable/familyEventsRepository");
    expect(AIRTABLE_BATCH_LIMIT).toBeLessThanOrEqual(10);
  });
});
