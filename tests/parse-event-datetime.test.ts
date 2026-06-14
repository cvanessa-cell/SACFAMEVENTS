import { describe, expect, it } from "vitest";

import {
  isLikelyWallClockStoredAsUtc,
  normalizeEventEndDatetime,
  normalizeStoredEventDatetime,
  parseEventDatetime,
  reinterpretUtcComponentsAsLocal,
} from "@/lib/events/parseEventDatetime";

describe("parseEventDatetime", () => {
  it("parses explicit Pacific offset", () => {
    const d = parseEventDatetime("2026-06-13T11:00:00-07:00");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-06-13T18:00:00.000Z");
  });

  it("treats bare Z as mislabeled local wall clock", () => {
    const d = parseEventDatetime("2026-06-13T11:00:00.000Z");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-06-13T18:00:00.000Z");
  });

  it("parses naive datetime as Pacific local", () => {
    const d = parseEventDatetime("2026-06-13T11:00:00");
    expect(d).not.toBeNull();
    expect(d!.toISOString()).toBe("2026-06-13T18:00:00.000Z");
  });
});

describe("normalizeStoredEventDatetime", () => {
  it("fixes wall-clock-stored-as-UTC on read", () => {
    const wrong = new Date("2026-06-13T11:00:00.000Z");
    expect(isLikelyWallClockStoredAsUtc(wrong)).toBe(true);
    const fixed = normalizeStoredEventDatetime(wrong)!;
    expect(fixed.toISOString()).toBe("2026-06-13T18:00:00.000Z");
  });

  it("leaves correctly stored Pacific times unchanged", () => {
    const correct = new Date("2026-06-13T18:00:00.000Z");
    expect(isLikelyWallClockStoredAsUtc(correct)).toBe(false);
    expect(normalizeStoredEventDatetime(correct)!.toISOString()).toBe(
      "2026-06-13T18:00:00.000Z",
    );
  });

  it("detects afternoon end times mislabeled as Z when end precedes start", () => {
    const start = new Date("2026-06-13T18:00:00.000Z");
    const wrongEnd = new Date("2026-06-13T15:00:00.000Z");
    expect(isLikelyWallClockStoredAsUtc(wrongEnd)).toBe(false);
    const fixed = normalizeEventEndDatetime(start, wrongEnd)!;
    expect(fixed.toISOString()).toBe("2026-06-13T22:00:00.000Z");
  });
});

describe("reinterpretUtcComponentsAsLocal", () => {
  it("maps UTC 11:00 components to 11:00 Pacific instant", () => {
    const d = reinterpretUtcComponentsAsLocal(new Date("2026-06-13T11:00:00.000Z"));
    expect(d.toISOString()).toBe("2026-06-13T18:00:00.000Z");
  });
});
