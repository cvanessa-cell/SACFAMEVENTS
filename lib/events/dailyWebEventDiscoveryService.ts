import { discoverWebEventsWithOpenAI } from "@/lib/ai/dailyWebEventDiscoveryClient";
import {
  buildSourcePreferenceSummary,
  getHighPrioritySourcePreferences,
} from "@/lib/airtable/familyEventSourcesRepository";
import {
  createFamilyEvents,
  getExistingFamilyEventsForWindow,
} from "@/lib/airtable/familyEventsRepository";
import { dedupeEvents } from "@/lib/events/eventDeduper";
import {
  checkDailyWebEventDiscoveryAvailability,
  readDailyWebEventDiscoveryConfig,
} from "@/lib/events/dailyWebEventDiscoveryEnv";
import {
  filterEventsInDateWindow,
  type DailyWebEvent,
} from "@/lib/events/dailyWebEventDiscoverySchema";
import { rankDailyWebEvents } from "@/lib/events/eventRanker";
import { logger } from "@/lib/logger";

export interface DiscoverFamilyEventsOnlyResult {
  ok: boolean;
  reason?: string;
  message?: string;
  runAt: string;
  dateWindow: { startDate: string; endDate: string };
  sourcePreferencesLoaded: number;
  candidatesFound: number;
  candidatesValid: number;
  duplicatesSkipped: number;
  candidates: DailyWebEvent[];
  errors: string[];
}

export interface SaveEventBucketItem {
  index: number;
  event_title: string;
  event_date?: string;
  city?: string;
  reason?: string;
  airtableRecordId?: string;
  event_url?: string;
}

export interface SaveDiscoveredEventsResult {
  ok: boolean;
  discovery_run_id: string;
  saved: SaveEventBucketItem[];
  skipped: SaveEventBucketItem[];
  duplicate: SaveEventBucketItem[];
  rejected: SaveEventBucketItem[];
  errors: string[];
}

export interface DailyWebEventDiscoverySummary {
  ok: boolean;
  runAt: string;
  dateWindow: { startDate: string; endDate: string };
  sourcePreferencesLoaded: number;
  candidatesFound: number;
  candidatesValid: number;
  duplicatesSkipped: number;
  eventsSelected: number;
  eventsCreated: number;
  dryRun: boolean;
  disabled?: boolean;
  reason?: string;
  message?: string;
  errors: string[];
  selectedEvents: DailyWebEvent[];
  duplicateDetails?: Array<{ title: string; date: string; reason: string }>;
  createdRecordIds?: string[];
}

