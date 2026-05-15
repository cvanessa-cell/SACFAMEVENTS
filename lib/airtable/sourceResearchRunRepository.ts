import {
  createAirtableRecords,
  getAirtableSourceWorkflowConfig,
  updateAirtableRecord,
  type AirtableRecord,
} from "@/lib/airtable/airtableClient";

export interface AirtableSourceResearchRunFields {
  "Run ID": string;
  Status: string;
  "Requested Source Count": number;
  Model: string;
  "Prompt Version": string;
  "Started At"?: string;
  "Completed At"?: string;
  "Parsed Source Count"?: number;
  "Saved Candidate Count"?: number;
  "Duplicate Count"?: number;
  "Error Message"?: string;
  "Raw Response Preview"?: string;
}

export async function createSourceResearchRunRecord(
  fields: AirtableSourceResearchRunFields,
): Promise<{ ok: true; record: AirtableRecord<AirtableSourceResearchRunFields> } | { ok: false; message: string }> {
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  const [record] = await createAirtableRecords(
    availability.config,
    availability.config.tables.sourceResearchRuns,
    [fields],
  );
  return { ok: true, record };
}

export async function updateSourceResearchRunRecord(
  recordId: string | null | undefined,
  fields: Partial<AirtableSourceResearchRunFields>,
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (!recordId) return { ok: false, message: "No Airtable research-run record id was provided." };
  const availability = getAirtableSourceWorkflowConfig();
  if (!availability.ok) return { ok: false, message: availability.message };
  await updateAirtableRecord(
    availability.config,
    availability.config.tables.sourceResearchRuns,
    recordId,
    fields,
  );
  return { ok: true };
}

export function __getSourceResearchRunTableNameForTests(): string | null {
  const availability = getAirtableSourceWorkflowConfig();
  return availability.ok ? availability.config.tables.sourceResearchRuns : null;
}
