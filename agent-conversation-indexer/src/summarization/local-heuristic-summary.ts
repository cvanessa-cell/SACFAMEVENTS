import type { NormalizedConversation } from "../types";

export type HeuristicSummary = {
  title: string;
  shortSummary: string;
  detailedSummary: string;
  keyOutcome: string;
  currentState: string;
  actionTitles: string[];
  decisionTexts: string[];
  errorLines: string[];
  filePaths: string[];
  tags: string[];
};

export function localHeuristicSummary(c: NormalizedConversation): HeuristicSummary {
  const preview = (c.userRequest ?? c.redactedText).trim().slice(0, 300);
  const title =
    (c.title && c.title.slice(0, 120)) ||
    `${c.projectName}: ${preview.split("\n")[0]?.slice(0, 96) || "conversation"}`;

  const shortSummary =
    `[${c.sourceType}] Imported ${new Date(c.importedAt).toISOString().slice(0, 10)}.` +
    ` Sources: commands=${c.commandsRun.length}, errors=${c.errors.length}, files=${c.filesReferenced.length}, actions=${c.actionItems.length}.`;

  const detailedLines = [
    `Source: ${c.sourcePath ?? c.sourceUrl ?? "inline"}`,
    c.userRequest ? `User excerpt: ${c.userRequest.slice(0, 500)}` : "",
    "",
    "**Commands (sample)**",
    ...c.commandsRun.slice(0, 10).map((x) => `- ${x.command}`),
    "",
    "**Files referenced (sample)**",
    ...c.filesReferenced.slice(0, 25).map((f) => `- ${f.filePath}`),
    "",
    "**Action items extracted**",
    ...c.actionItems.slice(0, 15).map((a) => `- [${a.type}] ${a.title}`),
    "",
    "**Decision-like lines**",
    ...c.decisions.slice(0, 10).map((d) => `- ${d.text}`),
    "",
    "**Error excerpts**",
    ...c.errors.slice(0, 8).map((e) => `- ${e.message.split("\n")[0] ?? e.message}`),
  ].filter(Boolean);

  const keyOutcome =
    c.decisions[0]?.text ??
    (c.errors.length
      ? "Investigation / errors surfaced in transcript"
      : "Work captured and indexed locally");

  const currentState =
    c.actionItems.filter((a) => a.confidence >= 0.65).length > 0
      ? `${c.actionItems.filter((a) => a.confidence >= 0.65).length} follow-up candidate(s)`
      : "No high-confidence TODOs surfaced";

  return {
    title,
    shortSummary,
    detailedSummary: detailedLines.join("\n"),
    keyOutcome,
    currentState,
    actionTitles: c.actionItems.map((a) => a.title),
    decisionTexts: c.decisions.map((d) => d.text),
    errorLines: c.errors.map((e) => e.message.split("\n")[0]).filter(Boolean),
    filePaths: c.filesReferenced.map((f) => f.filePath),
    tags: c.tags,
  };
}
