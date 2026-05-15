import type { IndexerConfig } from "../../config";

const AIRTABLE = "https://api.airtable.com/v0";

export type AirtableRecord<T = Record<string, unknown>> = {
  id: string;
  fields: T;
  createdTime?: string;
};

function escapeFormulaLiteral(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

async function fetchWithBackoff(
  url: string,
  init: RequestInit & { apiKey: string },
  label: string,
): Promise<Response> {
  let delay = 500;
  for (let attempt = 0; attempt < 6; attempt++) {
    const res = await fetch(url, {
      ...init,
      headers: {
        Authorization: `Bearer ${init.apiKey}`,
        "Content-Type": "application/json",
        ...(init.headers ?? {}),
      },
    });
    if (res.status !== 429) return res;

    await new Promise((r) => setTimeout(r, delay));
    delay = Math.min(delay * 2, 10_000);
  }
  throw new Error(`Airtable rate limited after retries: ${label}`);
}

async function airtableJson<T>(
  cfg: Pick<IndexerConfig, "airtableApiKey" | "airtableBaseId">,
  path: string,
  init?: Omit<RequestInit, "headers"> & { apiKey?: string; method?: string; body?: string },
): Promise<T> {
  const key = cfg.airtableApiKey ?? "";
  const res = await fetchWithBackoff(
    `${AIRTABLE}/${cfg.airtableBaseId}${path}`,
    {
      ...init,
      apiKey: key,
      headers: { "Content-Type": "application/json" },
    } as RequestInit & { apiKey: string },
    `${init?.method ?? "GET"} ${path}`,
  );

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Airtable ${init?.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 600)}`);
  }
  if (res.status === 204) return {} as T;
  return res.json() as Promise<T>;
}

export async function findRecordByDedupeKey(
  cfg: IndexerConfig,
  tableName: string,
  dedupeKey: string,
): Promise<AirtableRecord | null> {
  const filter = `({Dedupe Key}="${escapeFormulaLiteral(dedupeKey)}")`;
  const q = new URLSearchParams({
    filterByFormula: filter,
    maxRecords: "1",
  });
  const data = await airtableJson<{ records: AirtableRecord[] }>(cfg, `/${encodeURIComponent(tableName)}?${q}`);
  return data.records[0] ?? null;
}

export async function createRecord(
  cfg: IndexerConfig,
  tableName: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const data = await airtableJson<{ records: AirtableRecord[] }>(cfg, `/${encodeURIComponent(tableName)}`, {
    method: "POST",
    body: JSON.stringify({ fields }),
  });
  return data.records[0];
}

export async function updateRecord(
  cfg: IndexerConfig,
  tableName: string,
  recordId: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const data = await airtableJson<{ records: AirtableRecord[] }>(
    cfg,
    `/${encodeURIComponent(tableName)}/${recordId}`,
    { method: "PATCH", body: JSON.stringify({ fields }) },
  );
  return data.records[0];
}

export async function upsertRecord(
  cfg: IndexerConfig,
  tableName: string,
  dedupeKey: string,
  fields: Record<string, unknown>,
): Promise<AirtableRecord> {
  const existing = await findRecordByDedupeKey(cfg, tableName, dedupeKey);
  if (existing) {
    return updateRecord(cfg, tableName, existing.id, fields);
  }
  return createRecord(cfg, tableName, fields);
}

const BATCH = 10;

export async function batchCreateRecords(
  cfg: IndexerConfig,
  tableName: string,
  rows: Array<Record<string, unknown>>,
  onRowError: (row: number, err: Error) => void,
): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  for (let i = 0; i < rows.length; i += BATCH) {
    const chunk = rows.slice(i, i + BATCH);
    try {
      const data = await airtableJson<{ records: AirtableRecord[] }>(
        cfg,
        `/${encodeURIComponent(tableName)}`,
        {
          method: "POST",
          body: JSON.stringify({ records: chunk.map((fields) => ({ fields })) }),
        },
      );
      out.push(...data.records);
    } catch (e) {
      for (let j = 0; j < chunk.length; j++) {
        onRowError(i + j, e as Error);
      }
    }
  }
  return out;
}

export async function batchUpdateRecords(
  cfg: IndexerConfig,
  tableName: string,
  updates: Array<{ id: string; fields: Record<string, unknown> }>,
  onRowError: (row: number, err: Error) => void,
): Promise<AirtableRecord[]> {
  const out: AirtableRecord[] = [];
  for (let i = 0; i < updates.length; i += BATCH) {
    const chunk = updates.slice(i, i + BATCH);
    try {
      const data = await airtableJson<{ records: AirtableRecord[] }>(
        cfg,
        `/${encodeURIComponent(tableName)}`,
        {
          method: "PATCH",
          body: JSON.stringify({ records: chunk.map((u) => ({ id: u.id, fields: u.fields })) }),
        },
      );
      out.push(...data.records);
    } catch (e) {
      for (let j = 0; j < chunk.length; j++) {
        onRowError(i + j, e as Error);
      }
    }
  }
  return out;
}

export async function listMetaTables(cfg: IndexerConfig): Promise<{ name: string }[] | null> {
  try {
    const res = await fetchWithBackoff(
      `https://api.airtable.com/v0/meta/bases/${cfg.airtableBaseId}/tables`,
      {
        method: "GET",
        apiKey: cfg.airtableApiKey ?? "",
      } as RequestInit & { apiKey: string },
      "meta tables",
    );
    if (!res.ok) return null;
    const j = (await res.json()) as { tables?: { name: string }[] };
    return j.tables?.map((t) => ({ name: t.name })) ?? [];
  } catch {
    return null;
  }
}
