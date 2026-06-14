import { describe, expect, it } from "vitest";

import {
  isLateNightFamilyFriendly,
  isLikelyAdultOnly,
  scorePriorityEventTypes,
  scoreToddlerRelevance,
} from "@/lib/events/ageSuitability";

describe("ageSuitability", () => {
  it("scores toddler storytime highly", () => {
    expect(
      scoreToddlerRelevance({
        title: "Preschool Storytime",
        description: "Stories and songs for ages 3-5.",
      }),
    ).toBeGreaterThan(0.4);
  });

  it("scores generic festival lower for toddler band", () => {
    expect(
      scoreToddlerRelevance({
        title: "Summer Festival",
        description: "Live music and food trucks.",
      }),
    ).toBe(0);
  });

  it("boosts priority family event types", () => {
    expect(
      scorePriorityEventTypes({
        title: "Movie in the Park",
        description: "Bring blankets for an outdoor movie night.",
      }),
    ).toBeGreaterThan(0);
  });

  it("detects late-night family-friendly movie events", () => {
    expect(
      isLateNightFamilyFriendly({
        title: "Movie in the Park: Lilo & Stitch",
        description: "Family movie night at dusk.",
      }),
    ).toBe(true);
  });

  it("rejects adult nightlife", () => {
    expect(
      isLikelyAdultOnly({
        title: "21+ Bar Crawl Downtown",
        description: "Cocktails and nightlife.",
      }),
    ).toBe(true);
  });
});
