import type { AirtableRecord } from "@/lib/airtable";

export interface FamilyEventSource {
  airtableRecordId: string;
  sourceName: string;
  sourceType: string;
  cityArea: string;
  website: string;
  facebook: string;
  sourceLink: string;
  bestFor: string;
  priority: string;
  active: boolean;
  lastCheckedDate: string;
  notes: string;
}

function strField(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  if (Array.isArray(value) && value.length > 0) return strField(value[0]);
  return "";
}

function boolField(value: unknown): boolean {
  if (typeof value === "boolean") return value;
  const s = strField(value).toLowerCase();
  if (s === "yes" || s === "true" || s === "active") return true;
  if (s === "no" || s === "false" || s === "inactive") return false;
  return true;
}

/** Map an Airtable "Family Event Sources" row to a UI-friendly shape. */
export function mapAirtableSourceRecord(
  record: AirtableRecord<unknown>,
): FamilyEventSource | null {
  const f = record.fields as Record<string, unknown>;
  const sourceName = strField(f["Source Name"]) || strField(f["Name"]);
  if (!sourceName) return null;

  return {
    airtableRecordId: record.id,
    sourceName,
    sourceType: strField(f["Source Type"]) || strField(f["Type"]),
    cityArea:
      strField(f["City / Area"]) || strField(f["City"]) || strField(f["Area"]),
    website: strField(f["Website"]) || strField(f["Website URL"]),
    facebook: strField(f["Facebook"]) || strField(f["Facebook URL"]),
    sourceLink: strField(f["Source Link"]) || strField(f["URL"]),
    bestFor: strField(f["Best For"]) || strField(f["Notes"]),
    priority: strField(f["Priority"]),
    active: f["Active"] !== undefined ? boolField(f["Active"]) : true,
    lastCheckedDate: strField(f["Last Checked Date"]),
    notes: strField(f["Notes"]),
  };
}
