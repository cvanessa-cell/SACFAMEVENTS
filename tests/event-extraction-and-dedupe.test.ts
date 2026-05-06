import { describe, expect, it } from "vitest";

import { buildDuplicateKey } from "@/lib/events/dedupeEvents";
import { eventExtractionSchema } from "@/lib/events/eventExtractionSchema";

describe("event extraction schema + dedupe", () => {
  it("validates parsed json shape", () => {
    const parsed = eventExtractionSchema.parse({
      source_summary: "Summary",
      new_events: [],
      updated_events: [],
      cancelled_events: [],
      irrelevant_content: [],
      warnings: [],
    });
    expect(parsed.source_summary).toBe("Summary");
  });

  it("detects duplicate key from normalized fields", () => {
    const a = buildDuplicateKey({
      title: "Kids Night Out",
      date: new Date("2026-06-01T12:00:00Z"),
      city: "Roseville",
      venueName: "Gym",
      sourceEventUrl: "https://example.com/1",
    });
    const b = buildDuplicateKey({
      title: " kids night out ",
      date: new Date("2026-06-01T20:00:00Z"),
      city: "roseville",
      venueName: "gym",
      sourceEventUrl: "https://example.com/1",
    });
    expect(a).toBe(b);
  });
});
