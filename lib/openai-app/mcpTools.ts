import { z } from "zod";

import { listRecentDiscoveredFamilyEvents } from "@/lib/airtable/familyEventsRepository";
import {
  discoverFamilyEventsOnly,
  saveDiscoveredFamilyEvents,
} from "@/lib/events/dailyWebEventDiscoveryService";
import { readDailyWebEventDiscoveryConfig } from "@/lib/events/dailyWebEventDiscoveryEnv";
import {
  checkOpenAiAppAvailability,
  getOpenAiAppStatusSnapshot,
} from "@/lib/openai-app/openaiAppEnv";
import {
  createDiscoveryRun,
  getDiscoveryRun,
  markDiscoveryRunSaved,
} from "@/lib/openai-app/discoveryRunRepository";

function mcpError(message: string): { content: Array<{ type: "text"; text: string }>; isError: true } {
  return {
    content: [{ type: "text", text: message }],
    isError: true,
  };
}

function mcpJson(data: unknown): { content: Array<{ type: "text"; text: string }> } {
  return {
    content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
  };
}

const discoverInputSchema = z.object({
  city: z.string().optional(),
  lookaheadDays: z.number().int().min(1).max(60).optional(),
  limit: z.number().int().min(1).max(9).optional(),
  dryRun: z.boolean().optional(),
});

const saveInputSchema = z.object({
  discovery_run_id: z.string().min(1),
  eventIndexes: z.array(z.number().int().min(1)).min(1),
  confirmSave: z.boolean(),
});

export async function handleDiscoverFamilyEvents(
  args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const availability = checkOpenAiAppAvailability();
  if (!availability.ok) return mcpError(availability.message);

  const parsed = discoverInputSchema.safeParse(args ?? {});
  if (!parsed.success) return mcpError(parsed.error.message);

  const config = readDailyWebEventDiscoveryConfig();
  const result = await discoverFamilyEventsOnly({
    city: parsed.data.city,
    lookaheadDays: parsed.data.lookaheadDays,
    limit: parsed.data.limit,
    dryRun: parsed.data.dryRun ?? true,
  });

  if (!result.ok) {
    return mcpError(result.message ?? "Discovery failed.");
  }

  const { discovery_run_id, expiresAt } = await createDiscoveryRun({
    city: parsed.data.city,
    lookaheadDays: parsed.data.lookaheadDays ?? config.lookaheadDays,
    limit: parsed.data.limit ?? config.limit,
    dryRun: parsed.data.dryRun ?? true,
    startDate: result.dateWindow.startDate,
    endDate: result.dateWindow.endDate,
    candidates: result.candidates,
    summary: {
      candidatesFound: result.candidatesFound,
      candidatesValid: result.candidatesValid,
      duplicatesSkipped: result.duplicatesSkipped,
      dateWindow: result.dateWindow,
    },
  });

  const candidates = result.candidates.map((event, idx) => ({
    index: idx + 1,
    event_title: event.event_title,
    event_url: event.event_url,
    source_url: event.source_url,
    event_description: event.event_description,
    event_date: event.event_date,
    day_of_week: event.day_of_week,
    start_time: event.start_time,
    end_time: event.end_time,
    location_name: event.location_name,
    street_address: event.street_address,
    city: event.city,
    google_maps_url: event.google_maps_url,
    confidence_score: event.confidence_score,
    missing_fields: event.missing_fields,
    review_status: event.review_status,
    calendar_ready: event.calendar_ready,
  }));

  return mcpJson({
    ok: true,
    discovery_run_id,
    expiresAt,
    dateWindow: result.dateWindow,
    candidatesFound: result.candidatesFound,
    candidatesValid: result.candidatesValid,
    duplicatesSkipped: result.duplicatesSkipped,
    dryRun: parsed.data.dryRun ?? true,
    message:
      "Use discovery_run_id with save_discovered_events and confirmSave=true to write selected indexes to Airtable as Need Review.",
    candidates,
  });
}

export async function handleSaveDiscoveredEvents(
  args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const availability = checkOpenAiAppAvailability();
  if (!availability.ok) return mcpError(availability.message);

  const parsed = saveInputSchema.safeParse(args ?? {});
  if (!parsed.success) return mcpError(parsed.error.message);

  const runResult = await getDiscoveryRun(parsed.data.discovery_run_id);
  if (!runResult.ok) return mcpError(runResult.message);

  const saveResult = await saveDiscoveredFamilyEvents({
    discovery_run_id: parsed.data.discovery_run_id,
    eventIndexes: parsed.data.eventIndexes,
    confirmSave: parsed.data.confirmSave,
    candidates: runResult.run.candidates,
    startDate: runResult.run.startDate,
    endDate: runResult.run.endDate,
  });

  if (saveResult.ok && saveResult.saved.length > 0) {
    await markDiscoveryRunSaved(parsed.data.discovery_run_id);
  }

  return mcpJson(saveResult);
}

export async function handleGetDailyEventDiscoveryStatus(): Promise<{
  content: Array<{ type: "text"; text: string }>;
}> {
  return mcpJson(getOpenAiAppStatusSnapshot());
}

export async function handleListRecentDiscoveredEvents(
  args: unknown,
): Promise<{ content: Array<{ type: "text"; text: string }>; isError?: boolean }> {
  const availability = checkOpenAiAppAvailability();
  if (!availability.ok) return mcpError(availability.message);

  const schema = z.object({
    limit: z.number().int().min(1).max(50).optional(),
    days: z.number().int().min(1).max(90).optional(),
  });
  const parsed = schema.safeParse(args ?? {});
  if (!parsed.success) return mcpError(parsed.error.message);

  const result = await listRecentDiscoveredFamilyEvents(parsed.data);
  if (!result.ok) return mcpError(result.message);
  return mcpJson({ ok: true, events: result.events });
}
