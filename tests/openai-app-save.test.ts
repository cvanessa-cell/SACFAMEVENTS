import { describe, expect, it, vi } from "vitest";

import { saveDiscoveredFamilyEvents } from "@/lib/events/dailyWebEventDiscoveryService";
import { dailyWebEventSchema } from "@/lib/events/dailyWebEventDiscoverySchema";

vi.mock("@/lib/airtable/familyEventsRepository", () => ({
  getExistingFamilyEventsForWindow: vi.fn(async () => ({ ok: true, events: [] })),
  createFamilyEvents: vi.fn(async (events: unknown[]) => ({
    ok: true,
    records: (events as { event_title: string; event_date: string; event_url: string; city: string }[]).map(
      (e, i) => ({
        id: `rec${i}`,
        event: e,
      }),
    ),
  })),
}));

function sampleEvent() {
  return dailyWebEventSchema.parse({
    event_title: "Farmers Market",
    event_url: "https://example.org/event/farmers",
    source_name: "Example",
    source_url: "https://example.org",
    event_description: "Family-friendly market with kids activities.",
    event_date: "2026-05-22",
    day_of_week: "Friday",
    start_datetime: "",
    end_datetime: "",
    start_time: "9:00 AM",
    end_time: "1:00 PM",
    location_name: "City Plaza",
    street_address: "100 Main St",
    city: "Sacramento",
    region: "CA",
    google_maps_url: "https://www.google.com/maps/search/?api=1&query=test",
    event_category: "Market",
    family_age_range: "All ages",
    cost: "Free",
    registration_required: "no",
    why_family_friendly: "Kids zone and live music.",
    confidence_score: 8,
    calendar_ready: "needs_review",
    missing_fields: [],
    review_status: "Need Review",
    citations: [{ title: "Example", url: "https://example.org/event/farmers" }],
    notes: "",
  });
}

describe("saveDiscoveredFamilyEvents", () => {
  it("requires confirmSave=true", async () => {
    const result = await saveDiscoveredFamilyEvents({
      discovery_run_id: "run1",
      eventIndexes: [1],
      confirmSave: false,
      candidates: [sampleEvent()],
      startDate: "2026-05-17",
      endDate: "2026-05-31",
    });
    expect(result.saved).toHaveLength(0);
    expect(result.errors[0]).toMatch(/confirmSave/i);
  });

  it("saves selected events with URLs", async () => {
    const result = await saveDiscoveredFamilyEvents({
      discovery_run_id: "run1",
      eventIndexes: [1],
      confirmSave: true,
      candidates: [sampleEvent()],
      startDate: "2026-05-17",
      endDate: "2026-05-31",
    });
    expect(result.saved).toHaveLength(1);
    expect(result.saved[0]?.event_url).toContain("example.org");
  });

  it("rejects events missing URLs", async () => {
    const bad = sampleEvent();
    const broken = { ...bad, event_url: "" };
    const result = await saveDiscoveredFamilyEvents({
      discovery_run_id: "run1",
      eventIndexes: [1],
      confirmSave: true,
      candidates: [broken],
      startDate: "2026-05-17",
      endDate: "2026-05-31",
    });
    expect(result.saved).toHaveLength(0);
    expect(result.rejected[0]?.reason).toBe("missing_event_or_source_url");
  });
});
