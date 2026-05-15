import {
  createAirtableRecords,
  getAirtableSourceWorkflowConfig,
  listAirtableRecords,
  updateAirtableRecord,
  type AirtableRecord,
} from "@/lib/airtable/airtableClient";
import type { AirtableSourceCandidateFields } from "@/lib/airtable/sourceCandidateRepository";
import { createDuplicateCheckKey } from "@/lib/sources/sourceDeduplication";

export interface AirtableEventSourceFields {
  "Source Name": string;
  "Website / Social Link": string;
  "Source Category"?: string;
  "Source Type"?: string;
  "City / Area Served"?: string;
  "County / Region"?: string;
  "Event Types"?: string;
  "Family Relevance"?: string;
  "Why Useful for SacFamEvents"?: string;
  "Estimated Update Frequency"?: string;
  "Freshness Likelihood"?: string;
  "Automation Fit"?: string;
  "Recommended Ingestion Method"?: string;
  "Review Priority"?: string;
  "Relevance Score"?: number;
  "Verification Status"?: string;
  Status?: string;
  Notes?: string;
  "Last Checked At"?: string;
  "Created By AI"?: boolean;
  "Research Run ID"?: string;
  "Duplicate Check Key"?: string;
}

export interface ExistingAirtableSourceForDedupe {
  id: string;
  name: string;
  sourceUrl: string;
  city?: string | null;
  category?: string | null;
}

export function mapCandidateFieldsToEventSource(
  candidate: AirtableSourceCandidateFields,
  overrides: Partial<AirtableEventSourceFields> = {},
): AirtableEventSourceFields {
  return {
    "Source Name": candidate["Source Name"],
    "Website / Social Link": candidate["Website / Social Link"],
    "Source Category": candidate["Source Category"],
    "Source Type": candidate["Source Type"],
    "City / Area Served": candidate["City / Area Served"],
    "County / Region": candidate["County / Region"],
    "Event Types": candidate["Event Types"],
    "Family Relevance": candidate["Family Relevance"],
    "Why Useful for SacFamEvents": candidate["Why Useful for SacFamEvents"],
    "Estimated Update Frequency": candidate["Estimated Update Frequency"],
    "Freshness Likelihood": candidate["Freshness Likelihood"],
    "Automation Fit": candidate["Automation Fit"],
    "Recommended Ingestion Method": candidate["Recommended Ingestion Method"],
    "Review Priority": candidate["Review Priority"],
    "Relevance Score": candidate["Relevance Score"],
    "Verification Status": candidate["Verification Status"],
    Status: "approved",
    Notes: candidate.Notes,
    "Created By AI": true,
    "Research Run ID": candidate["Research Run ID"],
    "Duplicate Check Key": candidate["Duplicate Check Key"],
    ...overrides,
  };
}

export async function listEventSourceRecords(): Promise<
  { ok: true; records: AirtableRecord<AirtableEventSourceFields>[] } | { ok: false; message: string }
> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  const records = await listAirtableRecords<AirtableEventSourceFields>(
    availability.config,
    availability.config.tables.eventSources,
  );
  return { ok: true, records };
}

export async function listExistingAirtableSourcesForDedupe(): Promise<ExistingAirtableSourceForDedupe[]> {
  const result = await listEventSourceRecords();
  if (!result.ok) return [];
  return result.records.map((record) => ({
    id: record.id,
    name: record.fields["Source Name"] ?? "",
    sourceUrl: record.fields["Website / Social Link"] ?? "",
    city: record.fields["City / Area Served"] ?? null,
    category: record.fields["Source Category"] ?? null,
  }));
}

export async function createEventSourceRecord(
  fields: AirtableEventSourceFields,
): Promise<{ ok: true; record: AirtableRecord<AirtableEventSourceFields> } | { ok: false; message: string }> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  const duplicateKey =
    fields["Duplicate Check Key"] ||
    createDuplicateCheckKey({
      sourceUrl: fields["Website / Social Link"],
      sourceName: fields["Source Name"],
      cityOrAreaServed: fields["City / Area Served"],
    });
  const [record] = await createAirtableRecords(
    availability.config,
    availability.config.tables.eventSources,
    [{ ...fields, "Duplicate Check Key": duplicateKey }],
  );
  return { ok: true, record };
}

export async function updateEventSourceRecord(
  recordId: string,
  fields: Partial<AirtableEventSourceFields>,
): Promise<{ ok: true; record: AirtableRecord<Partial<AirtableEventSourceFields>> } | { ok: false; message: string }> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  const record = await updateAirtableRecord(
    availability.config,
    availability.config.tables.eventSources,
    recordId,
    fields,
  );
  return { ok: true, record };
}
