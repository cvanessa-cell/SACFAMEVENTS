import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

const EXCLUDED_STATUSES = ["rejected", "duplicate", "cancelled"];

export async function GET() {
  try {
    const rows = await prisma.familyEvent.findMany({
      where: {
        status: { notIn: EXCLUDED_STATUSES },
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

    const events = rows.map((r) => ({
      id: r.id,
      eventName: r.title,
      description: r.description,
      eventLink: r.sourceEventUrl,
      city: r.city,
      county: r.county,
      venue: r.venueName,
      address: r.address,
      date: r.startDatetime
        ? r.startDatetime.toISOString().slice(0, 10)
        : "",
      startTime: r.startDatetime
        ? r.startDatetime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: r.timezone || "America/Los_Angeles",
          })
        : undefined,
      endTime: r.endDatetime
        ? r.endDatetime.toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: r.timezone || "America/Los_Angeles",
          })
        : undefined,
      ageRange: r.ageRange,
      cost: r.priceText,
      free: r.priceText
        ? /free|no cost|\$0/i.test(r.priceText)
        : undefined,
      category: r.source?.category ?? undefined,
      sourceName: r.source?.name ?? undefined,
      registrationRequired: Boolean(r.registrationUrl),
      registrationUrl: r.registrationUrl,
      confidence: r.confidence,
      status: r.status,
    }));

    return NextResponse.json({ events, count: events.length });
  } catch (err) {
    console.error("Public events API error:", err);
    return NextResponse.json(
      { error: "Failed to load events" },
      { status: 500 },
    );
  }
}
