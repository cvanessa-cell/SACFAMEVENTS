/**
 * Source research service.
 *
 * Orchestrates one run of the SacFam AI Source Research Agent:
 *   1. Pre-check feature flag + OpenAI key (graceful failure).
 *   2. Create a SourceResearchRun row in "running" status.
 *   3. Call OpenAI Responses API with the source-research prompt + Zod text format.
 *   4. Validate response with Zod, dedupe against existing EventSource rows,
 *      compute deterministic scores, persist SourceResearchCandidate rows.
 *   5. Mark run "completed" or "failed" with error message on rejection.
 *
 * IMPORTANT:
 * - Auto-imports EventSource + Airtable catalog rows when deterministicScore > 0.5,
 *   unless SACFAM_SOURCE_AGENT_DRY_RUN is enabled.
 * - Respects SACFAM_SOURCE_AGENT_MAX_SOURCES as the requested-count cap.
 * - Persists a preview of the raw model output for debugging (never the API key).
 */

import { zodTextFormat } from "openai/helpers/zod";

import { tryGetAgentOpenAIClient } from "@/lib/ai/openaiClient";
import {
  buildSourceResearchUserPrompt,
  SACFAM_SOURCE_RESEARCH_PROMPT_VERSION,
  SACFAM_SOURCE_RESEARCH_SYSTEM_PROMPT,
} from "@/lib/ai/prompts/sacfamSourceResearchPrompt";
import { checkSourceAgentAvailability } from "@/lib/ai/sacfamAgentEnv";
import {
  parseSourceResearchCandidates,
  sourceResearchSchema,
  type SourceResearchCandidatePayload,
} from "@/lib/ai/schemas/sourceResearchSchema";
import {
  createEventSourceRecord,
  listExistingAirtableSourcesForDedupe,
} from "@/lib/airtable/eventSourceCatalogRepository";
import {
  createSourceCandidateRecords,
  updateSourceCandidateByCandidateId,
} from "@/lib/airtable/sourceCandidateRepository";
import {
  createSourceResearchRunRecord,
  updateSourceResearchRunRecord,
} from "@/lib/airtable/sourceResearchRunRepository";
import { logger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import {
  createDuplicateCheckKey,
  findLikelyDuplicate,
  normalizeUrl,
} from "@/lib/sources/sourceDeduplication";
import {
  AUTO_APPROVE_NOTE,
  shouldAutoApproveSourceCandidate,
} from "@/lib/sources/sourceAutoApproval";
import { computeDeterministicSourceScore } from "@/lib/sources/sourceScoring";

const RESPONSE_PREVIEW_LIMIT = 4000;
const PENDING_REVIEW_AUTOMATION_FITS = new Set<SourceResearchCandidatePayload["automation_fit"]>([
  "poor",
  "manual_only",
]);
const AUTO_REJECT_DUPLICATE_NOTE = "Auto-rejected: duplicate source candidate.";

export interface RunSourceResearchOptions {
  requestedBy?: string | null;
  /** Optional override for the requested source count (clamped to env cap). */
  requestedSourceCount?: number;
  /** Optional override for target geography label saved on the run. */
  targetRegion?: string;
}

export type RunSourceResearchResult =
  | {
      ok: true;
      runId: string;
      parsedSourceCount: number;
      validCandidateCount: number;
      invalidRecordCount: number;
      duplicateCount: number;
      savedCandidateCount: number;
      autoApprovedCount: number;
      needsVerificationCount: number;
      dryRun: boolean;
      airtableEnabled: boolean;
      airtableMessage?: string;
    }
  | {
      ok: false;
      reason:
        | "source_agent_flag_off"
        | "openai_key_missing"
        | "openai_call_failed"
        | "schema_validation_failed";
      message: string;
      runId?: string;
    };

function appendSystemNote(existing: string | null, note: string): string {
  const normalized = existing?.trim() ?? "";
  if (!normalized) return note;
  if (normalized.toLowerCase().includes(note.toLowerCase())) return normalized;
  return `${normalized}\n\n${note}`;
}

export async function runSourceResearch(
  options: RunSourceResearchOptions = {},
): Promise<RunSourceResearchResult> {
  const availability = checkSourceAgentAvailability();
  if (!availability.ok) {
    const reason: "source_agent_flag_off" | "openai_key_missing" =
      availability.reason === "openai_key_missing"
        ? "openai_key_missing"
        : "source_agent_flag_off";
    return {
      ok: false,
      reason,
      message: availability.message ?? "Source agent disabled.",
    };
  }
  const config = availability.config;
  const clientResult = tryGetAgentOpenAIClient();
  if (!clientResult.ok) {
    return {
      ok: false,
      reason: clientResult.reason,
      message: clientResult.message,
    };
  }

  const requested = Math.min(
    config.maxSources,
    Math.max(1, options.requestedSourceCount ?? config.maxSources),
  );
  const targetRegion = options.targetRegion ?? "Sacramento / Placer";
  const startedAt = new Date();

  const run = await prisma.sourceResearchRun.create({
    data: {
      status: "running",
      requestedBy: options.requestedBy ?? null,
      targetRegion,
      requestedSourceCount: requested,
      model: config.model,
      promptVersion: SACFAM_SOURCE_RESEARCH_PROMPT_VERSION,
      rawRequestSummary: `Source research run for "${targetRegion}", requesting ${requested} candidates`,
      startedAt,
    },
  });

  const airtableRun = await createSourceResearchRunRecord({
    "Run ID": run.id,
    Status: "running",
    "Requested Source Count": requested,
    Model: config.sourceResearchModel,
    "Prompt Version": SACFAM_SOURCE_RESEARCH_PROMPT_VERSION,
    "Started At": startedAt.toISOString(),
  }).catch((error) => {
    logger.warn("Airtable source research run create failed", "sacfam-source-research", {
      error: error instanceof Error ? error.message : String(error),
    });
    return { ok: false as const, message: "Airtable run create failed." };
  });

  const prismaExisting = await prisma.eventSource.findMany({
    select: { id: true, name: true, sourceUrl: true, city: true, category: true },
  });
  const airtableExisting = await listExistingAirtableSourcesForDedupe().catch((error) => {
    logger.warn("Airtable source dedupe read failed", "sacfam-source-research", {
      error: error instanceof Error ? error.message : String(error),
    });
    return [];
  });
  const existing = [...prismaExisting, ...airtableExisting];

  const userPrompt = buildSourceResearchUserPrompt({
    sourceCount: requested,
    targetRegion,
    existingSources: existing.map((source) => ({
      name: source.name,
      url: source.sourceUrl,
    })),
  });

  let responseText: string;
  try {
    const response = await clientResult.client.responses.create({
      model: config.sourceResearchModel,
      input: [
        {
          role: "system",
          content: SACFAM_SOURCE_RESEARCH_SYSTEM_PROMPT,
        },
        {
          role: "user",
          content: [{ type: "input_text", text: userPrompt }],
        },
      ],
      text: {
        format: zodTextFormat(sourceResearchSchema, "sacfam_source_research"),
      },
    });
    responseText = response.output_text ?? "";
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";
    await prisma.sourceResearchRun.update({
      where: { id: run.id },
      data: { status: "failed", errorMessage: message, completedAt: new Date() },
    });
    if (airtableRun.ok) {
      await updateSourceResearchRunRecord(airtableRun.record.id, {
        Status: "failed",
        "Error Message": message,
        "Completed At": new Date().toISOString(),
      }).catch(() => undefined);
    }
    logger.error("Source research OpenAI call failed", error, "sacfam-source-research");
    return { ok: false, reason: "openai_call_failed", message, runId: run.id };
  }

  const preview = responseText.slice(0, RESPONSE_PREVIEW_LIMIT);
  let parsed: { sources: unknown[]; source_count?: number };
  try {
    const json = JSON.parse(responseText);
    const topLevel = sourceResearchSchema.safeParse(json);
    if (!topLevel.success) {
      const candidateList = (json as { sources?: unknown }).sources;
      if (!Array.isArray(candidateList)) throw topLevel.error;
      parsed = {
        sources: candidateList,
        source_count:
          typeof (json as { source_count?: unknown }).source_count === "number"
            ? (json as { source_count: number }).source_count
            : candidateList.length,
      };
    } else {
      parsed = topLevel.data;
    }
    if (!Array.isArray(parsed.sources)) {
      throw new Error("OpenAI response did not include a sources array.");
    }
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Failed to parse model output";
    await prisma.sourceResearchRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        errorMessage: message,
        rawResponsePreview: preview,
        completedAt: new Date(),
      },
    });
    if (airtableRun.ok) {
      await updateSourceResearchRunRecord(airtableRun.record.id, {
        Status: "failed",
        "Error Message": message,
        "Raw Response Preview": preview,
        "Completed At": new Date().toISOString(),
      }).catch(() => undefined);
    }
    logger.error("Source research output rejected", error, "sacfam-source-research");
    return {
      ok: false,
      reason: "schema_validation_failed",
      message,
      runId: run.id,
    };
  }

  const { validCandidates, invalidRecordErrors } = parseSourceResearchCandidates(
    parsed.sources,
  );

  let duplicateCount = 0;
  let needsVerificationCount = 0;
  const seenInRun = new Set<string>();
  const candidatesToCreate: Array<{
    payload: SourceResearchCandidatePayload;
    normalizedUrl: string;
    deterministicScore: number;
    duplicateOfSourceId: string | null;
    importStatus: string;
  }> = [];

  for (const item of validCandidates) {
    let payload: SourceResearchCandidatePayload = item;
    const normalizedUrl = normalizeUrl(item.source_url);
    const dedupe = findLikelyDuplicate(
      {
        sourceName: item.source_name,
        sourceUrl: item.source_url,
        cityOrAreaServed: item.city_or_area_served,
        sourceCategory: item.source_category,
      },
      existing,
    );
    let importStatus: string;
    if (dedupe.strength === "strong") {
      importStatus = "rejected";
      duplicateCount += 1;
      payload = {
        ...item,
        notes: appendSystemNote(item.notes, AUTO_REJECT_DUPLICATE_NOTE),
      };
    } else if (seenInRun.has(normalizedUrl) && normalizedUrl !== "") {
      importStatus = "rejected";
      duplicateCount += 1;
      payload = {
        ...item,
        notes: appendSystemNote(item.notes, AUTO_REJECT_DUPLICATE_NOTE),
      };
    } else if (PENDING_REVIEW_AUTOMATION_FITS.has(item.automation_fit)) {
      importStatus = "pending_review";
    } else {
      importStatus = "needs_verification";
      needsVerificationCount += 1;
    }
    if (normalizedUrl) seenInRun.add(normalizedUrl);
    const deterministicScore = computeDeterministicSourceScore({
      source_type: item.source_type,
      freshness_likelihood: item.freshness_likelihood,
      automation_fit: item.automation_fit,
      verification_status: item.verification_status,
      review_priority: item.review_priority,
      relevance_score: item.relevance_score,
    });
    candidatesToCreate.push({
      payload,
      normalizedUrl,
      deterministicScore,
      duplicateOfSourceId: dedupe.existingSourceId ?? null,
      importStatus,
    });
  }

  const createdPrismaCandidates: Array<{
    id: string;
    payload: SourceResearchCandidatePayload;
    duplicateOfSourceId: string | null;
    importStatus: string;
    deterministicScore: number;
  }> = [];

  for (const c of candidatesToCreate) {
    const candidate = await prisma.sourceResearchCandidate.create({
      data: {
        runId: run.id,
        sourceName: c.payload.source_name,
        sourceUrl: c.payload.source_url,
        normalizedUrl: c.normalizedUrl,
        sourceCategory: c.payload.source_category,
        sourceType: c.payload.source_type,
        cityOrAreaServed: c.payload.city_or_area_served,
        countyOrRegion: c.payload.county_or_region,
        eventTypesJson: JSON.stringify(c.payload.event_types ?? []),
        familyRelevance: c.payload.family_relevance,
        whyUsefulForSacfamEvents: c.payload.why_useful_for_sacfam_events,
        estimatedUpdateFrequency: c.payload.estimated_update_frequency,
        freshnessLikelihood: c.payload.freshness_likelihood,
        automationFit: c.payload.automation_fit,
        recommendedIngestionMethod: c.payload.recommended_ingestion_method,
        reviewPriority: c.payload.review_priority,
        relevanceScore: c.payload.relevance_score,
        deterministicScore: c.deterministicScore,
        verificationStatus: c.payload.verification_status,
        notes: c.payload.notes,
        duplicateOfSourceId: c.duplicateOfSourceId,
        importStatus: c.importStatus,
      },
    });
    createdPrismaCandidates.push({
      id: candidate.id,
      payload: c.payload,
      duplicateOfSourceId: c.duplicateOfSourceId,
      importStatus: c.importStatus,
      deterministicScore: c.deterministicScore,
    });
  }

  let autoApprovedCount = 0;
  if (!config.dryRun) {
    for (const candidate of createdPrismaCandidates) {
      if (
        !shouldAutoApproveSourceCandidate({
          deterministicScore: candidate.deterministicScore,
          importStatus: candidate.importStatus,
          duplicateOfSourceId: candidate.duplicateOfSourceId,
        })
      ) {
        continue;
      }
      const approval = await approveSourceCandidate({
        candidateId: candidate.id,
        note: AUTO_APPROVE_NOTE,
      });
      if (approval.ok) {
        autoApprovedCount += 1;
      } else {
        logger.warn("Source candidate auto-approve skipped", "sacfam-source-research", {
          candidateId: candidate.id,
          reason: approval.reason,
          message: approval.message,
        });
      }
    }
  }

  let airtableMessage: string | undefined;
  if (createdPrismaCandidates.length > 0) {
    const airtableCandidates = await createSourceCandidateRecords(
      createdPrismaCandidates.map((candidate) => ({
        candidateId: candidate.id,
        runId: run.id,
        payload: candidate.payload,
        duplicateOf: candidate.duplicateOfSourceId,
        importStatus: candidate.importStatus,
      })),
    ).catch((error) => {
      logger.warn("Airtable source candidates create failed", "sacfam-source-research", {
        error: error instanceof Error ? error.message : String(error),
      });
      return { ok: false as const, message: "Airtable candidate create failed." };
    });
    if (!airtableCandidates.ok) airtableMessage = airtableCandidates.message;
  }

  const completedAt = new Date();
  const invalidSummary = invalidRecordErrors.length
    ? `Invalid source records: ${invalidRecordErrors.slice(0, 20).join(" | ")}`
    : null;

  await prisma.sourceResearchRun.update({
    where: { id: run.id },
    data: {
      status: "completed",
      parsedSourceCount: validCandidates.length,
      rawResponsePreview: preview,
      errorMessage: invalidSummary,
      completedAt,
    },
  });
  if (airtableRun.ok) {
    await updateSourceResearchRunRecord(airtableRun.record.id, {
      Status: "completed",
      "Parsed Source Count": validCandidates.length,
      "Saved Candidate Count": createdPrismaCandidates.length,
      "Duplicate Count": duplicateCount,
      "Error Message": invalidSummary ?? undefined,
      "Raw Response Preview": preview,
      "Completed At": completedAt.toISOString(),
    }).catch((error) => {
      logger.warn("Airtable source research run update failed", "sacfam-source-research", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  // Dry-run is enforced at approval time, not at run time.
  // The run/candidate rows are always safe to create.
  return {
    ok: true,
    runId: run.id,
    parsedSourceCount: validCandidates.length,
    validCandidateCount: validCandidates.length,
    invalidRecordCount: invalidRecordErrors.length,
    duplicateCount,
    savedCandidateCount: createdPrismaCandidates.length,
    autoApprovedCount,
    needsVerificationCount,
    dryRun: config.dryRun,
    airtableEnabled: airtableRun.ok && !airtableMessage,
    airtableMessage: airtableMessage ?? (!airtableRun.ok ? airtableRun.message : undefined),
  };
}

export interface ApproveCandidateOptions {
  candidateId: string;
  /** Override fetch strategy at import time; defaults to a conservative value. */
  fetchStrategy?: string;
  /** Override check frequency in minutes; defaults to env or 360. */
  checkFrequencyMinutes?: number;
  /** Optional admin note for audit. */
  note?: string | null;
}

export type ApproveCandidateResult =
  | {
      ok: true;
      eventSourceId: string;
      candidateId: string;
      created: boolean;
    }
  | {
      ok: false;
      reason: "candidate_not_found" | "already_imported" | "dry_run_blocked" | "duplicate";
      message: string;
    };

/**
 * Promote a candidate into the operational EventSource table.
 * Honors SACFAM_SOURCE_AGENT_DRY_RUN by refusing to write in dry-run mode.
 * Respects the unique sourceUrl constraint: if a row already exists, links it
 * rather than throwing.
 */
export async function approveSourceCandidate(
  options: ApproveCandidateOptions,
): Promise<ApproveCandidateResult> {
  const config = checkSourceAgentAvailability().config;
  if (config.dryRun) {
    return {
      ok: false,
      reason: "dry_run_blocked",
      message:
        "SACFAM_SOURCE_AGENT_DRY_RUN is true. Disable dry-run to import approved candidates.",
    };
  }
  const candidate = await prisma.sourceResearchCandidate.findUnique({
    where: { id: options.candidateId },
  });
  if (!candidate) {
    return {
      ok: false,
      reason: "candidate_not_found",
      message: `Candidate ${options.candidateId} not found.`,
    };
  }
  if (candidate.importStatus === "imported") {
    return {
      ok: false,
      reason: "already_imported",
      message: "Candidate already imported.",
    };
  }
  if (candidate.importStatus === "duplicate" || candidate.duplicateOfSourceId) {
    return {
      ok: false,
      reason: "duplicate",
      message:
        "Candidate is flagged as duplicate. Use 'mark duplicate' or reject instead.",
    };
  }
  const defaultInterval = Number.parseInt(
    process.env.EVENT_SOURCE_DEFAULT_CHECK_INTERVAL_MINUTES ?? "360",
    10,
  );
  const checkFrequencyMinutes =
    options.checkFrequencyMinutes ?? (Number.isFinite(defaultInterval) ? defaultInterval : 360);
  const fetchStrategy =
    options.fetchStrategy ?? fetchStrategyForCandidate(candidate.recommendedIngestionMethod);

  // upsert by unique sourceUrl
  const existing = await prisma.eventSource.findUnique({
    where: { sourceUrl: candidate.sourceUrl },
  });
  let eventSourceId: string;
  let created = false;
  if (existing) {
    eventSourceId = existing.id;
  } else {
    const insert = await prisma.eventSource.create({
      data: {
        name: candidate.sourceName,
        sourceUrl: candidate.sourceUrl,
        category: candidate.sourceCategory,
        city: candidate.cityOrAreaServed,
        county: candidate.countyOrRegion,
        region: candidate.cityOrAreaServed ?? candidate.countyOrRegion,
        sourceType: candidate.sourceType,
        fetchStrategy,
        checkFrequencyMinutes,
        enabled: true,
        trustedSourceScore: candidate.deterministicScore,
        notes: options.note ?? candidate.notes ?? null,
      },
    });
    eventSourceId = insert.id;
    created = true;
  }
  await prisma.sourceResearchCandidate.update({
    where: { id: candidate.id },
    data: {
      importStatus: "imported",
      importedSourceId: eventSourceId,
    },
  });
  const eventTypes = safeJsonStringArray(candidate.eventTypesJson);
  await createEventSourceRecord({
    "Source Name": candidate.sourceName,
    "Website / Social Link": candidate.sourceUrl,
    "Source Category": candidate.sourceCategory,
    "Source Type": candidate.sourceType,
    "City / Area Served": candidate.cityOrAreaServed ?? undefined,
    "County / Region": candidate.countyOrRegion ?? undefined,
    "Event Types": eventTypes.join(", "),
    "Family Relevance": candidate.familyRelevance,
    "Why Useful for SacFamEvents": candidate.whyUsefulForSacfamEvents,
    "Estimated Update Frequency": candidate.estimatedUpdateFrequency ?? undefined,
    "Freshness Likelihood": candidate.freshnessLikelihood,
    "Automation Fit": candidate.automationFit,
    "Recommended Ingestion Method": candidate.recommendedIngestionMethod,
    "Review Priority": candidate.reviewPriority,
    "Relevance Score": candidate.relevanceScore,
    "Verification Status": candidate.verificationStatus,
    Status: "approved",
    Notes: options.note ?? candidate.notes ?? undefined,
    "Created By AI": true,
    "Research Run ID": candidate.runId,
    "Duplicate Check Key": createDuplicateCheckKey({
      sourceUrl: candidate.sourceUrl,
      sourceName: candidate.sourceName,
      cityOrAreaServed: candidate.cityOrAreaServed,
    }),
  }).catch((error) => {
    logger.warn("Airtable approved source create failed", "sacfam-source-research", {
      error: error instanceof Error ? error.message : String(error),
    });
  });
  await updateSourceCandidateByCandidateId(candidate.id, {
    "Import Status": "imported",
    Status: "approved",
  }).catch(() => undefined);
  return { ok: true, eventSourceId, candidateId: candidate.id, created };
}

/** Map recommended_ingestion_method to operational EventSource.fetchStrategy. */
function fetchStrategyForCandidate(method: string): string {
  switch (method) {
    case "rss_or_feed_monitoring":
      return "rss_parse";
    case "official_calendar_monitoring":
    case "event_page_scrape_with_review":
      return "direct_fetch";
    case "social_monitoring_manual_review":
    case "event_platform_search":
    case "admin_manual_entry":
    case "zapier_or_webhook_possible":
    case "airtable_manual_source_tracking":
      return "manual_review";
    case "api_possible":
      return "direct_fetch";
    case "not_recommended_for_automation":
      return "disabled";
    default:
      return "direct_fetch";
  }
}

export async function rejectSourceCandidate(candidateId: string, note?: string | null) {
  const candidate = await prisma.sourceResearchCandidate.findUnique({
    where: { id: candidateId },
  });
  if (!candidate) {
    return { ok: false as const, reason: "candidate_not_found" as const };
  }
  await prisma.sourceResearchCandidate.update({
    where: { id: candidateId },
    data: {
      importStatus: "rejected",
      notes: note?.trim() ? note.trim() : candidate.notes,
    },
  });
  await updateSourceCandidateByCandidateId(candidateId, {
    "Import Status": "rejected",
    Status: "rejected",
    Notes: note?.trim() ? note.trim() : candidate.notes ?? undefined,
  }).catch(() => undefined);
  return { ok: true as const };
}

function safeJsonStringArray(value: string): string[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map((item) => String(item)) : [];
  } catch {
    return [];
  }
}

export const __testing = {
  fetchStrategyForCandidate,
  shouldAutoApproveSourceCandidate,
};
