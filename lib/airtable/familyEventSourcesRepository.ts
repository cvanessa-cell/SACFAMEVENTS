import { listAllRecords, type AirtableRecord } from "@/lib/airtable";
import { getFamilyEventsAirtableConfig } from "@/lib/airtable/client";
import { mapAirtableSourceRecord } from "@/lib/sources";

export interface HighPrioritySourcePreference {
  sourceName: string;
  sourceType: string;
  cityArea: string;
  website: string;
  sourceLink: string;
  priority: string;
  bestFor: string;
  notes: string;
  domains: string[];
}

function strField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) return strField(value[0]);
  return "";
}

function extractDomains(...urls: string[]): string[] {
  const domains = new Set<string>();
  for (const raw of urls) {
    const trimmed = raw.trim();
    if (!trimmed) continue;
    try {
      const host = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
        .hostname;
      if (host) domains.add(host.replace(/^www\./, "").toLowerCase());
    } catch {
      /* ignore invalid URLs */
    }
  }
  return Array.from(domains);
}

function isHighPriorityRecord(fields: Record<string, unknown>): boolean {
  const priority = strField(fields.Priority ?? fields["Review Priority"]).toLowerCase();
  if (priority === "high" || priority === "urgent" || priority === "1") return true;
  const status = strField(fields.Status).toLowerCase();
  if (status === "approved" || status === "active") return true;
  const active = fields.Active;
  if (active === false) return false;
  if (typeof active === "string" && active.toLowerCase() === "inactive") return false;
  return priority !== "low" && priority !== "skip";
}

export function mapRecordToSourcePreference(
  record: AirtableRecord<Record<string, unknown>>,
): HighPrioritySourcePreference | null {
  const mapped = mapAirtableSourceRecord(record);
  if (!mapped) return null;
  return {
    sourceName: mapped.sourceName,
    sourceType: mapped.sourceType,
    cityArea: mapped.cityArea,
    website: mapped.website,
    sourceLink: mapped.sourceLink,
    priority: mapped.priority,
    bestFor: mapped.bestFor,
    notes: mapped.notes,
    domains: extractDomains(mapped.website, mapped.sourceLink, mapped.facebook),
  };
}

export async function getHighPrioritySourcePreferences(): Promise<{
  ok: true;
  sources: HighPrioritySourcePreference[];
} | { ok: false; message: string }> {
  const cfg = getFamilyEventsAirtableConfig();
  if (!cfg) {
    return { ok: false, message: "Airtable is not configured." };
  }

  const records = await listAllRecords<Record<string, unknown>>(
    cfg.baseId,
    cfg.familyEventSourcesTable,
    cfg.apiKey,
  );

  const sources = records
    .filter((r) => isHighPriorityRecord(r.fields as Record<string, unknown>))
    .map((r) => mapRecordToSourcePreference(r))
    .filter((s): s is HighPrioritySourcePreference => s !== null);

  return { ok: true, sources };
}

export function buildSourcePreferenceSummary(
  sources: HighPrioritySourcePreference[],
): string {
  if (sources.length === 0) {
    return "No high-priority Airtable sources configured; search the broader Sacramento/Placer public web.";
  }
  return sources
    .slice(0, 40)
    .map((s, i) => {
      const domains = s.domains.length ? s.domains.join(", ") : "unknown domain";
      return `${i + 1}. ${s.sourceName} (${s.sourceType}) — ${s.cityArea || "Sacramento region"} — domains: ${domains} — ${s.bestFor || s.notes || "family events"}`;
    })
    .join("\n");
}
