import { describe, expect, it } from "vitest";

import { buildGoogleMapsSearchUrl, mapsLinkFromEventParts } from "@/lib/googleMaps";

describe("google maps helper", () => {
  it("encodes safely", () => {
    expect(buildGoogleMapsSearchUrl("Sacramento Zoo")).toContain(
      "query=Sacramento%20Zoo",
    );
  });

  it("joins fallback parts", () => {
    expect(
      mapsLinkFromEventParts({
        address: "",
        venue: "MOSAC",
        city: "Sacramento",
      }),
    ).toContain("MOSAC");
  });
});
