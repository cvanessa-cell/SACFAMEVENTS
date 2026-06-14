/**
 * Recover FamilyEvent start times corrupted by re-interpreting already-correct UTC
 * instants as local wall clock (e.g. 18:00Z → 01:00Z next day).
 */
import { formatInTimeZone } from "date-fns-tz";

import {
  DEFAULT_EVENT_TIMEZONE,
  isLikelyWallClockStoredAsUtc,
  reinterpretUtcComponentsAsLocal,
} from "../lib/events/parseEventDatetime";
import { prisma } from "../lib/prisma";

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

  let recovered = 0;
  for (const row of rows) {
    const tz = row.timezone || DEFAULT_EVENT_TIMEZONE;
    const start = row.startDatetime!;
    const end = row.endDatetime;
    const pacificHour = Number(formatInTimeZone(start, tz, "H"));

    // Corrupted: evening Pacific display but end is earlier same local day
    if (
      pacificHour >= 17 &&
      end &&
      formatInTimeZone(start, tz, "yyyy-MM-dd") ===
        formatInTimeZone(end, tz, "yyyy-MM-dd") &&
      end < start
    ) {
      const ymd = formatInTimeZone(start, tz, "yyyy-MM-dd");
      const h = String(pacificHour).padStart(2, "0");
      const mm = formatInTimeZone(start, tz, "mm");
      const ss = formatInTimeZone(start, tz, "ss");
      const recoveredStart = new Date(`${ymd}T${h}:${mm}:${ss}.000Z`);

      await prisma.familyEvent.update({
        where: { id: row.id },
        data: { startDatetime: recoveredStart },
      });
      console.log(`Recovered start: ${row.title} → ${recoveredStart.toISOString()}`);
      recovered += 1;
      continue;
    }

    // Still mislabeled morning wall clock as UTC
    if (isLikelyWallClockStoredAsUtc(start, tz)) {
      const fixedStart = reinterpretUtcComponentsAsLocal(start, tz);
      const fixedEnd = row.endDatetime
        ? reinterpretUtcComponentsAsLocal(row.endDatetime, tz)
        : row.endDatetime;
      await prisma.familyEvent.update({
        where: { id: row.id },
        data: { startDatetime: fixedStart, endDatetime: fixedEnd },
      });
      console.log(`Repaired mislabeled: ${row.title}`);
      recovered += 1;
    }
  }

  console.log(`Done. Updated ${recovered} event(s).`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
