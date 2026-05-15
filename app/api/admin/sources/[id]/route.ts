export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { updateEventSourceRecord } from "@/lib/airtable/eventSourceCatalogRepository";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const body = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const allowedFields = new Set([
    "Source Name",
    "Website / Social Link",
    "Source Category",
    "Source Type",
    "City / Area Served",
    "County / Region",
    "Event Types",
    "Family Relevance",
    "Why Useful for SacFamEvents",
    "Estimated Update Frequency",
    "Freshness Likelihood",
    "Automation Fit",
    "Recommended Ingestion Method",
    "Review Priority",
    "Relevance Score",
    "Verification Status",
    "Status",
    "Notes",
    "Last Checked At",
    "Created By AI",
    "Research Run ID",
    "Duplicate Check Key",
  ]);
  const fields = Object.fromEntries(
    Object.entries(body).filter(([key]) => allowedFields.has(key)),
  );
  if (Object.keys(fields).length === 0) {
    return NextResponse.json(
      { ok: false, message: "No supported Airtable fields were provided." },
      { status: 400 },
    );
  }
  const result = await updateEventSourceRecord(params.id, fields);
  if (!result.ok) {
    return NextResponse.json({ ok: false, message: result.message }, { status: 503 });
  }
  return NextResponse.json({ ok: true, source: result.record });
}
