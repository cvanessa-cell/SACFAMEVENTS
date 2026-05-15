import path from "node:path";

import { config as loadEnv } from "dotenv";
import { z } from "zod";

/** agent-conversation-indexer/src/config.ts → package root */
export const INDEXER_PKG_ROOT = path.resolve(__dirname, "..");

export function loadIndexerEnv(repoRootEnvPath?: string): void {
  loadEnv({ path: path.join(INDEXER_PKG_ROOT, ".env") });
  const rootCandidate = repoRootEnvPath ?? path.resolve(INDEXER_PKG_ROOT, "..");
  loadEnv({ path: path.join(rootCandidate, ".env") });
}

const boolFrom = (def: boolean) =>
  z
    .string()
    .optional()
    .transform((v) => {
      if (v === undefined || v === "") return def;
      return v === "true" || v === "1";
    });

const csvPaths = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(",")
          .map((s) => s.trim())
          .filter(Boolean)
      : [],
  );

export const indexerConfigSchema = z.object({
  airtableApiKey: z.string().optional(),
  airtableBaseId: z.string().optional(),
  airtableConversationsTable: z.string().default("Agent Conversations"),
  airtableActionItemsTable: z.string().default("Agent Action Items"),
  airtableFilesTable: z.string().default("Agent Referenced Files"),
  airtableErrorsTable: z.string().default("Agent Errors"),
  airtableDecisionsTable: z.string().default("Agent Decisions"),

  notionApiKey: z.string().optional(),
  notionParentPageId: z.string().optional(),
  notionEnabled: boolFrom(false),
  notionCreatePagePerConversation: boolFrom(false),

  linearApiKey: z.string().optional(),
  linearTeamId: z.string().optional(),
  linearProjectId: z.string().optional(),
  linearEnabled: boolFrom(false),
  linearActionConfidenceThreshold: z.coerce.number().min(0).max(1).default(0.6),

  openaiApiKey: z.string().optional(),
  openaiSummarizationEnabled: boolFrom(false),
  openaiSummaryModel: z.string().default("gpt-4.1-mini"),

  indexerProjectName: z.string().optional(),
  indexerProjectRoot: z.string().optional(),
  indexerImportDir: z.string().default("./agent-conversation-indexer/imports"),
  indexerOutputDir: z.string().default("./agent-conversation-indexer/output"),
  indexerDryRun: boolFrom(true),
  indexerAllowCursorLocalScan: boolFrom(false),
  indexerRedactSecrets: boolFrom(true),
  indexerRedactEmails: boolFrom(false),
  indexerRedactPhones: boolFrom(false),
  indexerMaxConversationChars: z.coerce.number().int().positive().default(200_000),

  cursorLocalAllowedPaths: csvPaths,
});

export type IndexerConfig = z.infer<typeof indexerConfigSchema>;

export function readProcessEnv(): Record<string, string | undefined> {
  return {
    airtableApiKey: process.env.AIRTABLE_API_KEY,
    airtableBaseId: process.env.AIRTABLE_BASE_ID,
    airtableConversationsTable: process.env.AIRTABLE_CONVERSATIONS_TABLE,
    airtableActionItemsTable: process.env.AIRTABLE_ACTION_ITEMS_TABLE,
    airtableFilesTable: process.env.AIRTABLE_FILES_TABLE,
    airtableErrorsTable: process.env.AIRTABLE_ERRORS_TABLE,
    airtableDecisionsTable: process.env.AIRTABLE_DECISIONS_TABLE,

    notionApiKey: process.env.NOTION_API_KEY,
    notionParentPageId: process.env.NOTION_PARENT_PAGE_ID,
    notionEnabled: process.env.NOTION_ENABLED,
    notionCreatePagePerConversation: process.env.NOTION_CREATE_PAGE_PER_CONVERSATION,

    linearApiKey: process.env.LINEAR_API_KEY,
    linearTeamId: process.env.LINEAR_TEAM_ID,
    linearProjectId: process.env.LINEAR_PROJECT_ID,
    linearEnabled: process.env.LINEAR_ENABLED,
    linearActionConfidenceThreshold: process.env.LINEAR_ACTION_CONFIDENCE_THRESHOLD,

    openaiApiKey: process.env.OPENAI_API_KEY,
    openaiSummarizationEnabled: process.env.OPENAI_SUMMARIZATION_ENABLED,
    openaiSummaryModel: process.env.OPENAI_SUMMARY_MODEL,

    indexerProjectName: process.env.INDEXER_PROJECT_NAME,
    indexerProjectRoot: process.env.INDEXER_PROJECT_ROOT,
    indexerImportDir: process.env.INDEXER_IMPORT_DIR,
    indexerOutputDir: process.env.INDEXER_OUTPUT_DIR,
    indexerDryRun: process.env.INDEXER_DRY_RUN,
    indexerAllowCursorLocalScan: process.env.INDEXER_ALLOW_CURSOR_LOCAL_SCAN,
    indexerRedactSecrets: process.env.INDEXER_REDACT_SECRETS,
    indexerRedactEmails: process.env.INDEXER_REDACT_EMAILS,
    indexerRedactPhones: process.env.INDEXER_REDACT_PHONES,
    indexerMaxConversationChars: process.env.INDEXER_MAX_CONVERSATION_CHARS,

    cursorLocalAllowedPaths: process.env.CURSOR_LOCAL_ALLOWED_PATHS,
  };
}

export function getIndexerConfig(): IndexerConfig {
  return indexerConfigSchema.parse(readProcessEnv());
}

export function resolveAgainstRepoRoot(repoRoot: string, config: IndexerConfig): ResolvedPaths {
  return {
    importDir: path.resolve(repoRoot, config.indexerImportDir),
    outputDir: path.resolve(repoRoot, config.indexerOutputDir),
    projectRootResolved: config.indexerProjectRoot
      ? path.resolve(repoRoot, config.indexerProjectRoot)
      : repoRoot,
    projectName: config.indexerProjectName ?? path.basename(repoRoot),
    repoRoot,
  };
}

export type ResolvedPaths = {
  importDir: string;
  outputDir: string;
  projectRootResolved: string;
  projectName: string;
  repoRoot: string;
};

/** Airtable required when live sync — dry-run skips */
export function assertAirtableForLive(cfg: IndexerConfig): string | null {
  if (cfg.indexerDryRun) return null;
  if (!cfg.airtableApiKey?.trim()) return "AIRTABLE_API_KEY is required unless INDEXER_DRY_RUN=true";
  if (!cfg.airtableBaseId?.trim()) return "AIRTABLE_BASE_ID is required unless INDEXER_DRY_RUN=true";
  return null;
}

export function assertNotion(cfg: IndexerConfig): string | null {
  if (!cfg.notionEnabled) return null;
  if (!cfg.notionApiKey?.trim()) return "NOTION_ENABLED requires NOTION_API_KEY";
  if (!cfg.notionParentPageId?.trim()) return "NOTION_ENABLED requires NOTION_PARENT_PAGE_ID";
  return null;
}

export function assertLinear(cfg: IndexerConfig): string | null {
  if (!cfg.linearEnabled) return null;
  if (!cfg.linearApiKey?.trim()) return "LINEAR_ENABLED requires LINEAR_API_KEY";
  if (!cfg.linearTeamId?.trim()) return "LINEAR_ENABLED requires LINEAR_TEAM_ID";
  return null;
}
