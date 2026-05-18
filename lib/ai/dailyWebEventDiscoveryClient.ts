import { zodTextFormat } from "openai/helpers/zod";

import {
  DAILY_WEB_EVENT_DISCOVERY_SYSTEM_PROMPT,
  buildDailyWebEventDiscoveryUserPrompt,
} from "@/lib/ai/prompts/dailyWebEventDiscoveryPrompt";
import { tryGetAgentOpenAIClient } from "@/lib/ai/openaiClient";
import { enrichDailyWebEvents } from "@/lib/events/dailyWebEventEnrichment";
import {
  dailyWebEventDiscoverySchema,
  parseDailyWebEventDiscoveryJson,
  type DailyWebEventDiscoveryResult,
} from "@/lib/events/dailyWebEventDiscoverySchema";

export type DiscoverWebEventsResult =
  | { ok: true; data: DailyWebEventDiscoveryResult; rawPreview: string }
  | {
      ok: false;
      reason: "openai_key_missing" | "openai_call_failed" | "schema_validation_failed";
      message: string;
      rawPreview?: string;
    };

const RESPONSE_PREVIEW_LIMIT = 6000;
const OPENAI_CANDIDATE_LIMIT = 20;

export async function discoverWebEventsWithOpenAI(input: {
  model: string;
  startDate: string;
  endDate: string;
  sourcePreferenceSummary: string;
}): Promise<DiscoverWebEventsResult> {
  const clientResult = tryGetAgentOpenAIClient();
  if (!clientResult.ok) {
    return {
      ok: false,
      reason: "openai_key_missing",
      message: clientResult.message,
    };
  }

  const userPrompt = buildDailyWebEventDiscoveryUserPrompt({
    startDate: input.startDate,
    endDate: input.endDate,
    sourcePreferenceSummary: input.sourcePreferenceSummary,
    candidateLimit: OPENAI_CANDIDATE_LIMIT,
  });

  let responseText: string;
  try {
    const response = await clientResult.client.responses.create({
      model: input.model,
      tools: [{ type: "web_search" }],
      input: [
        {
          role: "system",
          content: DAILY_WEB_EVENT_DISCOVERY_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: zodTextFormat(
          dailyWebEventDiscoverySchema,
          "daily_event_discovery",
        ),
      },
    });
    responseText = response.output_text ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";
    return { ok: false, reason: "openai_call_failed", message };
  }

  const preview = responseText.slice(0, RESPONSE_PREVIEW_LIMIT);
  const parsed = parseDailyWebEventDiscoveryJson(responseText);
  if (!parsed.success) {
    return {
      ok: false,
      reason: "schema_validation_failed",
      message: parsed.error.message,
      rawPreview: preview,
    };
  }

  return {
    ok: true,
    data: {
      events: enrichDailyWebEvents(parsed.data.events),
    },
    rawPreview: preview,
  };
}
