import { describe, expect, it } from "vitest";

import { extractFamilyFinderMetadata } from "../extension/chrome/calendarParser";

describe("chrome extension structured parser parity", () => {
  it("captures reminders + maps urls", () => {
    const text = `
--- Family Event Finder ---
Reminder Preference: 1 hour
Google Maps: https://maps.example
--- End Family Event Finder ---
`;
    expect(extractFamilyFinderMetadata(text)["Reminder Preference"]).toBe(
      "1 hour",
    );
  });
});
