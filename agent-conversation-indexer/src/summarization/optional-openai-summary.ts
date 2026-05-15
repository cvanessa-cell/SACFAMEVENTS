import type { NormalizedConversation } from "../types";
import type { IndexerConfig } from "../config";

export type OpenAiStructuredSummary = {
  title: string;
  shortSummary: string;
  detailedSummary: string;
  keyOutcome: string;
  currentState: string;
  tags: string[];
  actionItems: string[];
  decisions: string[];
  errors: string[];
  filesReferenced: string[];
};

const JSON_INSTRUCTION = `You receive a REDACTED agent conversation transcript excerpt. Output STRICT JSON ONLY with keys:
title, shortSummary, detailedSummary, keyOutcome, currentState, tags (array), actionItems (array of strings), decisions (array), errors (array), filesReferenced (array of relative paths ONLY if explicitly in text).
Rules: Never invent facts. If unknown, use empty arrays or concise "Unable to derive from excerpt." Never include secrets or tokens.
`;

export async function optionalOpenAISummary(
  c: NormalizedConversation,
  cfg: IndexerConfig,
): Promise<OpenAiStructuredSummary | null> {
  if (!cfg.openaiSummarizationEnabled || !cfg.openaiApiKey?.trim()) return null;

  const text = c.redactedText.slice(0, cfg.indexerMaxConversationChars);

  try {
    const mod = await import("openai");
    const OpenAI = mod.default;
    const client = new OpenAI({ apiKey: cfg.openaiApiKey });

    const res = await client.chat.completions.create({
      model: cfg.openaiSummaryModel,
      messages: [
        { role: "system", content: JSON_INSTRUCTION },
        { role: "user", content: text },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_completion_tokens: 1200,
    });

    const raw = res.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as Partial<OpenAiStructuredSummary>;

    return {
      title: String(parsed.title ?? c.projectName),
      shortSummary: String(parsed.shortSummary ?? ""),
      detailedSummary: String(parsed.detailedSummary ?? ""),
      keyOutcome: String(parsed.keyOutcome ?? ""),
      currentState: String(parsed.currentState ?? ""),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
      actionItems: Array.isArray(parsed.actionItems) ? parsed.actionItems.map(String) : [],
      decisions: Array.isArray(parsed.decisions) ? parsed.decisions.map(String) : [],
      errors: Array.isArray(parsed.errors) ? parsed.errors.map(String) : [],
      filesReferenced: Array.isArray(parsed.filesReferenced)
        ? parsed.filesReferenced.map(String)
        : [],
    };
  } catch {
    return null;
  }
}
