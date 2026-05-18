export const dynamic = "force-dynamic";
export const maxDuration = 60;

import { NextResponse } from "next/server";

import { readDailyWebEventDiscoveryConfig } from "@/lib/events/dailyWebEventDiscoveryEnv";
import { runDailyWebEventDiscovery } from "@/lib/events/dailyWebEventDiscoveryService";
import { logger } from "@/lib/logger";
import { markProjectActivity } from "@/lib/project/activityHeartbeat";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await markProjectActivity();
  const config = readDailyWebEventDiscoveryConfig();

  try {
    const summary = await runDailyWebEventDiscovery({
      dryRun: config.dryRun,
      limit: config.limit,
      lookaheadDays: config.lookaheadDays,
    });
    const status = summary.disabled ? 503 : summary.ok ? 200 : 502;
    return NextResponse.json(summary, { status });
  } catch (error) {
    logger.error("Cron discover-web-events failed", error, "cron/discover-web-events");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message, errors: [message] }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
