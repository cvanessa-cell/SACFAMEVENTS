export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { approveEventCandidate } from "@/lib/sources/eventMonitorService";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  let body: { note?: string } = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as typeof body;
  }
  const result = await approveEventCandidate(params.id, { note: body.note ?? null });
  const status = result.ok ? 200 : result.reason === "candidate_not_found" ? 404 : 400;
  return NextResponse.json(result, { status });
}
