import { NextResponse } from "next/server";

import {
  fetchFamilyEventsFromAirtable,
  isAirtableConfigured,
} from "@/lib/airtable";
import { MOCK_FAMILY_EVENTS } from "@/lib/mockEvents";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const forceMock =
    searchParams.get("mock") === "1" || searchParams.get("mock") === "true";

  try {
    if (!forceMock && isAirtableConfigured()) {
      const events = await fetchFamilyEventsFromAirtable();
      return NextResponse.json({
        source: "airtable" as const,
        count: events.length,
        events,
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Airtable error";
    return NextResponse.json({
      source: "mock" as const,
      count: MOCK_FAMILY_EVENTS.length,
      events: MOCK_FAMILY_EVENTS,
      warning: `Airtable request failed; showing mock data. ${message}`,
      airtableError: true,
    });
  }

  return NextResponse.json({
    source: "mock" as const,
    count: MOCK_FAMILY_EVENTS.length,
    events: MOCK_FAMILY_EVENTS,
  });
}
