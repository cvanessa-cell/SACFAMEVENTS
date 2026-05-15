import fs from "node:fs";
import path from "node:path";

import type { NormalizedConversation } from "../../types";
import type { IndexerConfig, ResolvedPaths } from "../../config";
import { upsertRecord } from "./airtable-client";
import { hashContent, idFromDedupePart } from "../../parsing/hash-content";
import { A } from "./schema";

export function fileDedupeKey(conversationId: string, fp: string, mention: string): string {
  return hashContent(`${conversationId}|${fp}|${mention}`);
}

function existsLocally(paths: ResolvedPaths, filePath: string): boolean {
  const clean = filePath.replace(/\\/g, "/");
  const abs = path.isAbsolute(clean)
    ? clean
    : path.resolve(paths.projectRootResolved, clean);
  try {
    return fs.existsSync(abs) && fs.statSync(abs).isFile();
  } catch {
    return false;
  }
}

export function buildFileRecords(
  c: NormalizedConversation,
  paths: ResolvedPaths,
): Array<{ fields: Record<string, unknown> }> {
  const now = new Date().toISOString();
  return c.filesReferenced.map((f) => {
    const dk = fileDedupeKey(c.id, f.filePath, f.mentionType);
    const id = idFromDedupePart(dk, 24);

    return {
      fields: {
        [A.fileRef.fileRefId]: id,
        [A.fileRef.conversationId]: c.id,
        [A.fileRef.projectName]: c.projectName,
        [A.fileRef.filePath]: f.filePath,
        [A.fileRef.mentionType]: f.mentionType,
        [A.fileRef.changeType]: f.mentionType,
        [A.fileRef.summary]: f.summary ?? "",
        [A.fileRef.existsLocally]: existsLocally(paths, f.filePath),
        [A.fileRef.createdAt]: now,
        [A.fileRef.dedupeKey]: dk,
      },
    };
  });
}

export async function syncFilesForConversation(
  cfg: IndexerConfig,
  tableName: string,
  c: NormalizedConversation,
  paths: ResolvedPaths,
): Promise<void> {
  for (const row of buildFileRecords(c, paths)) {
    await upsertRecord(cfg, tableName, String(row.fields[A.fileRef.dedupeKey]), row.fields);
  }
}
