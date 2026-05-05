import { describe, expect, it } from "vitest";

import { defaultEventFilters } from "@/lib/eventFiltersState";
import {
  envelopeDates,
  passesDateEnvelope,
  applyEventFilters,
} from "@/lib/filterEvents";
import type { FamilyEvent } from "@/lib/validation";

describe("event filters", () => {
  const ev: FamilyEvent = {
    airtableRecordId: "demo",
    eventName: "Test",
    date: "2026-05-10",
    status: "Confirmed",
    city: "Roseville",
    category: "Play",
    free: true,
    indoorOutdoor: "Outdoor",
    registrationRequired: false,
    addedToGoogleCalendar: false,
  };

  const range = {
    start: new Date("2026-05-01"),
    end: new Date("2026-05-31"),
  };

  it("checks envelope via ISO strings", () => {
    const { startS, endS } = envelopeDates(range);
    expect(passesDateEnvelope(ev.date, startS, endS)).toBe(true);
    expect(passesDateEnvelope("2026-04-01", startS, endS)).toBe(false);
  });

  it("honors facet filters", () => {
    const filters = {
      ...defaultEventFilters,
      calendarAdded: "no" as const,
    };
    expect(applyEventFilters(ev, filters, range)).toBe(true);
    expect(
      applyEventFilters(
        { ...ev, addedToGoogleCalendar: true },
        filters,
        range,
      ),
    ).toBe(false);
  });
});
