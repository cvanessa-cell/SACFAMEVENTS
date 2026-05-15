export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { checkDueSources } from "@/lib/events/sourceChecker";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const settings = await prisma.appAutomationSettings.findUnique({
    where: { id: "singleton" },
  });

  if (!settings?.automationEnabled) {
    return NextResponse.json({
      ok: false,
      message: "Automation is disabled. Enable it in Settings.",
    });
  }

  const batchSize = settings.maxSourcesPerRun;
  const runLog = await prisma.discoveryRunLog.create({
    data: { status: "running", sourcesTried: 0, eventsUpserted: 0 },
  });

  try {
    const results = await checkDueSources(batchSize);
    const changed = results.filter((r) => r.status === "changed").length;

    await prisma.discoveryRunLog.update({
      where: { id: runLog.id },
      data: {
        status: "success",
        finishedAt: new Date(),
        sourcesTried: results.length,
        eventsUpserted: changed,
        message: `Checked ${results.length} sources, ${changed} had changes.`,
      },
    });

    logger.info(
      `Scheduler run complete: ${results.length} sources, ${changed} changes`,
      "scheduler/run",
    );

    return NextResponse.json({
      ok: true,
      runLogId: runLog.id,
      sourcesTried: results.length,
      changed,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown error";
    await prisma.discoveryRunLog.update({
      where: { id: runLog.id },
      data: { status: "error", finishedAt: new Date(), message },
    });
    logger.error("Scheduler run failed", error, "scheduler/run");
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function GET(req: Request) {
  return POST(req);
}
