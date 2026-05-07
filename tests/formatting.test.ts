import { describe, expect, it } from "vitest";

import {
  calendarTitleForEvent,
  ensureMapsLink,
  formatCalendarDescriptionStructured,
} from "@/lib/eventFormatting";
import { MOCK_FAMILY_EVENTS } from "@/lib/mockEvents";

describe("calendar formatting helpers", () => {
  const ev = MOCK_FAMILY_EVENTS[0];

  it("titles include bracket format", () => {
    const title = calendarTitleForEvent(ev);
    expect(title.startsWith("[STORY TIME]")).toBe(true);
    expect(title).toContain("Rocklin");
  });

  it("embed structured markers", () => {
    const body = formatCalendarDescriptionStructured({
      event: ev,
      mapsLink: ensureMapsLink(ev),
    });
    expect(body).toContain("--- Family Event Finder ---");
    expect(body).toContain("--- End Family Event Finder ---");
  });
});
