import { NextResponse } from "next/server";

import {
  fetchFamilyEventsFromAirtable,
  isAirtableConfigured,
} from "@/lib/airtable";
import {
  filterUpcomingPublicEvents,
  getTodayPacificYmd,
  mapFamilyEventToPublicEvent,
  mapPostgresRowToPublicEvent,
  mergePublicEvents,
  startOfTodayPacific,
} from "@/lib/events/publicEvents";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const todayStart = startOfTodayPacific();
    const todayYmd = getTodayPacificYmd();

    const rows = await prisma.familyEvent.findMany({
      where: {
        status: "approved",
        startDatetime: { gte: todayStart },
        sourceEventUrl: { not: null },
      },
      orderBy: { startDatetime: "asc" },
      select: {
        id: true,
        title: true,
        description: true,
        sourceEventUrl: true,
        city: true,
        county: true,
        venueName: true,
        address: true,
        startDatetime: true,
        endDatetime: true,
        timezone: true,
        ageRange: true,
        priceText: true,
        registrationUrl: true,
        familyFriendlyScore: true,
        confidence: true,
        status: true,
        source: { select: { name: true, category: true } },
      },
      take: 500,
    });

    const postgresEvents = rows
      .map((row) => mapPostgresRowToPublicEvent(row))
      .filter((ev): ev is NonNullable<typeof ev> => ev !== null);

    let airtableEvents: ReturnType<typeof mapFamilyEventToPublicEvent>[] = [];
    if (isAirtableConfigured()) {
      try {
        const airtableRows = await fetchFamilyEventsFromAirtable();
        airtableEvents = airtableRows
          .map((row) => mapFamilyEventToPublicEvent(row))
          .filter((ev): ev is NonNullable<typeof ev> => ev !== null);
        airtableEvents = filterUpcomingPublicEvents(airtableEvents, todayYmd);
      } catch (err) {
        console.warn("Public events: Airtable fetch failed, using Postgres only:", err);
      }
    }

    const events = mergePublicEvents(postgresEvents, airtableEvents);

    return NextResponse.json({
      events,
      count: events.length,
      sources: {
        postgres: postgresEvents.length,
        airtable: airtableEvents.length,
        merged: events.length,
      },
    });
  } catch (err) {
    console.error("Public events API error:", err);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }
}
