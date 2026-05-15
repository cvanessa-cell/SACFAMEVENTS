import { NextResponse } from "next/server";

import {
  getAirtableConfig,
  isAirtableConfigured,
  listAllRecords,
} from "@/lib/airtable";
import { MOCK_FAMILY_EVENT_SOURCES } from "@/lib/mockSources";
import { mapAirtableSourceRecord, type FamilyEventSource } from "@/lib/sources";

export const dynamic = "force-dynamic";

export type SourcesPayload =
  | {
      source: "airtable";
      count: number;
      records: FamilyEventSource[];
    }
  | {
      source: "mock";
      count: number;
      records: FamilyEventSource[];
      warning?: string;
      airtableError?: boolean;
    };

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const forceMock =
    searchParams.get("mock") === "1" || searchParams.get("mock") === "true";

  const cfg = getAirtableConfig();
  if (forceMock || !isAirtableConfigured() || !cfg) {
    const payload: SourcesPayload = {
      source: "mock",
      count: MOCK_FAMILY_EVENT_SOURCES.length,
      records: MOCK_FAMILY_EVENT_SOURCES,
      ...(forceMock
        ? {}
        : {
            warning:
              "Airtable credentials not configured — showing mock sources.",
          }),
    };
    return NextResponse.json(payload);
  }

  try {
    const rows = await listAllRecords(cfg.baseId, cfg.sourcesTable, cfg.apiKey);
    const records = rows
      .map((r) => mapAirtableSourceRecord(r))
      .filter((s): s is FamilyEventSource => s !== null);
    const payload: SourcesPayload = {
      source: "airtable",
      count: records.length,
      records,
    };
    return NextResponse.json(payload);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown Airtable error";
    const payload: SourcesPayload = {
      source: "mock",
      count: MOCK_FAMILY_EVENT_SOURCES.length,
      records: MOCK_FAMILY_EVENT_SOURCES,
      warning: `Airtable request failed; showing mock sources. ${message}`,
      airtableError: true,
    };
    return NextResponse.json(payload);
  }
}
