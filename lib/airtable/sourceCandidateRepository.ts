import type { SourceResearchCandidatePayload } from "@/lib/ai/schemas/sourceResearchSchema";
import {
  createAirtableRecords,
  getAirtableSourceWorkflowConfig,
  listAirtableRecords,
  updateAirtableRecord,
  type AirtableRecord,
} from "@/lib/airtable/airtableClient";
import { createDuplicateCheckKey } from "@/lib/sources/sourceDeduplication";

export interface AirtableSourceCandidateFields {
  "Candidate ID": string;
  "Research Run ID": string;
  "Source Name": string;
  "Website / Social Link": string;
  "Source Category": string;
  "Source Type": string;
  "City / Area Served"?: string;
  "County / Region"?: string;
  "Event Types": string;
  "Family Relevance": string;
  "Why Useful for SacFamEvents": string;
  "Estimated Update Frequency"?: string;
  "Freshness Likelihood": string;
  "Automation Fit": string;
  "Recommended Ingestion Method": string;
  "Review Priority": string;
  "Relevance Score": number;
  "Verification Status": string;
  Status: string;
  Notes?: string;
  "Duplicate Check Key": string;
  "Duplicate Of"?: string;
  "Import Status": string;
}

export interface SourceCandidateRecordInput {
  candidateId: string;
  runId: string;
  payload: SourceResearchCandidatePayload;
  duplicateOf?: string | null;
  importStatus: string;
}

export function mapCandidateToAirtableFields(
  input: SourceCandidateRecordInput,
): AirtableSourceCandidateFields {
  return {
    "Candidate ID": input.candidateId,
    "Research Run ID": input.runId,
    "Source Name": input.payload.source_name,
    "Website / Social Link": input.payload.source_url,
    "Source Category": input.payload.source_category,
    "Source Type": input.payload.source_type,
    "City / Area Served": input.payload.city_or_area_served ?? undefined,
    "County / Region": input.payload.county_or_region ?? undefined,
    "Event Types": input.payload.event_types.join(", "),
    "Family Relevance": input.payload.family_relevance,
    "Why Useful for SacFamEvents": input.payload.why_useful_for_sacfam_events,
    "Estimated Update Frequency": input.payload.estimated_update_frequency ?? undefined,
    "Freshness Likelihood": input.payload.freshness_likelihood,
    "Automation Fit": input.payload.automation_fit,
    "Recommended Ingestion Method": input.payload.recommended_ingestion_method,
    "Review Priority": input.payload.review_priority,
    "Relevance Score": input.payload.relevance_score,
    "Verification Status": input.payload.verification_status,
    Status: input.payload.status,
    Notes: input.payload.notes ?? undefined,
    "Duplicate Check Key": createDuplicateCheckKey({
      sourceUrl: input.payload.source_url,
      sourceName: input.payload.source_name,
      cityOrAreaServed: input.payload.city_or_area_served,
    }),
    "Duplicate Of": input.duplicateOf ?? undefined,
    "Import Status": input.importStatus,
  };
}

export async function createSourceCandidateRecords(
  inputs: SourceCandidateRecordInput[],
): Promise<{ ok: true; records: AirtableRecord<AirtableSourceCandidateFields>[] } | { ok: false; message: string }> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  const records = await createAirtableRecords(
    availability.config,
    availability.config.tables.sourceCandidates,
    inputs.map(mapCandidateToAirtableFields),
  );
  return { ok: true, records };
}

export async function listSourceCandidateRecords(): Promise<
  { ok: true; records: AirtableRecord<AirtableSourceCandidateFields>[] } | { ok: false; message: string }
> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  const records = await listAirtableRecords<AirtableSourceCandidateFields>(
    availability.config,
    availability.config.tables.sourceCandidates,
  );
  return { ok: true, records };
}

export async function updateSourceCandidateRecord(
  recordId: string,
  fields: Partial<AirtableSourceCandidateFields>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  await updateAirtableRecord(
    availability.config,
    availability.config.tables.sourceCandidates,
    recordId,
    fields,
  );
  return { ok: true };
}

export async function updateSourceCandidateByCandidateId(
  candidateId: string,
  fields: Partial<AirtableSourceCandidateFields>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const records = await listSourceCandidateRecords();
  if (!records.ok) return records;
  const record = records.records.find(
    (row) => row.fields["Candidate ID"] === candidateId,
  );
  if (!record) {
    return { ok: false, message: `Airtable candidate ${candidateId} was not found.` };
  }
  return updateSourceCandidateRecord(record.id, fields);
}
