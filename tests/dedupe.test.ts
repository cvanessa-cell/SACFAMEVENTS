import { describe, expect, it } from "vitest";

import {
  buildNormalizedEventKey,
  pickWinnerForDuplicates,
} from "@/lib/eventDedupe";

describe("duplicate helpers", () => {
  it("matches identical triples regardless of casing", () => {
    const a = buildNormalizedEventKey({
      eventName: "Story Hour",
      date: "2026-06-02",
      venue: " Library ",
      city: "Auburn",
    });
    const b = buildNormalizedEventKey({
      eventName: "story hour",
      date: "2026-06-02",
      venue: "library",
      city: "auburn",
    });
    expect(a).toBe(b);
  });

  it("prefers authoritative sources when breaking ties", () => {
    const winner = pickWinnerForDuplicates([
      {
        airtableRecordId: "facebook",
        eventName: "Carnival",
        date: "2026-08-02",
        status: "Need Review",
        sourceType: "Facebook group",
        confidenceScore: 0.4,
      },
      {
        airtableRecordId: "city",
        eventName: "Carnival",
        date: "2026-08-02",
        status: "Confirmed",
        sourceType: "City Calendar",
        confidenceScore: 0.4,
      },
    ]);

    expect(winner?.airtableRecordId).toBe("city");
  });
});
