import { describe, expect, it } from "vitest";

import { enrichDailyWebEvent } from "@/lib/events/dailyWebEventEnrichment";
import {
  dailyWebEventSchema,
  filterEventsInDateWindow,
  isEventWithinDateWindow,
} from "@/lib/events/dailyWebEventDiscoverySchema";
import { buildGoogleMapsUrlFromParts } from "@/lib/eventLocation";
import { mapDailyWebEventToAirtableFields } from "@/lib/airtable/familyEventsRepository";

function validEvent(overrides: Record<string, unknown> = {}) {
  return {
    event_title: "Kids Storytime",
    event_url: "https://saclibrary.org/events/storytime",
    source_name: "Sacramento Public Library",
    source_url: "https://saclibrary.org/events",
    event_description: "Weekly storytime for young children.",
    event_date: "2026-05-20",
    day_of_week: "Wednesday",
    start_datetime: "2026-05-20T10:00:00-07:00",
    end_datetime: "2026-05-20T11:00:00-07:00",
    start_time: "10:00 AM",
    end_time: "11:00 AM",
    location_name: "Central Library",
    street_address: "828 I St",
    city: "Sacramento",
    region: "Sacramento County",
    google_maps_url:
      "https://www.google.com/maps/search/?api=1&query=828%20I%20St%2C%20Sacramento%2C%20CA",
    event_category: "Library",
    family_age_range: "0-8",
    cost: "Free",
    registration_required: "no" as const,
    why_family_friendly: "Designed for toddlers and preschoolers.",
    confidence_score: 9,
    calendar_ready: "yes" as const,
    missing_fields: [] as string[],
    review_status: "Need Review" as const,
    citations: [
      { title: "Library events", url: "https://saclibrary.org/events/storytime" },
    ],
    notes: "",
    ...overrides,
  };
}

describe("dailyWebEventDiscoverySchema", () => {
  it("validates a good event", () => {
    const parsed = dailyWebEventSchema.safeParse(validEvent());
    expect(parsed.success).toBe(true);
  });

  it("rejects event without valid event URL in filter", () => {
    const event = validEvent({ event_url: "not-a-url" });
    const { valid, rejected } = filterEventsInDateWindow(
      [event as ReturnType<typeof validEvent>],
      "2026-05-17",
      "2026-05-31",
    );
    expect(valid).toHaveLength(0);
    expect(rejected[0]?.reason).toBe("missing_event_url");
  });

  it("rejects event without source URL in filter", () => {
    const event = validEvent({ source_url: "" });
    const { valid, rejected } = filterEventsInDateWindow(
      [event as ReturnType<typeof validEvent>],
      "2026-05-17",
      "2026-05-31",
    );
    expect(valid).toHaveLength(0);
    expect(rejected[0]?.reason).toBe("missing_source_url");
  });

  it("rejects stale event outside date window", () => {
    const event = validEvent({ event_date: "2020-01-01" });
    expect(isEventWithinDateWindow(event.event_date, "2026-05-17", "2026-05-31")).toBe(
      false,
    );
    const { valid, rejected } = filterEventsInDateWindow(
      [event as ReturnType<typeof validEvent>],
      "2026-05-17",
      "2026-05-31",
    );
    expect(valid).toHaveLength(0);
    expect(rejected[0]?.reason).toBe("outside_date_window");
  });
});

describe("event enrichment and maps", () => {
  it("computes day of week from event_date", () => {
    const enriched = enrichDailyWebEvent(
      dailyWebEventSchema.parse(validEvent({ day_of_week: "" })),
    );
    expect(enriched.day_of_week).toBe("Wednesday");
  });

  it("builds Google Maps URL from street address + city", () => {
    const url = buildGoogleMapsUrlFromParts({
      street_address: "828 I St",
      city: "Sacramento",
    });
    expect(url).toContain("google.com/maps/search");
    expect(decodeURIComponent(url)).toContain("828 I St");
    expect(decodeURIComponent(url)).toContain("Sacramento");
  });

  it("falls back to location name + city for Google Maps", () => {
    const url = buildGoogleMapsUrlFromParts({
      location_name: "Central Library",
      city: "Sacramento",
    });
    expect(decodeURIComponent(url)).toContain("Central Library");
  });

  it("marks missing time/location as needs_review", () => {
    const enriched = enrichDailyWebEvent(
      dailyWebEventSchema.parse(
        validEvent({
          start_time: "",
          end_time: "",
          start_datetime: "",
          end_datetime: "",
          location_name: "",
          street_address: "",
          calendar_ready: "yes",
        }),
      ),
    );
    expect(enriched.calendar_ready).toBe("needs_review");
    expect(enriched.missing_fields).toContain("start_time");
    expect(enriched.missing_fields).toContain("end_time");
  });
});

describe("Airtable mapping", () => {
  it("includes event URL, description, maps link, and day of week", () => {
    const event = dailyWebEventSchema.parse(validEvent());
    const fields = mapDailyWebEventToAirtableFields(event);
    expect(fields["Event Link"]).toBe(event.event_url);
    expect(fields["Source Link"]).toBe(event.source_url);
    expect(fields.Description).toBe(event.event_description);
    expect(fields["Google Maps Link"]).toBe(event.google_maps_url);
    expect(fields["Day of Week"]).toBe("Wednesday");
    expect(fields.Status).toBe("Need Review");
  });
});
