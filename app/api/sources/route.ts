import { NextResponse } from "next/server";

import {
  getAirtableConfig,
  isAirtableConfigured,
  listAllRecords,
} from "@/lib/airtable";

export const dynamic = "force-dynamic";

export async function GET() {
  const cfg = getAirtableConfig();
  if (!isAirtableConfigured() || !cfg) {
    return NextResponse.json({
      source: "disabled",
      message: "Airtable credentials not configured.",
      records: [],
    });
  }

  try {
    const rows = await listAllRecords(cfg.baseId, cfg.sourcesTable, cfg.apiKey);
    return NextResponse.json({ source: "airtable", count: rows.length, records: rows });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ source: "error", message: msg, records: [] }, { status: 502 });
  }
}
