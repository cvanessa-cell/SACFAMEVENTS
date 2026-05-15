import type { NormalizedConversation } from "../../types";
import type { IndexerConfig, ResolvedPaths } from "../../config";
import { upsertRecord } from "./airtable-client";
import { A } from "./schema";

export function buildConversationFields(
  c: NormalizedConversation,
  paths: ResolvedPaths,
  syncNotes?: string,
): Record<string, unknown> {
  const now = new Date().toISOString();
  const plainTags = c.tags.slice(0, 40).join(", ");

  return {
    [A.conversation.conversationId]: c.id,
    [A.conversation.projectName]: c.projectName,
    [A.conversation.projectRoot]: paths.projectRootResolved,
    [A.conversation.sourceType]: c.sourceType,
    [A.conversation.sourcePath]: c.sourcePath ?? "",
    [A.conversation.sourceUrl]: c.sourceUrl ?? "",
    [A.conversation.conversationTitle]: c.title ?? "",
    [A.conversation.conversationDate]: c.conversationDate ?? now,
    [A.conversation.importedAt]: c.importedAt,
    [A.conversation.lastSyncedAt]: now,
    [A.conversation.contentHash]: c.contentHash,
    [A.conversation.dedupeKey]: c.dedupeKey,
    [A.conversation.status]: "indexed",
    [A.conversation.agentName]: c.agentName ?? "",
    [A.conversation.userRequest]: c.userRequest ?? "",
    [A.conversation.shortSummary]: c.shortSummary ?? "",
    [A.conversation.detailedSummary]: c.detailedSummary ?? "",
    [A.conversation.keyOutcome]: c.keyOutcome ?? "",
    [A.conversation.currentState]: c.currentState ?? "",
    [A.conversation.filesChangedCount]: c.filesReferenced.length,
    [A.conversation.commandsRunCount]: c.commandsRun.length,
    [A.conversation.errorsCount]: c.errors.length,
    [A.conversation.decisionsCount]: c.decisions.length,
    [A.conversation.actionItemsCount]: c.actionItems.length,
    [A.conversation.tags]: plainTags,
    [A.conversation.relatedFeature]: String(c.metadata["relatedFeature"] ?? ""),
    [A.conversation.relatedRoute]: String(c.metadata["relatedRoute"] ?? ""),
    [A.conversation.relatedApiEndpoint]: String(c.metadata["relatedApiEndpoint"] ?? ""),
    [A.conversation.relatedDatabaseTable]: String(c.metadata["relatedDatabaseTable"] ?? ""),
    [A.conversation.relatedMigration]: String(c.metadata["relatedMigration"] ?? ""),
    [A.conversation.relatedProvider]: String(c.metadata["relatedProvider"] ?? ""),
    [A.conversation.relatedUiPage]: String(c.metadata["relatedUiPage"] ?? ""),
    [A.conversation.hasBuildOutput]: /\b(build|compile|esbuild|webpack|turbopack)\b/i.test(c.redactedText),
    [A.conversation.hasTestOutput]: /\b(vitest|jest|pytest|test failed|tests run)\b/i.test(c.redactedText),
    [A.conversation.hasErrors]: c.errors.length > 0,
    [A.conversation.needsFollowUp]: c.actionItems.some((a) => a.confidence >= 0.65),
    [A.conversation.rawTranscriptRedacted]: c.redactedText.slice(0, 90_000),
    [A.conversation.localRawFilePath]: c.sourcePath ?? "",
    [A.conversation.notionPageUrl]: String(c.metadata["notionPageUrl"] ?? ""),
    [A.conversation.linearIssuesCreated]: String(c.metadata["linearIssuesCreated"] ?? ""),
    [A.conversation.syncNotes]: syncNotes ?? "",
  };
}

export async function syncConversation(
  cfg: IndexerConfig,
  tableName: string,
  c: NormalizedConversation,
  paths: ResolvedPaths,
): Promise<void> {
  const fields = buildConversationFields(c, paths);
  await upsertRecord(cfg, tableName, c.dedupeKey, fields);
}
