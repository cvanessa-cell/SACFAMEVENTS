export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { listSourceCandidateRecords } from "@/lib/airtable/sourceCandidateRepository";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const result = await listSourceCandidateRecords();
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true, candidates: result.records });
}
