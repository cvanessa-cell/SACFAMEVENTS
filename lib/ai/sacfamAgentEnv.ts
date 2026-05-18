/**
 * Small env helper for the SacFam AI source agent. Mirrors the project's existing
 * graceful-degradation pattern (no central env validator, each module reads its
 * own vars with sensible defaults).
 */

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);
const FALSE_VALUES = new Set(["0", "false", "no", "off"]);

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "") return defaultValue;
  if (TRUE_VALUES.has(v)) return true;
  if (FALSE_VALUES.has(v)) return false;
  return defaultValue;
}

function parseInteger(raw: string | undefined, defaultValue: number, min: number, max: number): number {
  if (!raw) return defaultValue;
  const n = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
}

export interface SacfamAgentConfig {
  sourceAgentEnabled: boolean;
  eventMonitorEnabled: boolean;
  model: string;
  sourceResearchModel: string;
  maxSources: number;
  dryRun: boolean;
  airtableWriteEnabled: boolean;
  prismaMirrorEnabled: boolean;
  hasAirtableConfig: boolean;
  airtableTables: {
    eventSources: string;
    sourceResearchRuns: string;
    sourceCandidates: string;
    eventCandidates: string;
  };
  hasOpenAiKey: boolean;
}

export function readSacfamAgentConfig(): SacfamAgentConfig {
  const fallbackModel = process.env.OPENAI_MODEL?.trim() || "gpt-5.5";
  const legacyAgentModel = process.env.SACFAM_SOURCE_AGENT_MODEL?.trim();
  const sourceResearchModel =
    process.env.OPENAI_SOURCE_RESEARCH_MODEL?.trim() ||
    legacyAgentModel ||
    fallbackModel;
  return {
    sourceAgentEnabled: parseBool(process.env.SACFAM_AI_SOURCE_AGENT_ENABLED, true),
    eventMonitorEnabled: parseBool(process.env.SACFAM_AI_EVENT_MONITOR_ENABLED, true),
    model: sourceResearchModel,
    sourceResearchModel,
    maxSources: parseInteger(process.env.SACFAM_SOURCE_AGENT_MAX_SOURCES, 125, 1, 500),
    dryRun: parseBool(process.env.SACFAM_SOURCE_AGENT_DRY_RUN, false),
    airtableWriteEnabled: parseBool(process.env.SACFAM_AIRTABLE_WRITE_ENABLED, true),
    prismaMirrorEnabled: parseBool(process.env.SACFAM_SOURCE_RESEARCH_PRISMA_MIRROR, true),
    hasAirtableConfig:
      !!process.env.AIRTABLE_API_KEY?.trim() && !!process.env.AIRTABLE_BASE_ID?.trim(),
    airtableTables: {
      eventSources:
        process.env.AIRTABLE_EVENT_SOURCES_TABLE?.trim() ||
        process.env.AIRTABLE_SOURCES_TABLE?.trim() ||
        "Event Sources",
      sourceResearchRuns:
        process.env.AIRTABLE_SOURCE_RESEARCH_RUNS_TABLE?.trim() ||
        "Source Research Runs",
      sourceCandidates:
        process.env.AIRTABLE_SOURCE_CANDIDATES_TABLE?.trim() ||
        "Source Candidates",
      eventCandidates:
        process.env.AIRTABLE_EVENT_CANDIDATES_TABLE?.trim() ||
        "Event Candidates",
    },
    hasOpenAiKey: !!process.env.OPENAI_API_KEY?.trim(),
  };
}

export type AgentDisabledReason =
  | "source_agent_flag_off"
  | "event_monitor_flag_off"
  | "openai_key_missing"
  | "airtable_write_flag_off"
  | "airtable_config_missing";

export interface AgentAvailability {
  ok: boolean;
  reason?: AgentDisabledReason;
  message?: string;
  config: SacfamAgentConfig;
}

export function checkSourceAgentAvailability(): AgentAvailability {
  const config = readSacfamAgentConfig();
  if (!config.sourceAgentEnabled) {
    return {
      ok: false,
      reason: "source_agent_flag_off",
      message: "SACFAM_AI_SOURCE_AGENT_ENABLED is false.",
      config,
    };
  }
  if (!config.hasOpenAiKey) {
    return {
      ok: false,
      reason: "openai_key_missing",
      message: "OPENAI_API_KEY is not configured.",
      config,
    };
  }
  return { ok: true, config };
}

export function checkEventMonitorAvailability(): AgentAvailability {
  const config = readSacfamAgentConfig();
  if (!config.eventMonitorEnabled) {
    return {
      ok: false,
      reason: "event_monitor_flag_off",
      message: "SACFAM_AI_EVENT_MONITOR_ENABLED is false.",
      config,
    };
  }
  if (!config.hasOpenAiKey) {
    return {
      ok: false,
      reason: "openai_key_missing",
      message: "OPENAI_API_KEY is not configured.",
      config,
    };
  }
  return { ok: true, config };
}

export function checkAirtableWriteAvailability(): AgentAvailability {
  const config = readSacfamAgentConfig();
  if (!config.airtableWriteEnabled) {
    return {
      ok: false,
      reason: "airtable_write_flag_off",
      message: "SACFAM_AIRTABLE_WRITE_ENABLED is false.",
      config,
    };
  }
  if (!config.hasAirtableConfig) {
    return {
      ok: false,
      reason: "airtable_config_missing",
      message: "AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required for Airtable writes.",
      config,
    };
  }
  return { ok: true, config };
}

export const __testing = { parseBool, parseInteger };
