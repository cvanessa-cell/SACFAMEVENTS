import { describe, expect, it } from "vitest";

import { normalizeEventExtractionPayload } from "@/lib/events/normalizeEventExtractionPayload";

describe("normalizeEventExtractionPayload", () => {
  it("passes through canonical payloads unchanged", () => {
    const parsed = normalizeEventExtractionPayload({
      source_summary: "Summary",
      new_events: [],
      updated_events: [],
      cancelled_events: [],
      irrelevant_content: [],
      warnings: [],
    });
    expect(parsed.source_summary).toBe("Summary");
  });

  it("maps review_reason + irrelevant_or_excluded shape", () => {
    const parsed = normalizeEventExtractionPayload({
      source: {
        name: "Placer County Events",
        url: "https://www.placer.ca.gov/calendar",
        category: "county calendars",
      },
      timezone: "America/Los_Angeles",
      needs_human_review: true,
      review_reason: "Calendar page shell only; no extractable events.",
      new_events: [],
      updated_events: [],
      cancelled_events: [],
      duplicate_events: [],
      irrelevant_or_excluded: [
        {
          title: "Fire Safe Alliance Meeting",
          reason: "Public meeting; not clearly kid-friendly.",
        },
      ],
      noise_content: [{ type: "page_chrome", reason: "Navigation markup." }],
    });

    expect(parsed.source_summary).toContain("Calendar page shell only");
    expect(parsed.irrelevant_content).toHaveLength(2);
    expect(parsed.warnings).toEqual([]);
  });

  it("maps findings/status shape", () => {
    const parsed = normalizeEventExtractionPayload({
      source_name: "City of Sacramento Events",
      source_url: "https://www.cityofsacramento.gov/events",
      timezone: "America/Los_Angeles",
      status: "no_events_extracted",
      needs_human_review: true,
      findings: [
        {
          classification: "irrelevant_noise",
          reason: "404 page, not an event listing.",
          event: null,
        },
      ],
      events: [],
    });

    expect(parsed.source_summary).toBe("Status: no_events_extracted");
    expect(parsed.irrelevant_content[0]?.reason).toBe("irrelevant_noise");
  });

  it("maps summary object shape", () => {
    const parsed = normalizeEventExtractionPayload({
      source_name: "Roseville Parks and Recreation",
      source_url: "https://www.roseville.ca.us/government/departments/parks/events",
      summary: {
        real_family_friendly_events_found: 0,
        irrelevant_or_noise_items: 1,
      },
      events: [],
      changes: [],
    });

    expect(parsed.source_summary).toContain("real_family_friendly_events_found");
    expect(parsed.new_events).toEqual([]);
  });
});
