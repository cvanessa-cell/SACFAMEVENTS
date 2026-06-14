import { NextResponse } from "next/server";

import { buildDuplicateKey } from "@/lib/events/dedupeEvents";
import { prisma } from "@/lib/prisma";

/**
 * Marks lower-confidence duplicate FamilyEvent rows within the review pipeline.
 * Keeps the highest-confidence row per duplicate key; others become status duplicate.
 */
export async function POST() {
  try {
    const candidates = await prisma.familyEvent.findMany({
      where: {
        status: { in: ["needs_review", "approved"] },
      },
      orderBy: [{ confidence: "desc" }, { updatedAt: "desc" }],
      select: {
        id: true,
        title: true,
        startDatetime: true,
        city: true,
        venueName: true,
        sourceEventUrl: true,
        confidence: true,
        status: true,
        duplicateKey: true,
      },
    });

    const winners = new Map<string, string>();
    let markedDuplicate = 0;
    let skipped = 0;

    for (const ev of candidates) {
      const key =
        ev.duplicateKey ??
        buildDuplicateKey({
          title: ev.title,
          date: ev.startDatetime,
          city: ev.city,
          venueName: ev.venueName,
          sourceEventUrl: ev.sourceEventUrl,
        });

      if (!winners.has(key)) {
        winners.set(key, ev.id);
        if (!ev.duplicateKey) {
          await prisma.familyEvent.update({
            where: { id: ev.id },
            data: { duplicateKey: key },
          });
        }
        continue;
      }

      if (ev.status === "duplicate") {
        skipped += 1;
        continue;
      }

      await prisma.familyEvent.update({
        where: { id: ev.id },
        data: { status: "duplicate", duplicateKey: key },
      });
      await prisma.eventReviewNote.create({
        data: {
          familyEventId: ev.id,
          note: `Marked duplicate of ${winners.get(key)} via /api/events/dedupe.`,
        },
      });
      markedDuplicate += 1;
    }

    return NextResponse.json({
      ok: true,
      scanned: candidates.length,
      uniqueKeys: winners.size,
      markedDuplicate,
      skipped,
    });
  } catch (err) {
    console.error("Dedupe pass failed:", err);
    return NextResponse.json(
      { ok: false, message: "Dedupe pass failed." },
      { status: 500 },
    );
  }
}
