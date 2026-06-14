/**
 * One-time repair: fix FamilyEvent rows where local wall clock was stored as UTC.
 * Run: npx tsx scripts/repair-event-datetimes.ts
 */
import { prisma } from "../lib/prisma";
import {
  DEFAULT_EVENT_TIMEZONE,
  isLikelyWallClockStoredAsUtc,
  reinterpretUtcComponentsAsLocal,
} from "../lib/events/parseEventDatetime";

async function main() {
  const rows = await prisma.familyEvent.findMany({
    where: { startDatetime: { not: null } },
    select: {
      id: true,
      title: true,
      startDatetime: true,
      endDatetime: true,
      timezone: true,
    },
  });

  let repaired = 0;
  for (const row of rows) {
    const tz = row.timezone || DEFAULT_EVENT_TIMEZONE;
    const start = row.startDatetime!;
    if (!isLikelyWallClockStoredAsUtc(start, tz)) continue;

    const fixedStart = reinterpretUtcComponentsAsLocal(start, tz);
    const fixedEnd = row.endDatetime
      ? reinterpretUtcComponentsAsLocal(row.endDatetime, tz)
      : row.endDatetime;

    await prisma.familyEvent.update({
      where: { id: row.id },
      data: { startDatetime: fixedStart, endDatetime: fixedEnd },
    });
    console.log(`Repaired: ${row.title} (${row.id})`);
    repaired += 1;
  }

  console.log(`Done. Repaired ${repaired} of ${rows.length} events with start times.`);

  let endRepaired = 0;
  const withBoth = await prisma.familyEvent.findMany({
    where: { startDatetime: { not: null }, endDatetime: { not: null } },
    select: { id: true, title: true, startDatetime: true, endDatetime: true, timezone: true },
  });
  for (const row of withBoth) {
    const tz = row.timezone || DEFAULT_EVENT_TIMEZONE;
    const start = row.startDatetime!;
    const end = row.endDatetime!;
    if (end <= start && isLikelyWallClockStoredAsUtc(end, tz)) {
      await prisma.familyEvent.update({
        where: { id: row.id },
        data: { endDatetime: reinterpretUtcComponentsAsLocal(end, tz) },
      });
      console.log(`Repaired end: ${row.title} (${row.id})`);
      endRepaired += 1;
    }
  }
  console.log(`End-time pass: repaired ${endRepaired} event(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
