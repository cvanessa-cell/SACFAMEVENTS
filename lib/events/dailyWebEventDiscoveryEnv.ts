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

function parseInteger(
  raw: string | undefined,
  defaultValue: number,
  min: number,
  max: number,
): number {
  if (!raw) return defaultValue;
  const n = Number.parseInt(raw.trim(), 10);
  if (Number.isNaN(n)) return defaultValue;
  return Math.min(max, Math.max(min, n));
}

export interface DailyWebEventDiscoveryConfig {
  enabled: boolean;
  dryRun: boolean;
  limit: number;
  lookaheadDays: number;
  model: string;
  hasOpenAiKey: boolean;
  hasAirtableConfig: boolean;
  timezone: string;
}

export function readDailyWebEventDiscoveryConfig(): DailyWebEventDiscoveryConfig {
  return {
    enabled: parseBool(process.env.SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED, false),
    dryRun: parseBool(process.env.SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN, true),
    limit: parseInteger(process.env.SACFAM_DAILY_EVENT_LIMIT, 9, 1, 9),
    lookaheadDays: parseInteger(
      process.env.SACFAM_DAILY_EVENT_LOOKAHEAD_DAYS,
      14,
      1,
      60,
    ),
    model:
      process.env.OPENAI_DAILY_EVENT_MODEL?.trim() ||
      process.env.OPENAI_MODEL?.trim() ||
      "gpt-5.5",
    hasOpenAiKey: !!process.env.OPENAI_API_KEY?.trim(),
    hasAirtableConfig:
      !!process.env.AIRTABLE_API_KEY?.trim() &&
      !!process.env.AIRTABLE_BASE_ID?.trim(),
    timezone: process.env.EVENT_TIMEZONE?.trim() || "America/Los_Angeles",
  };
}

export type DailyDiscoveryDisabledReason =
  | "feature_disabled"
  | "openai_key_missing"
  | "airtable_config_missing";

export interface DailyDiscoveryAvailability {
  ok: boolean;
  reason?: DailyDiscoveryDisabledReason;
  message?: string;
  config: DailyWebEventDiscoveryConfig;
}

export function checkDailyWebEventDiscoveryAvailability(): DailyDiscoveryAvailability {
  const config = readDailyWebEventDiscoveryConfig();
  if (!config.enabled) {
    return {
      ok: false,
      reason: "feature_disabled",
      message: "SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED is false.",
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
  if (!config.hasAirtableConfig) {
    return {
      ok: false,
      reason: "airtable_config_missing",
      message: "AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required.",
      config,
    };
  }
  return { ok: true, config };
}

export const __testing = { parseBool, parseInteger };
