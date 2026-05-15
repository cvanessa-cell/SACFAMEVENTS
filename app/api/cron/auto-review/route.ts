export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { runAutoReview } from "@/lib/events/autoReview";
import { logger } from "@/lib/logger";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json(
      { ok: false, message: "Unauthorized" },
      { status: 401 },
    );
  }

  try {
    const result = await runAutoReview();
    logger.info(
      `Auto-review: ${result.approved} approved, ${result.rejected} rejected`,
      "cron/auto-review",
    );
    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    logger.error("Auto-review cron failed", error, "cron/auto-review");
    const message = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  return GET(req);
}
