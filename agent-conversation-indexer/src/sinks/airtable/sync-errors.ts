import type { NormalizedConversation } from "../../types";
import type { IndexerConfig, ResolvedPaths } from "../../config";
import { upsertRecord } from "./airtable-client";
import { hashContent, idFromDedupePart } from "../../parsing/hash-content";
import { A } from "./schema";

export function errorDedupeKey(conversationId: string, message: string): string {
  return hashContent(`${conversationId}|${message.toLowerCase().trim().slice(0, 400)}`);
}

export function buildErrorRecords(
  c: NormalizedConversation,
  _paths: ResolvedPaths,
): Array<{ fields: Record<string, unknown> }> {
  const now = new Date().toISOString();

  return c.errors.map((e) => {
    const dk = errorDedupeKey(c.id, e.message);
    const id = idFromDedupePart(dk, 24);
    return {
      fields: {
        [A.error.errorId]: id,
        [A.error.conversationId]: c.id,
        [A.error.projectName]: c.projectName,
        [A.error.errorType]: e.type ?? "unknown",
        [A.error.errorMessage]: e.message.slice(0, 8000),
        [A.error.command]: e.command ?? "",
        [A.error.filePath]: e.filePath ?? "",
        [A.error.resolution]: "",
        [A.error.status]: "unresolved",
        [A.error.createdAt]: now,
        [A.error.dedupeKey]: dk,
      },
    };
  });
}

export async function syncErrorsForConversation(
  cfg: IndexerConfig,
  tableName: string,
  c: NormalizedConversation,
  paths: ResolvedPaths,
): Promise<void> {
  for (const row of buildErrorRecords(c, paths)) {
    await upsertRecord(cfg, tableName, String(row.fields[A.error.dedupeKey]), row.fields);
  }
}
