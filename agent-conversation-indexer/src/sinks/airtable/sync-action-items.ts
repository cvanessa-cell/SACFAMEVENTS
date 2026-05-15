import type { NormalizedConversation } from "../../types";
import type { IndexerConfig, ResolvedPaths } from "../../config";
import { upsertRecord } from "./airtable-client";
import { hashContent, idFromDedupePart } from "../../parsing/hash-content";
import { A } from "./schema";

export function actionDedupeKey(conversationId: string, title: string): string {
  const n = title.toLowerCase().trim().slice(0, 200);
  return hashContent(`${conversationId}|${n}`);
}

export function buildActionRecords(
  c: NormalizedConversation,
  _paths: ResolvedPaths,
): Array<{ fields: Record<string, unknown>; dedupe: string }> {
  const now = new Date().toISOString();
  return c.actionItems.map((a) => {
    const dk = actionDedupeKey(c.id, a.title);
    const id = idFromDedupePart(dk, 24);
    return {
      dedupe: dk,
      fields: {
        [A.action.actionId]: id,
        [A.action.conversationId]: c.id,
        [A.action.projectName]: c.projectName,
        [A.action.title]: a.title,
        [A.action.description]: a.description ?? "",
        [A.action.priority]: a.priority ?? "medium",
        [A.action.status]: a.status ?? "new",
        [A.action.type]: a.type,
        [A.action.relatedFile]: a.relatedFile ?? "",
        [A.action.relatedFeature]: "",
        [A.action.suggestedOwner]: "",
        [A.action.dueDate]: "",
        [A.action.linearIssueUrl]: "",
        [A.action.createdAt]: now,
        [A.action.updatedAt]: now,
        [A.action.dedupeKey]: dk,
        [A.action.confidence]: a.confidence,
      },
    };
  });
}

export async function syncActionItemsForConversation(
  cfg: IndexerConfig,
  tableName: string,
  c: NormalizedConversation,
  paths: ResolvedPaths,
): Promise<void> {
  for (const row of buildActionRecords(c, paths)) {
    await upsertRecord(cfg, tableName, row.dedupe, row.fields);
  }
}
