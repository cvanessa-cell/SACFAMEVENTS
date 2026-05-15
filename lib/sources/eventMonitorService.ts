/**
 * Event monitor service.
 *
 * Admin-triggered, synchronous OpenAI-powered event monitor for one EventSource.
 * Writes results to EventCandidate (staging) — NEVER directly to FamilyEvent.
 * This is intentionally parallel to and decoupled from the cron-driven
 * sourceChecker pipeline; promotion of approved candidates into FamilyEvent
 * happens via the approveEventCandidate function below.
 */

import { zodTextFormat } from "openai/helpers/zod";

import { tryGetAgentOpenAIClient } from "@/lib/ai/openaiClient";
import {
  buildEventMonitorUserPrompt,
  SACFAM_EVENT_MONITOR_PROMPT_VERSION,
  SACFAM_EVENT_MONITOR_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/sacfamEventMonitorPrompt";
import { checkEventMonitorAvailability } from "@/lib/ai/sacfamAgentEnv";
import { eventMonitorSchema } from "@/lib/ai/schemas/eventMonitorSchema";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

const RESPONSE_PREVIEW_LIMIT = 4000;
const SNAPSHOT_TEXT_CAP = 120000;

async function fetchSnapshot(url: string): Promise<string> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent": "FamilyEventsMonitor/1.0 (+sacfam-event-monitor)",
      },
    });
    const raw = await res.text();
    return raw
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<nav[\s\S]*?<\/nav>/gi, " ")
      .replace(/\s+/g, " ")
      .trim();
  } finally {
    clearTimeout(timer);
  }
}

export interface RunEventMonitorOptions {
  sourceId: string;
}

export type RunEventMonitorResult =
  | {
      ok: true;
      runId: string;
      candidateCount: number;
      newEventsFound: number;
      updatedEventsFound: number;
      eventsNeedingReview: number;
      calendarReadyEvents: number;
    }
  | {
      ok: false;
      reason:
        | "event_monitor_flag_off"
        | "openai_key_missing"
        | "source_not_found"
        | "fetch_failed"
        | "openai_call_failed"
        | "schema_validation_failed";
      message: string;
      runId?: string;
    };

export async function runEventMonitorForSource(
  options: RunEventMonitorOptions,
): Promise<RunEventMonitorResult> {
  const availability = checkEventMonitorAvailability();
  if (!availability.ok) {
    const reason: "event_monitor_flag_off" | "openai_key_missing" =
      availability.reason === "openai_key_missing"
        ? "openai_key_missing"
        : "event_monitor_flag_off";
    return {
      ok: false,
      reason,
      message: availability.message ?? "Event monitor disabled.",
    };
  }
  const clientResult = tryGetAgentOpenAIClient();
  if (!clientResult.ok) {
    return {
      ok: false,
      reason: clientResult.reason,
      message: clientResult.message,
    };
  }

  const source = await prisma.eventSource.findUnique({
    where: { id: options.sourceId },
  });
  if (!source) {
    return {
      ok: false,
      reason: "source_not_found",
      message: `EventSource ${options.sourceId} not found.`,
    };
  }

  const startedAt = new Date();
  const run = await prisma.eventMonitorRun.create({
    data: {
      status: "running",
      sourceId: source.id,
      model: availability.config.model,
      promptVersion: SACFAM_EVENT_MONITOR_PROMPT_VERSION,
      startedAt,
    },
  });

  let snapshot: string;
  try {
    snapshot = (await fetchSnapshot(source.sourceUrl)).slice(0, SNAPSHOT_TEXT_CAP);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Fetch failed";
    await prisma.eventMonitorRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: message, completedAt: new Date() },
    });
    return { ok: false, reason: "fetch_failed", message, runId: run.id };
  }

  let responseText: string;
  try {
    const response = await clientResult.client.responses.create({
      model: availability.config.model,
      input: [
        {
          role: "system",
          content: SACFAM_EVENT_MONITOR_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [
            {
              type: "input_text",
              text: buildEventMonitorUserPrompt({
                source: {
                  name: source.name,
                  url: source.sourceUrl,
                  category: source.category,
                  city: source.city,
                  county: source.county,
                },
                changedText: snapshot,
              }),
            },
          ],
        },
      ],
      text: {
        format: zodTextFormat(eventMonitorSchema, "sacfam_event_monitor"),
      },
    });
    responseText = response.output_text ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";
    await prisma.eventMonitorRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: message, completedAt: new Date() },
    });
    logger.error("Event monitor OpenAI call failed", error, "sacfam-event-monitor");
    return { ok: false, reason: "openai_call_failed", message, runId: run.id };
  }

  const preview = responseText.slice(0, RESPONSE_PREVIEW_LIMIT);
  let parsed;
  try {
    parsed = eventMonitorSchema.parse(JSON.parse(responseText));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse model output";
    await prisma.eventMonitorRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: message,
        rawResponsePreview: preview,
        completedAt: new Date(),
      },
    });
    logger.error("Event monitor output rejected", error, "sacfam-event-monitor");
    return {
      ok: false,
      reason: "schema_validation_failed",
      message,
      runId: run.id,
    };
  }

  if (parsed.events.length > 0) {
    await prisma.eventCandidate.createMany({
      data: parsed.events.map((ev) => ({
        monitorRunId: run.id,
        sourceId: source.id,
        eventTitle: ev.event_title,
        eventUrl: ev.event_url,
        sourceName: ev.source_name || source.name,
        sourceUrl: ev.source_url || source.sourceUrl,
        eventDate: ev.event_date,
        eventStartTime: ev.event_start_time,
        eventEndTime: ev.event_end_time,
        locationName: ev.location_name,
        streetAddress: ev.street_address,
        city: ev.city,
        countyOrRegion: ev.county_or_region,
        eventCategory: ev.event_category,
        familyAgeRange: ev.family_age_range,
        cost: ev.cost,
        registrationRequired: ev.registration_required,
        descriptionSummary: ev.description_summary,
        whyRelevantForFamilies: ev.why_relevant_for_families,
        confidenceScore: ev.confidence_score,
        adminReviewRequired: ev.admin_review_required,
        changeType: ev.change_type,
        calendarReady: ev.calendar_ready,
        missingFieldsJson: JSON.stringify(ev.missing_fields ?? []),
        notes: ev.notes,
      })),
    });
  }

  await prisma.eventMonitorRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      sourcesChecked: 1,
      newEventsFound: parsed.new_events_found,
      updatedEventsFound: parsed.updated_events_found,
      eventsNeedingReview: parsed.events_needing_review,
      calendarReadyEvents: parsed.calendar_ready_events,
      rawResponsePreview: preview,
      completedAt: new Date(),
    },
  });

  return {
    ok: true,
    runId: run.id,
    candidateCount: parsed.events.length,
    newEventsFound: parsed.new_events_found,
    updatedEventsFound: parsed.updated_events_found,
    eventsNeedingReview: parsed.events_needing_review,
    calendarReadyEvents: parsed.calendar_ready_events,
  };
}

