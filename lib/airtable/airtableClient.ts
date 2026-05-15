import { checkAirtableWriteAvailability } from "@/lib/ai/sacfamAgentEnv";

const AIRTABLE_API = "https://api.airtable.com/v0";
const AIRTABLE_BATCH_LIMIT = 10;

export interface AirtableSourceWorkflowConfig {
  apiKey: string;
  baseId: string;
  tables: {
    eventSources: string;
    sourceResearchRuns: string;
    sourceCandidates: string;
    eventCandidates: string;
  };
}

export interface AirtableRecord<TFields = Record<string, unknown>> {
  id: string;
  fields: TFields;
  createdTime?: string;
}

export type AirtableWorkflowAvailability =
  | { ok: true; config: AirtableSourceWorkflowConfig }
  | { ok: false; reason: string; message: string };

export function getAirtableSourceWorkflowConfig(): AirtableWorkflowAvailability {
  const availability = checkAirtableWriteAvailability();
  if (!availability.ok) {
    return {
      ok: false,
      reason: availability.reason ?? "airtable_unavailable",
      message: availability.message ?? "Airtable source workflow is unavailable.",
    };
  }
  return {
    ok: true,
    config: {
      apiKey: process.env.AIRTABLE_API_KEY?.trim() ?? "",
      baseId: process.env.AIRTABLE_BASE_ID?.trim() ?? "",
      tables: availability.config.airtableTables,
    },
  };
}

export async function airtableRequest<T>(
  config: AirtableSourceWorkflowConfig,
  tableName: string,
  init: RequestInit & { recordId?: string; query?: URLSearchParams } = {},
): Promise<T> {
  const query = init.query?.toString();
  const recordPath = init.recordId ? `/${encodeURIComponent(init.recordId)}` : "";
  const url = `${AIRTABLE_API}/${encodeURIComponent(config.baseId)}/${encodeURIComponent(
    tableName,
  )}${recordPath}${query ? `?${query}` : ""}`;
  const res = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${res.status}: ${text.slice(0, 500)}`);
  }
  return res.json() as Promise<T>;
}

export async function createAirtableRecords<TFields extends object>(
  config: AirtableSourceWorkflowConfig,
  tableName: string,
  fields: TFields[],
): Promise<AirtableRecord<TFields>[]> {
  const created: AirtableRecord<TFields>[] = [];
  for (let i = 0; i < fields.length; i += AIRTABLE_BATCH_LIMIT) {
    const chunk = fields.slice(i, i + AIRTABLE_BATCH_LIMIT);
    const result = await airtableRequest<{ records: AirtableRecord<TFields>[] }>(
      config,
      tableName,
      {
        method: "POST",
        body: JSON.stringify({
          records: chunk.map((row) => ({ fields: stripUndefined(row) })),
        }),
      },
    );
    created.push(...result.records);
  }
  return created;
}

export async function listAirtableRecords<TFields extends object>(
  config: AirtableSourceWorkflowConfig,
  tableName: string,
  filterByFormula?: string,
): Promise<AirtableRecord<TFields>[]> {
  const rows: AirtableRecord<TFields>[] = [];
  let offset: string | undefined;
  do {
    const query = new URLSearchParams();
    if (filterByFormula) query.set("filterByFormula", filterByFormula);
    if (offset) query.set("offset", offset);
    const result = await airtableRequest<{
      records: AirtableRecord<TFields>[];
      offset?: string;
    }>(config, tableName, { query });
    rows.push(...result.records);
    offset = result.offset;
  } while (offset);
  return rows;
}

export async function updateAirtableRecord<TFields extends object>(
  config: AirtableSourceWorkflowConfig,
  tableName: string,
  recordId: string,
  fields: TFields,
): Promise<AirtableRecord<TFields>> {
  return airtableRequest<AirtableRecord<TFields>>(config, tableName, {
    method: "PATCH",
    recordId,
    body: JSON.stringify({ fields: stripUndefined(fields) }),
  });
}

export function stripUndefined<TFields extends object>(
  fields: TFields,
): TFields {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined),
  ) as TFields;
}

export const __testing = { AIRTABLE_BATCH_LIMIT };
