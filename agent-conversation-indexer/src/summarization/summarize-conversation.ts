import type { NormalizedConversation } from "../types";
import type { IndexerConfig } from "../config";
import { localHeuristicSummary } from "./local-heuristic-summary";
import { optionalOpenAISummary } from "./optional-openai-summary";

export async function summarizeConversation(
  c: NormalizedConversation,
  cfg: IndexerConfig,
): Promise<NormalizedConversation> {
  const local = localHeuristicSummary(c);
  let next: NormalizedConversation = {
    ...c,
    title: local.title,
    shortSummary: local.shortSummary,
    detailedSummary: local.detailedSummary,
    keyOutcome: local.keyOutcome,
    currentState: local.currentState,
    tags: Array.from(new Set([...c.tags, ...local.tags])),
  };

  const ai = await optionalOpenAISummary(next, cfg);
  if (!ai) return next;

  next = {
    ...next,
    title: ai.title || next.title,
    shortSummary: ai.shortSummary || next.shortSummary,
    detailedSummary: ai.detailedSummary || next.detailedSummary,
    keyOutcome: ai.keyOutcome || next.keyOutcome,
    currentState: ai.currentState || next.currentState,
    tags: Array.from(new Set([...next.tags, ...ai.tags])),
    metadata: {
      ...next.metadata,
      aiSummaryUsed: true,
    },
  };

  return next;
}
