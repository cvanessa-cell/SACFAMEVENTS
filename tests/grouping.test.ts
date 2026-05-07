import { describe, expect, it } from "vitest";

import { MOCK_FAMILY_EVENTS } from "@/lib/mockEvents";
import { groupKeyForEvent, groupLabel } from "@/lib/eventGrouping";

describe("event grouping", () => {
  const template = { ...MOCK_FAMILY_EVENTS[0], date: "2026-05-10" };

  it("generates deterministic keys per mode", () => {
    expect(groupKeyForEvent(template, "day")).toContain("2026-05");
    expect(groupKeyForEvent(template, "week")).toContain("_");
    expect(groupKeyForEvent(template, "month")).toContain("2026-05");
  });

  it("labels months", () => {
    expect(groupLabel("2026-06", "month")).toContain("June");
  });
});