function formatYmdInTimezone(date: Date, timeZone: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

export interface RunDailyWebEventDiscoveryOptions {
  dryRun?: boolean;
  limit?: number;
  lookaheadDays?: number;
  city?: string;
}

async function loadDiscoveryPipelineContext(
  options: RunDailyWebEventDiscoveryOptions,
): Promise<
  | {
      ok: true;
      config: ReturnType<typeof readDailyWebEventDiscoveryConfig>;
      today: string;
      endDate: string;
      dateWindow: { startDate: string; endDate: string };
      limit: number;
      existingKeys: Set<string>;
      sourcePreferencesLoaded: number;
      errors: string[];
    }
  | {
      ok: false;
      summary: DailyWebEventDiscoverySummary;
    }
> {
  const config = readDailyWebEventDiscoveryConfig();
  const runAt = new Date().toISOString();
  const availability = checkDailyWebEventDiscoveryAvailability();
  if (!availability.ok) {
    return {
      ok: false,
      summary: {
        ok: false,
        disabled: availability.reason === "feature_disabled",
        reason: availability.reason,
        message: availability.message,
        runAt,
        dateWindow: { startDate: "", endDate: "" },
        sourcePreferencesLoaded: 0,
        candidatesFound: 0,
        candidatesValid: 0,
        duplicatesSkipped: 0,
        eventsSelected: 0,
        eventsCreated: 0,
        dryRun: options.dryRun ?? config.dryRun,
        errors: [availability.message ?? "Unavailable"],
        selectedEvents: [],
      },
    };
  }

  const limit = Math.min(9, options.limit ?? config.limit);
  const lookaheadDays = options.lookaheadDays ?? config.lookaheadDays;
  const today = formatYmdInTimezone(new Date(), config.timezone);
  const endDate = addDaysYmd(today, lookaheadDays);
  const dateWindow = { startDate: today, endDate };
  const errors: string[] = [];

  const sourcesResult = await getHighPrioritySourcePreferences();
  const sourcePreferencesLoaded = sourcesResult.ok
    ? sourcesResult.sources.length
    : 0;
  if (!sourcesResult.ok) errors.push(sourcesResult.message);

  const existingResult = await getExistingFamilyEventsForWindow(today, endDate);
  const existingKeys = new Set<string>();
  if (existingResult.ok) {
    for (const e of existingResult.events) existingKeys.add(e.duplicateKey);
  } else {
    errors.push(existingResult.message);
  }

  return {
    ok: true,
    config,
    today,
    endDate,
    dateWindow,
    limit,
    existingKeys,
    sourcePreferencesLoaded,
    errors,
  };
}

export async function discoverFamilyEventsOnly(
  options: RunDailyWebEventDiscoveryOptions = {},
): Promise<DiscoverFamilyEventsOnlyResult> {
  const runAt = new Date().toISOString();
  const ctx = await loadDiscoveryPipelineContext(options);
  if (!ctx.ok) {
    const s = ctx.summary;
    return {
      ok: false,
      reason: s.reason,
      message: s.message,
      runAt: s.runAt,
      dateWindow: s.dateWindow,
      sourcePreferencesLoaded: s.sourcePreferencesLoaded,
      candidatesFound: 0,
      candidatesValid: 0,
      duplicatesSkipped: 0,
      candidates: [],
      errors: s.errors,
    };
  }

  const sourcesResult = await getHighPrioritySourcePreferences();
  const openAiResult = await discoverWebEventsWithOpenAI({
    model: ctx.config.model,
    startDate: ctx.today,
    endDate: ctx.endDate,
    sourcePreferenceSummary: buildSourcePreferenceSummary(
      sourcesResult.ok ? sourcesResult.sources : [],
    ),
  });

  if (!openAiResult.ok) {
    return {
      ok: false,
      reason: openAiResult.reason,
      message: openAiResult.message,
      runAt,
      dateWindow: ctx.dateWindow,
      sourcePreferencesLoaded: ctx.sourcePreferencesLoaded,
      candidatesFound: 0,
      candidatesValid: 0,
      duplicatesSkipped: 0,
      candidates: [],
      errors: [...ctx.errors, openAiResult.message],
    };
  }

  const candidatesFound = openAiResult.data.events.length;
  const { valid, rejected } = filterEventsInDateWindow(
    openAiResult.data.events,
    ctx.today,
    ctx.endDate,
  );
  const { unique, duplicatesSkipped } = dedupeEvents(valid, ctx.existingKeys);
  const ranked = rankDailyWebEvents(unique, ctx.today);
  const candidates = ranked.slice(0, ctx.limit);

  return {
    ok: true,
    runAt,
    dateWindow: ctx.dateWindow,
    sourcePreferencesLoaded: ctx.sourcePreferencesLoaded,
    candidatesFound,
    candidatesValid: valid.length,
    duplicatesSkipped: duplicatesSkipped.length + rejected.length,
    candidates,
    errors: ctx.errors,
  };
}

export async function saveDiscoveredFamilyEvents(input: {
  discovery_run_id: string;
  eventIndexes: number[];
  confirmSave: boolean;
  candidates: DailyWebEvent[];
  startDate: string;
  endDate: string;
}): Promise<SaveDiscoveredEventsResult> {
  const empty: SaveDiscoveredEventsResult = {
    ok: false,
    discovery_run_id: input.discovery_run_id,
    saved: [],
    skipped: [],
    duplicate: [],
    rejected: [],
    errors: [],
  };

  if (!input.confirmSave) {
    return {
      ...empty,
      errors: ["confirmSave must be true to write events to Airtable."],
    };
  }

  const selectedSet = new Set(
    input.eventIndexes.filter((n) => Number.isInteger(n) && n >= 1),
  );

  const skipped: SaveEventBucketItem[] = [];
  const rejected: SaveEventBucketItem[] = [];
  const duplicate: SaveEventBucketItem[] = [];
  const toSave: DailyWebEvent[] = [];

  input.candidates.forEach((event, idx) => {
    const index = idx + 1;
    const base = {
      index,
      event_title: event.event_title,
      event_date: event.event_date,
      city: event.city,
      event_url: event.event_url,
    };
    if (!selectedSet.has(index)) {
      skipped.push({ ...base, reason: "not_selected" });
      return;
    }
    if (!event.event_url?.trim() || !event.source_url?.trim()) {
      rejected.push({ ...base, reason: "missing_event_or_source_url" });
      return;
    }
    toSave.push(event);
  });

  for (const index of Array.from(selectedSet)) {
    if (index > input.candidates.length) {
      rejected.push({
        index,
        event_title: `(index ${index})`,
        reason: "invalid_index",
      });
    }
  }

  const existingResult = await getExistingFamilyEventsForWindow(
    input.startDate,
    input.endDate,
  );
  const existingKeys = new Set<string>();
  if (existingResult.ok) {
    for (const e of existingResult.events) existingKeys.add(e.duplicateKey);
  }

  const { unique, duplicatesSkipped } = dedupeEvents(toSave, existingKeys);
  for (const dup of duplicatesSkipped) {
    const idx = input.candidates.findIndex(
      (c) => c.event_title === dup.event.event_title && c.event_date === dup.event.event_date,
    );
    duplicate.push({
      index: idx >= 0 ? idx + 1 : 0,
      event_title: dup.event.event_title,
      event_date: dup.event.event_date,
      city: dup.event.city,
      reason: dup.reason,
      event_url: dup.event.event_url,
    });
  }

  const saved: SaveEventBucketItem[] = [];
  const errors: string[] = [];

  if (unique.length > 0) {
    const writeResult = await createFamilyEvents(unique);
    if (!writeResult.ok) {
      errors.push(writeResult.message);
    } else {
      for (const rec of writeResult.records) {
        const idx = input.candidates.findIndex(
          (c) =>
            c.event_title === rec.event.event_title &&
            c.event_date === rec.event.event_date,
        );
        saved.push({
          index: idx >= 0 ? idx + 1 : 0,
          event_title: rec.event.event_title,
          event_date: rec.event.event_date,
          city: rec.event.city,
          airtableRecordId: rec.id,
          event_url: rec.event.event_url,
        });
      }
    }
  }

  return {
    ok: errors.length === 0 && (saved.length > 0 || unique.length === 0),
    discovery_run_id: input.discovery_run_id,
    saved,
    skipped,
    duplicate,
    rejected,
    errors,
  };
}

export async function runDailyWebEventDiscovery(
  options: RunDailyWebEventDiscoveryOptions = {},
): Promise<DailyWebEventDiscoverySummary> {
  const config = readDailyWebEventDiscoveryConfig();
  const dryRun = options.dryRun ?? config.dryRun;

  const discovered = await discoverFamilyEventsOnly(options);
  if (!discovered.ok) {
    return {
      ok: false,
      disabled: discovered.reason === "feature_disabled",
      reason: discovered.reason,
      message: discovered.message,
      runAt: discovered.runAt,
      dateWindow: discovered.dateWindow,
      sourcePreferencesLoaded: discovered.sourcePreferencesLoaded,
      candidatesFound: discovered.candidatesFound,
      candidatesValid: discovered.candidatesValid,
      duplicatesSkipped: discovered.duplicatesSkipped,
      eventsSelected: 0,
      eventsCreated: 0,
      dryRun,
      errors: discovered.errors,
      selectedEvents: [],
    };
  }

  const selectedEvents = discovered.candidates;
  let eventsCreated = 0;
  let createdRecordIds: string[] | undefined;
  const errors = [...discovered.errors];

  if (!dryRun && selectedEvents.length > 0) {
    const saveResult = await saveDiscoveredFamilyEvents({
      discovery_run_id: "cron",
      eventIndexes: selectedEvents.map((_, i) => i + 1),
      confirmSave: true,
      candidates: selectedEvents,
      startDate: discovered.dateWindow.startDate,
      endDate: discovered.dateWindow.endDate,
    });
    if (!saveResult.ok) errors.push(...saveResult.errors);
    eventsCreated = saveResult.saved.length;
    createdRecordIds = saveResult.saved
      .map((s) => s.airtableRecordId)
      .filter((id): id is string => !!id);
  }

  if (discovered.duplicatesSkipped > 0) {
    logger.info(
      `Daily web discovery skipped ${discovered.duplicatesSkipped} duplicates/rejects`,
      "daily-web-discovery",
    );
  }

  return {
    ok: errors.length === 0 || eventsCreated > 0 || dryRun,
    runAt: discovered.runAt,
    dateWindow: discovered.dateWindow,
    sourcePreferencesLoaded: discovered.sourcePreferencesLoaded,
    candidatesFound: discovered.candidatesFound,
    candidatesValid: discovered.candidatesValid,
    duplicatesSkipped: discovered.duplicatesSkipped,
    eventsSelected: selectedEvents.length,
    eventsCreated,
    dryRun,
    errors,
    selectedEvents,
    createdRecordIds,
  };
}
