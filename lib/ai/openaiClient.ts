/**
 * Graceful OpenAI client wrapper for the SacFam AI source agent.
 *
 * Unlike `lib/openai/client.ts` (which throws if OPENAI_API_KEY is missing),
 * this helper returns a structured `{ ok: false, reason }` so feature-flagged
 * agent surfaces never crash the app when the key is absent or the flag is off.
 */

import OpenAI from "openai";

let cachedClient: OpenAI | null = null;

export type AgentClientFailure =
  | { ok: false; reason: "openai_key_missing"; message: string };

export type AgentClientSuccess = { ok: true; client: OpenAI };

export type AgentClientResult = AgentClientSuccess | AgentClientFailure;

export function tryGetAgentOpenAIClient(): AgentClientResult {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) {
    return {
      ok: false,
      reason: "openai_key_missing",
      message: "OPENAI_API_KEY is not configured.",
    };
  }
  if (!cachedClient) {
    cachedClient = new OpenAI({ apiKey: key });
  }
  return { ok: true, client: cachedClient };
}

/** Test-only helper: clear the cached client so env changes take effect. */
export function __resetAgentOpenAIClientForTests(): void {
  cachedClient = null;
}
