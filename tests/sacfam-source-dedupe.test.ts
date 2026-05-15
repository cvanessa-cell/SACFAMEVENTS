import { describe, expect, it } from "vitest";

import {
  findLikelyDuplicate,
  createDuplicateCheckKey,
  normalizeSourceName,
  normalizeUrl,
  type ExistingSourceForDedupe,
} from "@/lib/sources/sourceDeduplication";

describe("normalizeUrl", () => {
  it("strips tracking params, hash, www, and trailing slash", () => {
    const a = normalizeUrl("https://www.Example.com/Events/?utm_source=fb&utm_medium=cpc#section");
    const b = normalizeUrl("https://example.com/Events");
    expect(a).toBe(b);
  });

  it("keeps non-tracking query params", () => {
    const url = normalizeUrl("https://example.com/list?category=kids");
    expect(url).toContain("category=kids");
  });

  it("returns a best-effort lowercased value for invalid URLs", () => {
    expect(normalizeUrl("  HTTP://broken  ")).toContain("broken");
  });

  it("creates a stable duplicate check key from domain, name, and area", () => {
    expect(
      createDuplicateCheckKey({
        sourceUrl: "https://www.saclibrary.org/events?utm_source=x",
        sourceName: "Sacramento Public Library!",
        cityOrAreaServed: "Sacramento",
      }),
    ).toBe("saclibrary.org|sacramento public library|sacramento");
  });
});

describe("normalizeSourceName", () => {
  it("removes punctuation and collapses whitespace", () => {
    expect(normalizeSourceName("  Sac. Public  Library!  ")).toBe(
      "sac public library",
    );
  });
});

describe("findLikelyDuplicate", () => {
  const existing: ExistingSourceForDedupe[] = [
    {
      id: "src_1",
      name: "Sacramento Public Library",
      sourceUrl: "https://saclibrary.org/events",
      city: "Sacramento",
      category: "public_libraries",
    },
    {
      id: "src_2",
      name: "Folsom Parks and Recreation",
      sourceUrl: "https://folsom.ca.us/parks",
      city: "Folsom",
      category: "parks_and_recreation",
    },
  ];

  it("returns strong match for the same normalized URL", () => {
    const result = findLikelyDuplicate(
      {
        sourceName: "SPL Events",
        sourceUrl: "https://www.SacLibrary.org/events/?utm_campaign=x",
        cityOrAreaServed: "Sacramento",
        sourceCategory: "public_libraries",
      },
      existing,
    );
    expect(result.strength).toBe("strong");
    expect(result.existingSourceId).toBe("src_1");
    expect(result.reason).toBe("matching_normalized_url");
  });

  it("returns strong match for same name + same city", () => {
    const result = findLikelyDuplicate(
      {
        sourceName: "Sacramento Public Library",
        sourceUrl: "https://different-host.example/events",
        cityOrAreaServed: "Sacramento",
        sourceCategory: "public_libraries",
      },
      existing,
    );
    expect(result.strength).toBe("strong");
    expect(result.existingSourceId).toBe("src_1");
  });

  it("returns none when nothing matches", () => {
    const result = findLikelyDuplicate(
      {
        sourceName: "Davis Children's Museum",
        sourceUrl: "https://davis-childrens-museum.example",
        cityOrAreaServed: "Davis",
        sourceCategory: "museums_and_childrens_museums",
      },
      existing,
    );
    expect(result.strength).toBe("none");
  });
});
