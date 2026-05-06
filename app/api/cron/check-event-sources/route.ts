import { NextResponse } from "next/server";

import { checkDueSources } from "@/lib/events/sourceChecker";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const auth = req.headers.get("authorization") ?? "";
  return auth === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const batch = Number(process.env.EVENT_SOURCE_CHECK_BATCH_SIZE ?? "20");
  const results = await checkDueSources(batch);
  return NextResponse.json({ ok: true, count: results.length, results });
}

export async function POST(req: Request) {
  return GET(req);
}
