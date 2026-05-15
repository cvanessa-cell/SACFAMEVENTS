import { describe, expect, it } from "vitest";

import {
  eventMonitorSchema,
  type EventCandidatePayload,
} from "@/lib/ai/schemas/eventMonitorSchema";

function makeValidEvent(
  overrides: Partial<EventCandidatePayload> = {},
): EventCandidatePayload {
  return {
    event_title: "Saturday Storytime",
    event_url: "https://saclibrary.org/event/123",
    source_name: "Sacramento Public Library",
    source_url: "https://saclibrary.org/events",
    event_date: "2026-05-16",
    event_start_time: "10:30",
    event_end_time: "11:15",
    location_name: "Central Library",
    street_address: "828 I St",
    city: "Sacramento",
    county_or_region: "Sacramento County",
    event_category: "kids_storytime",
    family_age_range: "0-5",
    cost: "Free",
    registration_required: false,
    description_summary: "Weekly bilingual storytime for toddlers and preschoolers.",
    why_relevant_for_families: "Free recurring kids program at a public venue.",
    confidence_score: 0.92,
    admin_review_required: false,
    change_type: "new_event",
    calendar_ready: "yes",
    missing_fields: [],
    review_status: "pending",
    notes: null,
    ...overrides,
  };
}

describe("eventMonitorSchema", () => {
  it("accepts a representative valid payload", () => {
    const payload = {
      source_active: true,
      source_summary: "1 new event found",
      new_events_found: 1,
      updated_events_found: 0,
      events_needing_review: 0,
      calendar_ready_events: 1,
      events: [makeValidEvent()],
      warnings: [],
    };
    const result = eventMonitorSchema.parse(payload);
    expect(result.events).toHaveLength(1);
    expect(result.events[0].change_type).toBe("new_event");
  });

  it("rejects a payload missing the required source_active field", () => {
    const payload = {
      source_summary: "x",
      new_events_found: 0,
      updated_events_found: 0,
      events_needing_review: 0,
      calendar_ready_events: 0,
      events: [],
      warnings: [],
    };
    expect(() => eventMonitorSchema.parse(payload)).toThrow();
  });

  it("rejects an unknown calendar_ready value", () => {
    const payload = {
      source_active: true,
      source_summary: "x",
      new_events_found: 0,
      updated_events_found: 0,
      events_needing_review: 0,
      calendar_ready_events: 0,
      events: [
        makeValidEvent({
          // @ts-expect-error invalid enum on purpose
          calendar_ready: "maybe",
        }),
      ],
      warnings: [],
    };
    expect(() => eventMonitorSchema.parse(payload)).toThrow();
  });
});
