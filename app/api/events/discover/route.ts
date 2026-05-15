export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { checkDueSources } from "@/lib/events/sourceChecker";
import { logger } from "@/lib/logger";
import { markProjectActivity } from "@/lib/project/activityHeartbeat";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

function readBatchSize(req: Request): number {
  const url = new URL(req.url);
  const fromQuery = Number(url.searchParams.get("batch") ?? "");
  if (Number.isFinite(fromQuery) && fromQuery > 0) {
    return Math.min(fromQuery, 200);
  }
  const fromEnv = Number(process.env.EVENT_SOURCE_CHECK_BATCH_SIZE ?? "20");
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 20;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  await markProjectActivity();
  const batchSize = readBatchSize(req);
  const startedAt = new Date();
  try {
    const results = await checkDueSources(batchSize);
    const summary = summarize(results);
    return NextResponse.json({
      ok: true,
      batchSize,
      startedAt: startedAt.toISOString(),
      finishedAt: new Date().toISOString(),
      count: results.length,
      summary,
      results,
    });
  } catch (error) {
    logger.error("Discovery run failed", error, "api/events/discover");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message, batchSize },
      { status: 500 },
    );
  }
}

export async function GET(req: Request) {
  return POST(req);
}

function summarize(
  results: Array<{ sourceId: string; status: string }>,
): Record<string, number> {
  const summary: Record<string, number> = {};
  for (const r of results) {
    summary[r.status] = (summary[r.status] ?? 0) + 1;
  }
  return summary;
}
