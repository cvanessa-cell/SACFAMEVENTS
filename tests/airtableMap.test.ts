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

  it("maps Family Events table column names", () => {
    const mapped = mapAirtableEventRecord({
      id: "recXYZ",
      fields: {
        "Event Name": "Maifest 2026",
        "Start Date": "2026-05-31",
        "Start Date / Time": "2026-05-31T18:00:00.000Z",
        "End Date / Time": "2026-05-31T23:00:00.000Z",
        City: "Sacramento",
        "Location / Venue Text": "Sacramento Turn Verein",
        Address: "3349 J St., Sacramento, CA 95816",
        "Source Name Text": "Visit Sacramento",
        "Source URL": "https://www.visitsacramento.com/events/",
        "Event URL": "https://example.com/maifest",
        "Category Text": [{ name: "Festival" }, { name: "Family Fun" }],
        Cost: "Children 0-12 free",
        "Free?": false,
        "Indoor / Outdoor": "Indoor",
        Status: "Added to Google Calendar",
        Description: "Family-friendly festival.",
        "Kid-Friendly Notes": "Games for kids.",
      },
    });

    expect(mapped).not.toBeNull();
    expect(mapped?.date).toBe("2026-05-31");
    expect(mapped?.venue).toBe("Sacramento Turn Verein");
    expect(mapped?.category).toBe("Festival, Family Fun");
    expect(mapped?.status).toBe("Added to Calendar");
    expect(mapped?.addedToGoogleCalendar).toBe(true);
  });
});