export type ApproveEventCandidateResult =
  | {
      ok: true;
      familyEventId: string;
      candidateId: string;
      created: boolean;
    }
  | {
      ok: false;
      reason: "candidate_not_found" | "already_approved" | "dry_run_blocked";
      message: string;
    };

/**
 * Promote an EventCandidate into a FamilyEvent. Honors dry-run.
 * Does not handle full deduplication against existing FamilyEvent rows here;
 * defers to existing dedupe helpers if/when the user wires this into auto-approve.
 */
export async function approveEventCandidate(
  candidateId: string,
  options: { note?: string | null } = {},
): Promise<ApproveEventCandidateResult> {
  const availability = checkEventMonitorAvailability();
  if (availability.config.dryRun) {
    return {
      ok: false,
      reason: "dry_run_blocked",
      message:
        "SACFAM_SOURCE_AGENT_DRY_RUN is true. Disable dry-run to import event candidates.",
    };
  }
  const candidate = await prisma.eventCandidate.findUnique({
    where: { id: candidateId },
  });
  if (!candidate) {
    return {
      ok: false,
      reason: "candidate_not_found",
      message: `Event candidate ${candidateId} not found.`,
    };
  }
  if (candidate.reviewStatus === "approved" && candidate.promotedFamilyEventId) {
    return {
      ok: false,
      reason: "already_approved",
      message: "Candidate already approved and promoted.",
    };
  }

  const startDatetime = combineDateTime(
    candidate.eventDate,
    candidate.eventStartTime,
  );
  const endDatetime = combineDateTime(
    candidate.eventDate,
    candidate.eventEndTime,
  );

  const familyEvent = await prisma.familyEvent.create({
    data: {
      title: candidate.eventTitle,
      description: candidate.descriptionSummary || null,
      sourceEventUrl: candidate.eventUrl,
      sourceId: candidate.sourceId,
      city: candidate.city,
      county: candidate.countyOrRegion,
      venueName: candidate.locationName,
      address: candidate.streetAddress,
      startDatetime,
      endDatetime,
      ageRange: candidate.familyAgeRange,
      priceText: candidate.cost,
      confidence: candidate.confidenceScore,
      status: "needs_review",
    },
  });

  await prisma.eventCandidate.update({
    where: { id: candidate.id },
    data: {
      reviewStatus: "approved",
      promotedFamilyEventId: familyEvent.id,
      notes: options.note?.trim() ? options.note.trim() : candidate.notes,
    },
  });

  return {
    ok: true,
    familyEventId: familyEvent.id,
    candidateId: candidate.id,
    created: true,
  };
}

export async function rejectEventCandidate(
  candidateId: string,
  note?: string | null,
) {
  const candidate = await prisma.eventCandidate.findUnique({
    where: { id: candidateId },
  });
  if (!candidate) {
    return { ok: false as const, reason: "candidate_not_found" as const };
  }
  await prisma.eventCandidate.update({
    where: { id: candidateId },
    data: {
      reviewStatus: "rejected",
      notes: note?.trim() ? note.trim() : candidate.notes,
    },
  });
  return { ok: true as const };
}

function combineDateTime(
  date: string | null,
  time: string | null,
): Date | null {
  if (!date) return null;
  const normalizedDate = date.trim();
  if (!/^\d{4}-\d{2}-\d{2}/.test(normalizedDate)) return null;
  const trimmedTime = (time ?? "").trim();
  const iso =
    trimmedTime && /^\d{1,2}:\d{2}/.test(trimmedTime)
      ? `${normalizedDate}T${trimmedTime.length === 4 ? `0${trimmedTime}` : trimmedTime}`
      : `${normalizedDate}T00:00:00`;
  const parsed = new Date(iso);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export const __testing = { combineDateTime };
