import type { EventSource, SourceChange } from "@prisma/client";

import { buildDuplicateKey, likelyDuplicateWhere } from "@/lib/events/dedupeEvents";
import { parseEventDatetime } from "@/lib/events/parseEventDatetime";
import { prisma } from "@/lib/prisma";
import type { EventExtractionResult } from "@/lib/events/eventExtractionSchema";

function parseStoredDate(
  v: string | null,
  timezone: string,
): Date | null {
  return parseEventDatetime(v, timezone);
}

export async function upsertExtractedEvents(input: {
  source: EventSource;
  sourceChange: SourceChange;
  parsed: EventExtractionResult;
  autoApproveConfidence: number;
}) {
  for (const ev of [...input.parsed.new_events, ...input.parsed.updated_events]) {
    const tz = ev.timezone || "America/Los_Angeles";
    const start = parseStoredDate(ev.start_datetime, tz);
    const end = parseStoredDate(ev.end_datetime, tz);
    const duplicateKey = buildDuplicateKey({
      title: ev.title,
      date: start,
      city: ev.city,
      venueName: ev.venue_name,
      sourceEventUrl: ev.source_event_url,
    });

    const existing = await prisma.familyEvent.findFirst({
      where: likelyDuplicateWhere({
        title: ev.title,
        date: start,
        venueName: ev.venue_name,
        sourceEventUrl: ev.source_event_url,
        registrationUrl: ev.registration_url,
      }),
      orderBy: { updatedAt: "desc" },
    });

    const status =
      ev.needs_human_review || ev.confidence < input.autoApproveConfidence
        ? "needs_review"
        : "approved";

    const payload = {
      title: ev.title,
      description: ev.description,
      sourceEventUrl: ev.source_event_url,
      sourceId: input.source.id,
      sourceChangeId: input.sourceChange.id,
      city: ev.city,
      county: ev.county,
      venueName: ev.venue_name,
      address: ev.address,
      startDatetime: start,
      endDatetime: end,
      timezone: ev.timezone,
      ageRange: ev.age_range,
      priceText: ev.price_text,
      registrationUrl: ev.registration_url,
      familyFriendlyScore: ev.family_friendly_score,
      confidence: ev.confidence,
      status: existing && existing.duplicateKey === duplicateKey ? "duplicate" : status,
      duplicateKey,
    };

    if (existing) {
      await prisma.familyEvent.update({ where: { id: existing.id }, data: payload });
    } else {
      await prisma.familyEvent.create({ data: payload });
    }
  }

  for (const ev of input.parsed.cancelled_events) {
    const start = parseStoredDate(ev.start_datetime, ev.timezone || "America/Los_Angeles");
    const existing = await prisma.familyEvent.findFirst({
      where: likelyDuplicateWhere({
        title: ev.title,
        date: start,
        sourceEventUrl: ev.source_event_url,
      }),
      orderBy: { updatedAt: "desc" },
    });
    if (!existing) continue;
    await prisma.familyEvent.update({
      where: { id: existing.id },
      data: {
        status: "cancelled",
        cancellationStatus: ev.reasoning_summary,
      },
    });
  }
}
