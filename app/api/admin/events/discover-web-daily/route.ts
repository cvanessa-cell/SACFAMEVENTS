export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";

import { readDailyWebEventDiscoveryConfig } from "@/lib/events/dailyWebEventDiscoveryEnv";
import { runDailyWebEventDiscovery } from "@/lib/events/dailyWebEventDiscoveryService";
import { logger } from "@/lib/logger";

function isCronAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET() {
  const config = readDailyWebEventDiscoveryConfig();
  return NextResponse.json({
    ok: true,
    enabled: config.enabled,
    dryRun: config.dryRun,
    limit: config.limit,
    lookaheadDays: config.lookaheadDays,
    model: config.model,
    hasOpenAiKey: config.hasOpenAiKey,
    hasAirtableConfig: config.hasAirtableConfig,
  });
}

export async function POST(req: Request) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  let body: { dryRun?: boolean; limit?: number; lookaheadDays?: number } = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as typeof body;
  }

  const config = readDailyWebEventDiscoveryConfig();
  const limit =
    typeof body.limit === "number" && body.limit > 0
      ? Math.min(9, body.limit)
      : config.limit;

  try {
    const summary = await runDailyWebEventDiscovery({
      dryRun: body.dryRun ?? config.dryRun,
      limit,
      lookaheadDays: body.lookaheadDays,
    });
    const status = summary.disabled
      ? 503
      : summary.ok
        ? 200
        : summary.reason === "openai_call_failed"
          ? 502
          : 400;
    return NextResponse.json(summary, { status });
  } catch (error) {
    logger.error("Daily web discovery failed", error, "api/admin/discover-web-daily");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message, errors: [message] }, { status: 500 });
  }
}
