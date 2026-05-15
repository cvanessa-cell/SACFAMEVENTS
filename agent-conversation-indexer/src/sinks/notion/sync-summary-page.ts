import type { NormalizedConversation } from "../../types";
import type { IndexerConfig, ResolvedPaths } from "../../config";
import { notionCreatePage } from "./notion-client";

export async function syncSummaryPagesForDigest(opts: {
  cfg: IndexerConfig;
  paths: ResolvedPaths;
  conversations: NormalizedConversation[];
  airtableConversationUrlHint?: string;
}): Promise<number> {
  const { cfg } = opts;
  if (!cfg.notionEnabled) return 0;

  const iso = new Date().toISOString().slice(0, 10);
  const hint = opts.airtableConversationUrlHint;
  const md = [
    `# Agent index digest — ${opts.paths.projectName} — ${iso}`,
    "",
    ...opts.conversations.map((c, i) => {
      const head = `${i + 1}. **${c.title ?? c.id}** (${c.sourceType})`;
      const body = [
        `- Short: ${(c.shortSummary ?? "").slice(0, 300)}`,
        `- Outcome: ${(c.keyOutcome ?? "").slice(0, 200)}`,
        `- Files: ${c.filesReferenced.slice(0, 8).map((f) => f.filePath).join(", ")}`,
        `- Errors: ${c.errors.length}`,
        `- Actions: ${c.actionItems.length}`,
        hint ? `- Airtable row: (${hint}${c.id})` : "",
        "",
      ]
        .filter(Boolean)
        .join("\n");
      return `${head}\n${body}`;
    }),
  ].join("\n");

  await notionCreatePage({ cfg, title: `Agent digest ${iso}`, markdownBody: md });
  return 1;
}

export async function syncConversationPage(opts: {
  cfg: IndexerConfig;
  c: NormalizedConversation;
  airtableLink?: string;
}): Promise<string | null> {
  const md = [
    `# ${opts.c.title ?? opts.c.id}`,
    `Project: ${opts.c.projectName}`,
    `Imported: ${opts.c.importedAt}`,
    "",
    "## Short summary",
    opts.c.shortSummary ?? "",
    "",
    "## Key outcome",
    opts.c.keyOutcome ?? "",
    "## Current state",
    opts.c.currentState ?? "",
    "## Decisions",
    ...opts.c.decisions.map((d) => `- ${d.text}`),
    "## Action items",
    ...opts.c.actionItems.map((a) => `- [${a.type}] ${a.title}`),
    "## Errors (redacted excerpts)",
    ...opts.c.errors.map((e) => `- ${e.message.split("\n")[0]?.slice(0, 280)}`),
    "## Files referenced",
    ...opts.c.filesReferenced.map((f) => `- ${f.filePath}`),
    opts.airtableLink ? `\n[Airtable](${opts.airtableLink})` : "",
  ].join("\n");

  const page = await notionCreatePage({
    cfg: opts.cfg,
    title: opts.c.title ?? opts.c.id,
    markdownBody: md,
  });
  return page?.url ?? null;
}
