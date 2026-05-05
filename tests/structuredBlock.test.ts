import { describe, expect, it } from "vitest";

import { STRUCTURED_BLOCK_END, STRUCTURED_BLOCK_START } from "@/lib/constants";
import { parseStructuredFamilyEventFinderBlock } from "@/lib/structuredBlock";

describe("structured footer parser", () => {
  it("captures screenshots + airtable ids", () => {
    const desc = [
      "Summary line",
      "",
      STRUCTURED_BLOCK_START,
      "Event Name: Zoo Day",
      "Screenshot: https://example.com/shot.png",
      "Airtable Event ID: rec123",
      STRUCTURED_BLOCK_END,
    ].join("\n");

    const parsed = parseStructuredFamilyEventFinderBlock(desc);
    expect(parsed["Event Name"]).toBe("Zoo Day");
    expect(parsed.Screenshot).toContain("https://example.com/shot.png");
    expect(parsed["Airtable Event ID"]).toBe("rec123");
  });
});
