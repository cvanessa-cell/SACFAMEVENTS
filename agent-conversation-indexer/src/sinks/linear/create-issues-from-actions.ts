import type { ExtractedActionItem } from "../../types";
import type { NormalizedConversation } from "../../types";
import type { IndexerConfig } from "../../config";
import { linearGraphql } from "./linear-client";

const CREATE = `
mutation CreateIssue($input: IssueCreateInput!) {
  issueCreate(input: $input) {
    success
    issue { id url identifier title }
  }
}
`;

export type CreatedLinear = { url: string; identifier: string };

export async function createLinearIssue(opts: {
  cfg: IndexerConfig;
  title: string;
  descriptionMd: string;
}): Promise<CreatedLinear | null> {
  const team = opts.cfg.linearTeamId!;
  const projectId = opts.cfg.linearProjectId?.trim() ? opts.cfg.linearProjectId.trim() : undefined;

  const input: Record<string, unknown> = {
    teamId: team,
    title: opts.title.slice(0, 240),
    description: opts.descriptionMd.slice(0, 25_000),
  };
  if (projectId) input.projectId = projectId;

  const data = await linearGraphql<{
    issueCreate?: { success: boolean; issue?: { url?: string; identifier?: string } };
  }>({
    cfg: opts.cfg,
    query: CREATE,
    variables: { input },
  });

  const issue = data.issueCreate?.issue;
  if (!issue?.url) return null;
  return { url: issue.url, identifier: issue.identifier ?? "" };
}

export function eligibleActions(
  conversation: NormalizedConversation,
  cfg: IndexerConfig,
): ExtractedActionItem[] {
  const th = cfg.linearActionConfidenceThreshold;
  const types: ExtractedActionItem["type"][] = [
    "bug",
    "feature",
    "refactor",
    "test",
    "docs",
    "migration",
    "setup",
    "investigation",
  ];
  return conversation.actionItems.filter(
    (a) =>
      a.type !== "follow-up" &&
      types.includes(a.type) &&
      (a.status === "new" || !a.status) &&
      a.confidence >= th,
  );
}

export function buildIssueBody(c: NormalizedConversation, action: ExtractedActionItem, airtableUrl?: string): string {
  return [
    "**Source conversation**",
    `- ID: \`${c.id}\``,
    `- Project: ${c.projectName}`,
    `- Dedupe key: ${c.dedupeKey}`,
    airtableUrl ? `- Airtable: ${airtableUrl}` : "",
    "",
    "## Summary",
    c.shortSummary ?? "",
    "",
    "## Action candidate",
    `**${action.title}**\n`,
    action.description ?? "",
    "",
    "## Files touched (from extraction)",
    c.filesReferenced
      .slice(0, 30)
      .map((f) => `- ${f.filePath}`)
      .join("\n"),
    "",
    "## Suggested acceptance criteria",
    "- Verify behavior against user request excerpt in Airtable",
    "- Add tests if absent",
    "- Confirm no regressions",
  ].join("\n");
}
