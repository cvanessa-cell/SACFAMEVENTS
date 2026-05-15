export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { runEventMonitorForSource } from "@/lib/sources/eventMonitorService";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  let body: { sourceId?: string } = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as typeof body;
  }
  if (!body.sourceId) {
    return NextResponse.json(
      { ok: false, message: "sourceId is required" },
      { status: 400 },
    );
  }
  const result = await runEventMonitorForSource({ sourceId: body.sourceId });
  const status = result.ok
    ? 200
    : result.reason === "source_not_found"
      ? 404
      : result.reason === "openai_call_failed" || result.reason === "fetch_failed"
        ? 502
        : 400;
  return NextResponse.json(result, { status });
}
