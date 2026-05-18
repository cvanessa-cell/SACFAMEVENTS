import { readDailyWebEventDiscoveryConfig } from "@/lib/events/dailyWebEventDiscoveryEnv";

const TRUE_VALUES = new Set(["1", "true", "yes", "on"]);

function parseBool(raw: string | undefined, defaultValue: boolean): boolean {
  if (raw === undefined) return defaultValue;
  const v = raw.trim().toLowerCase();
  if (v === "") return defaultValue;
  if (TRUE_VALUES.has(v)) return true;
  return false;
}

export function isOpenAiAppEnabled(): boolean {
  return parseBool(process.env.SACFAM_OPENAI_APP_ENABLED, false);
}

export function resolvePublicAppBaseUrl(): string {
  const base =
    process.env.PUBLIC_APP_BASE_URL?.trim() ||
    process.env.APP_BASE_URL?.trim() ||
    "http://localhost:3333";
  return base.replace(/\/$/, "");
}

export function resolveMcpEndpointUrl(): string {
  return `${resolvePublicAppBaseUrl()}/mcp`;
}

export interface OpenAiAppStatusSnapshot {
  openAiAppEnabled: boolean;
  openAiConfigured: boolean;
  airtableConfigured: boolean;
  discoveryEnabled: boolean;
  dryRunDefault: boolean;
  defaultLimit: number;
  defaultLookaheadDays: number;
  mcpEndpointUrl: string;
}

export function getOpenAiAppStatusSnapshot(): OpenAiAppStatusSnapshot {
  const discovery = readDailyWebEventDiscoveryConfig();
  return {
    openAiAppEnabled: isOpenAiAppEnabled(),
    openAiConfigured: discovery.hasOpenAiKey,
    airtableConfigured: discovery.hasAirtableConfig,
    discoveryEnabled: discovery.enabled,
    dryRunDefault: discovery.dryRun,
    defaultLimit: discovery.limit,
    defaultLookaheadDays: discovery.lookaheadDays,
    mcpEndpointUrl: resolveMcpEndpointUrl(),
  };
}

export type OpenAiAppAvailability =
  | { ok: true }
  | { ok: false; message: string; reason: string };

export function checkOpenAiAppAvailability(): OpenAiAppAvailability {
  if (!isOpenAiAppEnabled()) {
    return {
      ok: false,
      reason: "openai_app_disabled",
      message: "SACFAM_OPENAI_APP_ENABLED is false.",
    };
  }
  const discovery = readDailyWebEventDiscoveryConfig();
  if (!discovery.enabled) {
    return {
      ok: false,
      reason: "discovery_disabled",
      message: "SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED is false.",
    };
  }
  if (!discovery.hasOpenAiKey) {
    return {
      ok: false,
      reason: "openai_key_missing",
      message: "OPENAI_API_KEY is not configured.",
    };
  }
  if (!discovery.hasAirtableConfig) {
    return {
      ok: false,
      reason: "airtable_config_missing",
      message: "AIRTABLE_API_KEY and AIRTABLE_BASE_ID are required.",
    };
  }
  return { ok: true };
}
