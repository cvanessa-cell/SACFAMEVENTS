import fs from "node:fs";
import path from "node:path";

import {
  assertAirtableForLive,
  assertLinear,
  assertNotion,
  getIndexerConfig,
  loadIndexerEnv,
  resolveAgainstRepoRoot,
  type IndexerConfig,
  type ResolvedPaths,
} from "./config";
import { createLogger } from "./logger";
import type { IndexerDryRunPayload, NormalizedConversation } from "./types";
import { collectRawSources, type SourceFilter } from "./sources/index";
import { normalizeConversation } from "./parsing/normalize-conversation";
import { summarizeConversation } from "./summarization/summarize-conversation";
import { ensureBaseSchema } from "./sinks/airtable/ensure-base-schema";
import { buildConversationFields, syncConversation } from "./sinks/airtable/sync-conversation";
import { buildFileRecords, syncFilesForConversation } from "./sinks/airtable/sync-files";
import { buildErrorRecords, syncErrorsForConversation } from "./sinks/airtable/sync-errors";
import { buildDecisionRecords, syncDecisionsForConversation } from "./sinks/airtable/sync-decisions";
import {
  actionDedupeKey,
  buildActionRecords,
  syncActionItemsForConversation,
} from "./sinks/airtable/sync-action-items";
import { writeProjectAgentIndex } from "./reports/generate-local-report";
import {
  eligibleActions,
  createLinearIssue,
  buildIssueBody,
} from "./sinks/linear/create-issues-from-actions";
import { findRecordByDedupeKey, updateRecord } from "./sinks/airtable/airtable-client";
import { syncConversationPage, syncSummaryPagesForDigest } from "./sinks/notion/sync-summary-page";
import { describeCursorStorageCandidates } from "./sources/optional-cursor-local-source";
import { A } from "./sinks/airtable/schema";

function normalizeExportText(raw: string, filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === ".json" || ext === ".jsonl") {
    try {
      if (ext === ".jsonl") {
        return raw
          .split(/\n/)
          .filter(Boolean)
          .map((ln) => {
            try {
              return JSON.stringify(JSON.parse(ln));
            } catch {
              return ln;
            }
          })
          .join("\n\n");
      }
      const j = JSON.parse(raw) as unknown;
      if (Array.isArray(j)) return JSON.stringify(j, null, 2);
      if (j && typeof j === "object" && "messages" in j) {
        return JSON.stringify((j as { messages: unknown }).messages, null, 2);
      }
      return JSON.stringify(j, null, 2);
    } catch {
      return raw;
    }
  }
  return raw;
}

export async function gatherNormalized(
  repoRoot: string,
  source: SourceFilter,
  cfgProvided?: IndexerConfig,
): Promise<{ cfg: IndexerConfig; paths: ResolvedPaths; conversations: NormalizedConversation[] }> {
  loadIndexerEnv(repoRoot);
  const cfg = cfgProvided ?? getIndexerConfig();
  const paths = resolveAgainstRepoRoot(repoRoot, cfg);
  const log = createLogger();

  if (cfg.indexerAllowCursorLocalScan && !cfg.cursorLocalAllowedPaths.length) {
    log.warn(
      "INDEXER_ALLOW_CURSOR_LOCAL_SCAN is true but CURSOR_LOCAL_ALLOWED_PATHS is empty — no local Cursor files will be read.",
    );
    describeCursorStorageCandidates(log);
  }

  let raw = collectRawSources({ cfg, paths, source });
  raw = raw.map((r) => ({
    ...r,
    rawText: normalizeExportText(r.rawText, r.sourcePath ?? "conversation.txt"),
  }));

  const redactOpts = {
    redactSecrets: cfg.indexerRedactSecrets,
    redactEmails: cfg.indexerRedactEmails,
    redactPhones: cfg.indexerRedactPhones,
  };

  const importedAt = new Date().toISOString();
  const normalized: NormalizedConversation[] = [];
  const dedupeSeen = new Set<string>();

  for (const payload of raw) {
    let n = normalizeConversation({
      ...payload,
      importedAtIso: importedAt,
      paths,
      redactOpts,
    });
    if (dedupeSeen.has(n.dedupeKey)) continue;
    dedupeSeen.add(n.dedupeKey);

    if (n.redactedText.length > cfg.indexerMaxConversationChars) {
      n = {
        ...n,
        redactedText: n.redactedText.slice(0, cfg.indexerMaxConversationChars),
        metadata: {
          ...n.metadata,
          truncatedChars: cfg.indexerMaxConversationChars,
        },
      };
    }

    n = await summarizeConversation(n, cfg);
    normalized.push(n);
  }

  return { cfg, paths, conversations: normalized };
}

