import { describe, expect, it } from "vitest";

import { buildDuplicateKey, dedupeEvents } from "@/lib/events/eventDeduper";
import { rankDailyWebEvents, __testing as rankerTesting } from "@/lib/events/eventRanker";
import type { DailyWebEvent } from "@/lib/events/dailyWebEventDiscoverySchema";

function baseEvent(overrides: Partial<DailyWebEvent> = {}): DailyWebEvent {
  return {
    event_title: "Family Fun Day",
    event_url: "https://visitsacramento.com/events/family-fun",
    source_name: "Visit Sacramento",
    source_url: "https://visitsacramento.com/events",
    event_date: "2026-05-18",
    start_datetime: "",
    end_datetime: "",
    location_name: "",
    street_address: "",
    city: "Sacramento",
    region: "Sacramento County",
    event_category: "Festival",
    family_age_range: "All ages",
    cost: "Free",
    registration_required: "unknown",
    event_description: "Outdoor family festival.",
    day_of_week: "Monday",
    start_time: "",
    end_time: "",
    google_maps_url: "",
    why_family_friendly: "Kids activities and music.",
    confidence_score: 7,
    calendar_ready: "needs_review",
    missing_fields: ["start_datetime", "location_name"],
    review_status: "Need Review",
    citations: [{ title: "Visit Sac", url: "https://visitsacramento.com/events/family-fun" }],
    notes: "",
    ...overrides,
  };
}

describe("eventDeduper", () => {
  it("catches same title/date/city duplicate key", () => {
    const a = baseEvent();
    const b = baseEvent({ event_url: "https://visitsacramento.com/events/family-fun-2" });
    const keyA = buildDuplicateKey(a);
    const keyB = buildDuplicateKey(b);
    expect(keyA).toBe(keyB);

    const { unique, duplicatesSkipped } = dedupeEvents([a, b], new Set());
    expect(unique).toHaveLength(1);
    expect(duplicatesSkipped).toHaveLength(1);
  });
});

describe("eventRanker", () => {
  const today = "2026-05-17";

  it("favors official source with confirmed time and location", () => {
    const official = baseEvent({
      source_url: "https://www.sacramento365.com/event/kids-day",
      event_url: "https://www.sacramento365.com/event/kids-day",
      start_datetime: "2026-05-18T11:00:00-07:00",
      location_name: "Capitol Mall",
      street_address: "1010 L St",
      confidence_score: 9,
    });
    const vague = baseEvent({
      source_url: "https://example-blog.com/post",
      event_url: "https://example-blog.com/post",
      event_title: "event",
    });
    expect(rankerTesting.scoreDailyWebEvent(official, today)).toBeGreaterThan(
      rankerTesting.scoreDailyWebEvent(vague, today),
    );
    const ranked = rankDailyWebEvents([vague, official], today);
    expect(ranked[0]?.event_title).toBe(official.event_title);
  });

  it("penalizes missing time and location", () => {
    const complete = baseEvent({
      start_datetime: "2026-05-18T10:00:00-07:00",
      location_name: "Community Center",
      street_address: "123 Main St",
    });
    const incomplete = baseEvent();
    expect(rankerTesting.scoreDailyWebEvent(complete, today)).toBeGreaterThan(
      rankerTesting.scoreDailyWebEvent(incomplete, today),
    );
  });
});
