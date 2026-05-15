export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { runSourceResearch } from "@/lib/sources/sourceResearchService";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  let body: {
    requestedSourceCount?: number;
    targetRegion?: string;
    requestedBy?: string;
  } = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as typeof body;
  }
  const result = await runSourceResearch({
    requestedSourceCount: body.requestedSourceCount,
    targetRegion: body.targetRegion,
    requestedBy: body.requestedBy,
  });
  const status = result.ok ? 200 : result.reason === "openai_call_failed" ? 502 : 400;
  return NextResponse.json(result, { status });
}