function replacer(_k: string, v: unknown): unknown {
  if (typeof v === "string" && v.length > 80_000) return `${v.slice(0, 80_000)}…[truncated]`;
  return v;
}

function buildDryRunPayload(
  list: NormalizedConversation[],
  paths: ResolvedPaths,
  cfg: IndexerConfig,
): IndexerDryRunPayload {
  return {
    conversations: list,
    airtableConversationPayloads: list.map((c) => buildConversationFields(c, paths, "dry-run")),
    airtableChildren: {
      files: list.flatMap((c) => buildFileRecords(c, paths).map((x) => x.fields)),
      errors: list.flatMap((c) => buildErrorRecords(c, paths).map((x) => x.fields)),
      decisions: list.flatMap((c) =>
        buildDecisionRecords(c, paths).map((x) => x.fields),
      ),
      actions: list.flatMap((c) => buildActionRecords(c, paths).map((x) => x.fields)),
    },
    notionPlannedPages: cfg.notionEnabled ? (cfg.notionCreatePagePerConversation ? list.length : 1) : 0,
    linearPlannedIssues: cfg.linearEnabled
      ? list.reduce((acc, c) => acc + eligibleActions(c, cfg).length, 0)
      : 0,
  };
}

export async function runIndexer(opts: {
  repoRoot: string;
  source: SourceFilter;
  dryRunOverride?: boolean;
  skipExternal?: boolean;
}): Promise<{
  conversations: NormalizedConversation[];
  cfg: IndexerConfig;
  paths: ResolvedPaths;
  dryRunPayload?: IndexerDryRunPayload;
}> {
  loadIndexerEnv(opts.repoRoot);
  const cfg = getIndexerConfig();
  if (opts.dryRunOverride !== undefined) {
    (cfg as { indexerDryRun: boolean }).indexerDryRun = opts.dryRunOverride;
  }

  const { conversations, cfg: activeCfg, paths } = await gatherNormalized(
    opts.repoRoot,
    opts.source,
    cfg,
  );

  const log = createLogger();
  const dryPayload = buildDryRunPayload(conversations, paths, activeCfg);

  const airtErr = assertAirtableForLive(activeCfg);
  if (!activeCfg.indexerDryRun && airtErr) throw new Error(airtErr);

  if (!opts.skipExternal && !activeCfg.indexerDryRun) {
    const schemaProbe = await ensureBaseSchema(activeCfg, log);
    if (!schemaProbe.ok) log.warn(schemaProbe.message);
  }

  if (activeCfg.indexerDryRun || opts.skipExternal) {
    fs.mkdirSync(paths.outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(paths.outputDir, "dry-run-results.json"),
      JSON.stringify(dryPayload, replacer, 2),
      "utf8",
    );
    log.info(`Wrote ${path.join(paths.outputDir, "dry-run-results.json")}`);
    return { conversations, cfg: activeCfg, paths, dryRunPayload: dryPayload };
  }

  if (!activeCfg.airtableApiKey || !activeCfg.airtableBaseId) {
    throw new Error("Airtable API key/base id required for live sync");
  }

  const syncReport: Record<string, unknown> = {
    startedAt: new Date().toISOString(),
    conversations: [] as string[],
    errors: [] as string[],
  };

  for (const c of conversations) {
    try {
      await syncConversation(activeCfg, activeCfg.airtableConversationsTable, c, paths);
      (syncReport.conversations as string[]).push(c.id);

      await syncFilesForConversation(activeCfg, activeCfg.airtableFilesTable, c, paths);
      await syncErrorsForConversation(activeCfg, activeCfg.airtableErrorsTable, c, paths);
      await syncDecisionsForConversation(activeCfg, activeCfg.airtableDecisionsTable, c, paths);
      await syncActionItemsForConversation(activeCfg, activeCfg.airtableActionItemsTable, c, paths);
    } catch (e) {
      (syncReport.errors as string[]).push(`${c.id}: ${(e as Error).message}`);
      log.error(`Sync failed for ${c.id}`, (e as Error).message);
    }
  }

  syncReport.finishedAt = new Date().toISOString();
  fs.mkdirSync(paths.outputDir, { recursive: true });
  fs.writeFileSync(path.join(paths.outputDir, "sync-report.json"), JSON.stringify(syncReport, null, 2), "utf8");

  return { conversations, cfg: activeCfg, paths };
}

