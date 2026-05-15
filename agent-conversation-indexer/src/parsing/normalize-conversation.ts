import type { ResolvedPaths } from "../config";
import type { NormalizedConversation, ReferencedFile, RawSourcePayload, SourceKind } from "../types";
import { hashContent, idFromDedupePart } from "./hash-content";
import { redactSensitiveData, type RedactOptions } from "./redact-sensitive-data";
import { extractActionItems } from "./extract-actions";
import { extractCommands } from "./extract-commands";
import { extractDecisions } from "./extract-decisions";
import { extractErrors } from "./extract-errors";
import { extractFileReferences } from "./extract-code-references";
import { extractTags, extractUserRequest } from "./extract-metadata";

function mergeFiles(a: ReferencedFile[], b: ReferencedFile[]): ReferencedFile[] {
  const m = new Map<string, ReferencedFile>();
  for (const x of [...a, ...b]) {
    const k = `${x.filePath}:${x.mentionType}`;
    if (!m.has(k)) m.set(k, x);
  }
  return [...m.values()];
}

export type NormalizeInput = RawSourcePayload & {
  importedAtIso: string;
  paths: ResolvedPaths;
  redactOpts: RedactOptions;
};

export function normalizeConversation(input: NormalizeInput): NormalizedConversation {
  const rawText = input.rawText;
  const redactedText = redactSensitiveData(rawText, input.redactOpts);
  const contentHash = hashContent(redactedText);

  const proj = input.paths.projectName;
  const anchor = `${input.sourcePath ?? input.sourceUrl ?? "unknown"}`;
  const dedupeKey = `${proj}|${anchor}|${contentHash}`;
  const id = idFromDedupePart(dedupeKey, 32);

  const filesReferenced = extractFileReferences(redactedText);
  const commandsRun = extractCommands(redactedText);
  const errors = extractErrors(redactedText);
  const decisions = extractDecisions(redactedText);
  const actionItems = extractActionItems(redactedText);

  const userRequest = extractUserRequest(redactedText);
  const tags = extractTags(redactedText, []);

  return {
    id,
    projectName: proj,
    projectRoot: input.paths.projectRootResolved,
    sourceType: input.sourceType as SourceKind,
    sourcePath: input.sourcePath,
    sourceUrl: input.sourceUrl,
    title: input.suggestedTitle,
    conversationDate: input.conversationDate,
    importedAt: input.importedAtIso,
    rawText,
    redactedText,
    contentHash,
    dedupeKey,
    userRequest,
    filesReferenced: mergeFiles([], filesReferenced),
    commandsRun,
    errors,
    decisions,
    actionItems,
    tags,
    metadata: { ...(input.metadata ?? {}) },
  };
}
