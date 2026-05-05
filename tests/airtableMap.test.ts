import { describe, expect, it } from "vitest";

import { mapAirtableEventRecord } from "@/lib/airtable";

describe("airtable event mapping", () => {
  it("maps canonical fields", () => {
    const mapped = mapAirtableEventRecord({
      id: "recABC",
      fields: {
        "Event Name": "Park Playdate",
        Date: "2026-05-10",
        "Start Time": "10:00",
        "End Time": "11:00",
        City: "Roseville",
        Venue: "Vernon Street Town Square",
        Address: "",
        "Source Name": "City of Roseville",
        "Source Type": "City Calendar",
        "Source Link": "https://www.roseville.ca.us/calendar",
        "Event Link": "",
        "Age Range": "Toddler",
        Cost: "",
        "Free?": true,
        Category: "Play",
        "Indoor/Outdoor": "Outdoor",
        "Recurring?": false,
        "Registration Required?": false,
        "Kid-Friendly Notes": "",
        Description: "",
        Status: "Confirmed",
        "Added to Google Calendar?": false,
        "Confidence Score": 0.77,
      },
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.airtableRecordId).toBe("recABC");
    expect(mapped?.eventName).toBe("Park Playdate");
    expect(mapped?.status).toBe("Confirmed");
  });
});
