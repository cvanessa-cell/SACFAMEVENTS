import { describe, expect, it } from "vitest";

import {
  filterUpcomingPublicEvents,
  isAirtableStatusPublicApproved,
  mapFamilyEventToPublicEvent,
  mergePublicEvents,
  normalizeEventUrlForDedupe,
  publicEventDedupeKey,
  type PublicEvent,
} from "@/lib/events/publicEvents";
import type { FamilyEvent } from "@/lib/validation";

function postgresEvent(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: "pg-1",
    eventName: "Story Time",
    eventLink: "https://example.com/story",
    date: "2026-06-15",
    status: "approved",
    dataSource: "postgres",
    ...overrides,
  };
}

function airtableEvent(overrides: Partial<PublicEvent> = {}): PublicEvent {
  return {
    id: "airtable:recABC",
    airtableRecordId: "recABC",
    eventName: "Park Playdate",
    eventLink: "https://example.com/playdate",
    date: "2026-06-20",
    status: "Confirmed",
    dataSource: "airtable",
    ...overrides,
  };
}

describe("normalizeEventUrlForDedupe", () => {
  it("strips www and trailing slashes", () => {
    expect(
      normalizeEventUrlForDedupe("https://WWW.Example.com/event/"),
    ).toBe("https://example.com/event");
  });
});

describe("publicEventDedupeKey", () => {
  it("prefers URL over title+date", () => {
    const key = publicEventDedupeKey({
      eventLink: "https://example.com/x",
      eventName: "Different Name",
      date: "2026-01-01",
    });
    expect(key).toBe("url:https://example.com/x");
  });

  it("falls back to normalized title+date+location", () => {
    const a = publicEventDedupeKey({
      eventName: "Carnival",
      date: "2026-08-02",
      venue: "City Park",
      city: "Roseville",
    });
    const b = publicEventDedupeKey({
      eventName: "carnival",
      date: "2026-08-02",
      venue: "city park",
      city: "roseville",
    });
    expect(a).toBe(b);
  });
});

describe("isAirtableStatusPublicApproved", () => {
  it("allows Confirmed and Added to Calendar", () => {
    expect(isAirtableStatusPublicApproved("Confirmed")).toBe(true);
    expect(isAirtableStatusPublicApproved("Added to Calendar")).toBe(true);
  });

  it("rejects review and terminal statuses", () => {
    expect(isAirtableStatusPublicApproved("Need Review")).toBe(false);
    expect(isAirtableStatusPublicApproved("Rejected")).toBe(false);
    expect(isAirtableStatusPublicApproved("Duplicate")).toBe(false);
  });
});

describe("mapFamilyEventToPublicEvent", () => {
  const base: FamilyEvent = {
    airtableRecordId: "recXYZ",
    eventName: "Library Story Hour",
    date: "2026-07-04",
    eventLink: "https://library.org/story",
    status: "Confirmed",
  };

  it("maps approved Airtable rows with direct links", () => {
    const mapped = mapFamilyEventToPublicEvent(base);
    expect(mapped).not.toBeNull();
    expect(mapped?.id).toBe("airtable:recXYZ");
    expect(mapped?.dataSource).toBe("airtable");
    expect(mapped?.eventLink).toBe("https://library.org/story");
  });

  it("drops rows without event links", () => {
    expect(mapFamilyEventToPublicEvent({ ...base, eventLink: "" })).toBeNull();
  });

  it("drops non-approved statuses", () => {
    expect(
      mapFamilyEventToPublicEvent({ ...base, status: "Need Review" }),
    ).toBeNull();
  });
});

describe("mergePublicEvents", () => {
  it("includes events from both stores", () => {
    const merged = mergePublicEvents(
      [postgresEvent()],
      [airtableEvent()],
    );
    expect(merged).toHaveLength(2);
  });

  it("dedupes by URL and prefers Postgres", () => {
    const pg = postgresEvent({
      id: "pg-winner",
      eventName: "Postgres Title",
      eventLink: "https://Example.com/same-event/",
    });
    const at = airtableEvent({
      eventName: "Airtable Title",
      eventLink: "https://www.example.com/same-event",
    });

    const merged = mergePublicEvents([pg], [at]);
    expect(merged).toHaveLength(1);
    expect(merged[0]?.id).toBe("pg-winner");
    expect(merged[0]?.dataSource).toBe("postgres");
  });

  it("dedupes by title+date when URL is missing on one side only via key fallback", () => {
    const pg = postgresEvent({
      eventName: "Summer Fest",
      date: "2026-08-01",
      eventLink: "https://a.com/1",
      venue: "Main St",
      city: "Auburn",
    });
    const at = airtableEvent({
      eventName: "Summer Fest",
      date: "2026-08-01",
      eventLink: "https://b.com/2",
      venue: "Main St",
      city: "Auburn",
    });

    // Different URLs but same title+date+location — both show (URL dedupe is primary)
    expect(mergePublicEvents([pg], [at])).toHaveLength(2);
  });
});

describe("filterUpcomingPublicEvents", () => {
  it("drops past dates", () => {
    const events = [
      postgresEvent({ date: "2026-01-01" }),
      postgresEvent({ id: "pg-2", date: "2026-12-01" }),
    ];
    const filtered = filterUpcomingPublicEvents(events, "2026-06-01");
    expect(filtered).toHaveLength(1);
    expect(filtered[0]?.id).toBe("pg-2");
  });
});
