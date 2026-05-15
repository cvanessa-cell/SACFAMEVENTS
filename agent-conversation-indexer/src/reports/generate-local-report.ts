import fs from "node:fs";
import path from "node:path";

import type { NormalizedConversation } from "../types";
import type { IndexerConfig, ResolvedPaths } from "../config";

export type ReportDeps = {
  cfg: IndexerConfig;
  paths: ResolvedPaths;
  conversations: NormalizedConversation[];
  lastSyncDryRun: boolean;
  lastNotionPages: number;
  lastLinearCreated: number;
};

export function writeProjectAgentIndex(reportPath: string, deps: ReportDeps): void {
  const { cfg, paths, conversations: list } = deps;
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });

  const bySource = new Map<string, typeof list>();
  for (const c of list) {
    if (!bySource.has(c.sourceType)) bySource.set(c.sourceType, []);
    bySource.get(c.sourceType)!.push(c);
  }

  const tagCounts = new Map<string, number>();
  for (const c of list) {
    for (const t of c.tags) tagCounts.set(t, (tagCounts.get(t) ?? 0) + 1);
  }
  const topTags = [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);

  const fileCounts = new Map<string, number>();
  for (const c of list) {
    for (const f of c.filesReferenced) {
      fileCounts.set(f.filePath, (fileCounts.get(f.filePath) ?? 0) + 1);
    }
  }
  const topFiles = [...fileCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15);

  const errSamples = [
    ...new Set(list.flatMap((c) => c.errors.map((e) => e.message.split("\n")[0]?.slice(0, 120) ?? "").filter(Boolean))),
  ].slice(0, 25);

  const openActions = list.flatMap((c) =>
    c.actionItems.map((a) => ({ conversation: c.title ?? c.id, action: a })),
  ).length;

  const lines = [
    `# Project agent index — ${paths.projectName}`,
    `- Generated at: ${new Date().toISOString()}`,
    `- Total conversations: ${list.length}`,
    `- Last run dry-run: ${deps.lastSyncDryRun ? "yes" : "no"}`,
    "",
    "## Source breakdown",
    ...Array.from(bySource.entries()).map(([k, v]) => `- ${k}: ${v.length}`),
    "",
    "## Top tags",
    ...topTags.map(([t, n]) => `- ${t}: ${n}`),
    "",
    "## Most referenced files",
    ...topFiles.map(([f, n]) => `- ${f} (${n})`),
    "",
    "## Sample error excerpts (first line)",
    ...errSamples.map((e) => `- ${e}`),
    "",
    "## Open / extracted action item rows (count)",
    `- ${openActions}`,
    "",
    "## Recent decisions (truncated)",
    ...list.flatMap((c) => c.decisions.slice(0, 3).map((d) => `- **${c.id}**: ${d.text.slice(0, 220)}`)).slice(
      0,
      22,
    ),
    "",
    "## Conversations flagged for follow-up",
    ...list.filter((c) => c.actionItems.some((a) => a.confidence >= 0.65)).map((c) => `- ${c.title ?? c.id}`),
    "",
    "## Sync / integration status",
    `- Airtable base: configured=${Boolean(cfg.airtableApiKey)} dryRun=${cfg.indexerDryRun}`,
    `- Conversations table: "${cfg.airtableConversationsTable}"`,
    `- Notion: enabled=${cfg.notionEnabled}`,
    `- Linear: enabled=${cfg.linearEnabled}`,
    `- OpenAI summaries: enabled=${cfg.openaiSummarizationEnabled}`,
    "",
    "---",
    "See `agent-conversation-indexer/README.md` for setup.",
  ].join("\n");

  fs.writeFileSync(reportPath, lines, "utf8");
}
