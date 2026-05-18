import "dotenv/config";

import { prisma } from "../lib/prisma";

async function main() {
  const [sources, enabled, fetchLogs, changes, jobs, events] = await Promise.all([
    prisma.eventSource.count(),
    prisma.eventSource.count({ where: { enabled: true } }),
    prisma.sourceFetchLog.count(),
    prisma.sourceChange.count(),
    prisma.aiEventExtractionJob.count(),
    prisma.familyEvent.count(),
  ]);
  const jobsByStatus = await prisma.aiEventExtractionJob.groupBy({
    by: ["status"],
    _count: { _all: true },
  });
  console.log(
    JSON.stringify(
      { sources, enabled, fetchLogs, changes, jobs, events, jobsByStatus },
      null,
      2,
    ),
  );
  await prisma.$disconnect();
}

void main();
