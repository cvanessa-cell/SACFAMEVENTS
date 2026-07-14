import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  familyEvent: {
    findFirst: vi.fn(),
    update: vi.fn(),
    create: vi.fn(),
  },
};
vi.mock("@/lib/prisma", () => ({ prisma: mockPrisma }));

describe("upsertExtractedEvents", () => {
  beforeEach(() => vi.resetAllMocks());

  it("marks uncertain events as needs_review", { timeout: 30_000 }, async () => {
    mockPrisma.familyEvent.findFirst.mockResolvedValue(null);
    const { upsertExtractedEvents } = await import("@/lib/events/upsertExtractedEvents");
    await upsertExtractedEvents({
      source: { id: "src_1" } as any,
      sourceChange: { id: "chg_1" } as any,
      autoApproveConfidence: 0.88,
      parsed: {
        source_summary: "sum",
        new_events: [
          {
            title: "Event",
            description: null,
            venue_name: null,
            address: null,
            city: null,
            county: null,
            start_datetime: null,
            end_datetime: null,
            timezone: "America/Los_Angeles",
            age_range: null,
            price_text: null,
            registration_url: null,
            source_event_url: null,
            family_friendly_score: 0.8,
            confidence: 0.5,
            needs_human_review: true,
            reasoning_summary: "unclear date",
            possible_existing_duplicate_key: null,
          },
        ],
        updated_events: [],
        cancelled_events: [],
        irrelevant_content: [],
        warnings: [],
      },
    });
    expect(mockPrisma.familyEvent.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: "needs_review" }),
      }),
    );
  });

  it("stores Pacific local wall clock from Z-suffixed extraction", async () => {
    mockPrisma.familyEvent.findFirst.mockResolvedValue(null);
    const { upsertExtractedEvents } = await import("@/lib/events/upsertExtractedEvents");
    await upsertExtractedEvents({
      source: { id: "src_1" } as any,
      sourceChange: { id: "chg_1" } as any,
      autoApproveConfidence: 0.88,
      parsed: {
        source_summary: "sum",
        new_events: [
          {
            title: "Strawberry Festival",
            description: null,
            venue_name: null,
            address: null,
            city: "Sacramento",
            county: null,
            start_datetime: "2026-06-13T11:00:00.000Z",
            end_datetime: "2026-06-13T15:00:00.000Z",
            timezone: "America/Los_Angeles",
            age_range: null,
            price_text: null,
            registration_url: null,
            source_event_url: "https://example.com/event",
            family_friendly_score: 0.9,
            confidence: 0.95,
            needs_human_review: false,
            reasoning_summary: "clear",
            possible_existing_duplicate_key: null,
          },
        ],
        updated_events: [],
        cancelled_events: [],
        irrelevant_content: [],
        warnings: [],
      },
    });
    const createCall = mockPrisma.familyEvent.create.mock.calls[0][0];
    expect(createCall.data.startDatetime.toISOString()).toBe(
      "2026-06-13T18:00:00.000Z",
    );
    expect(createCall.data.endDatetime.toISOString()).toBe(
      "2026-06-13T22:00:00.000Z",
    );
  });
});