export async function runNotionSync(repoRoot: string, source: SourceFilter): Promise<void> {
  loadIndexerEnv(repoRoot);
  const cfgBefore = getIndexerConfig();
  const err = assertNotion(cfgBefore);
  if (err) throw new Error(err);
  if (!cfgBefore.notionEnabled) throw new Error("NOTION_ENABLED is not true");

  const { conversations, cfg, paths } = await gatherNormalized(repoRoot, source);
  const log = createLogger();

  if (cfg.indexerDryRun) {
    log.info("[dry-run] Notion writes skipped (INDEXER_DRY_RUN=true).");
    return;
  }

  if (cfg.notionCreatePagePerConversation) {
    for (const c of conversations) {
      await syncConversationPage({ cfg, c });
    }
  } else {
    await syncSummaryPagesForDigest({ cfg, paths, conversations });
  }
}

export async function runLinearSync(repoRoot: string, source: SourceFilter): Promise<void> {
  loadIndexerEnv(repoRoot);
  const cfg = getIndexerConfig();
  const linErr = assertLinear(cfg);
  if (linErr) throw new Error(linErr);
  if (!cfg.linearEnabled) throw new Error("LINEAR_ENABLED is not true");
  if (cfg.indexerDryRun) throw new Error("Set INDEXER_DRY_RUN=false to allow Linear writes and Airtable action updates.");

  const airtErr = assertAirtableForLive(cfg);
  if (airtErr) throw new Error(airtErr);
  if (!cfg.airtableApiKey || !cfg.airtableBaseId) throw new Error("Linear sync needs AIRTABLE_* to update Action Items.");

  const { conversations } = await gatherNormalized(repoRoot, source);
  const log = createLogger();

  for (const c of conversations) {
    const actions = eligibleActions(c, cfg).slice(0, 8);
    for (const a of actions) {
      try {
        const title = `[Agent Index] ${a.title}`.slice(0, 240);
        const body = buildIssueBody(c, a);
        const created = await createLinearIssue({ cfg, title, descriptionMd: body });
        if (!created) continue;

        const dk = actionDedupeKey(c.id, a.title);
        const found = await findRecordByDedupeKey(cfg, cfg.airtableActionItemsTable, dk);
        if (found) {
          await updateRecord(cfg, cfg.airtableActionItemsTable, found.id, {
            [A.action.linearIssueUrl]: created.url,
            [A.action.status]: "sent_to_linear",
            [A.action.updatedAt]: new Date().toISOString(),
          });
        }
        log.info(`Linear issue ${created.identifier}`);
      } catch (e) {
        log.error("Linear row failed", (e as Error).message);
      }
    }
  }
}

export async function generateReportOnly(repoRoot: string, source: SourceFilter): Promise<void> {
  const { conversations, cfg, paths } = await gatherNormalized(repoRoot, source);

  writeProjectAgentIndex(path.join(paths.outputDir, "project-agent-index.md"), {
    cfg,
    paths,
    conversations,
    lastSyncDryRun: cfg.indexerDryRun,
    lastLinearCreated: cfg.linearEnabled ? 0 : 0,
    lastNotionPages: 0,
  });
}
