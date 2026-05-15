import type { NormalizedConversation } from "../../types";
import type { IndexerConfig, ResolvedPaths } from "../../config";
import { upsertRecord } from "./airtable-client";
import { hashContent, idFromDedupePart } from "../../parsing/hash-content";
import { A } from "./schema";

export function decisionDedupeKey(conversationId: string, text: string): string {
  return hashContent(`${conversationId}|${text.toLowerCase().trim().slice(0, 240)}`);
}

export function buildDecisionRecords(
  c: NormalizedConversation,
  _paths: ResolvedPaths,
): Array<{ fields: Record<string, unknown>; dedupe: string }> {
  const now = new Date().toISOString();
  return c.decisions.map((d) => {
    const dk = decisionDedupeKey(c.id, d.text);
    const id = idFromDedupePart(dk, 24);
    return {
      dedupe: dk,
      fields: {
        [A.decision.decisionId]: id,
        [A.decision.conversationId]: c.id,
        [A.decision.projectName]: c.projectName,
        [A.decision.decision]: d.text,
        [A.decision.rationale]: d.rationale ?? "",
        [A.decision.relatedFeature]: d.relatedFeature ?? "",
        [A.decision.relatedFile]: d.relatedFile ?? "",
        [A.decision.createdAt]: now,
        [A.decision.dedupeKey]: dk,
      },
    };
  });
}

export async function syncDecisionsForConversation(
  cfg: IndexerConfig,
  tableName: string,
  c: NormalizedConversation,
  paths: ResolvedPaths,
): Promise<void> {
  for (const row of buildDecisionRecords(c, paths)) {
    await upsertRecord(cfg, tableName, row.dedupe, row.fields);
  }
}
