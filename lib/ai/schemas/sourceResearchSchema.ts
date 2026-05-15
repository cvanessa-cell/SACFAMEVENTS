/**
 * Zod schema for SacFam Source Research Agent OpenAI structured output.
 *
 * Field names use snake_case to match the prompt and OpenAI response convention.
 * Services map to camelCase before persisting to Prisma.
 */

import { z } from "zod";

export const SOURCE_CATEGORIES = [
  "City and County Event Calendars",
  "Parks and Recreation",
  "Public Libraries",
  "Museums and Children's Museums",
  "Zoos and Nature Centers",
  "Theaters and Performance Venues",
  "Concert and Entertainment Venues",
  "Farmers Markets",
  "Festivals and Fairs",
  "School and Community Education",
  "Parent Blogs and Family Guides",
  "Local News Calendars",
  "Tourism and Visitor Bureaus",
  "Facebook / Instagram",
  "Event Platforms",
  "Churches and Nonprofits",
  "Sports and Family Entertainment",
  "Enrichment Programs",
  "Other",
] as const;

export const SOURCE_TYPES = [
  "official",
  "aggregator",
  "social",
  "venue",
  "community",
  "media",
  "education",
  "recreation",
  "nonprofit",
  "other",
] as const;

export const FRESHNESS_LIKELIHOODS = ["low", "medium", "high"] as const;

export const AUTOMATION_FITS = [
  "excellent",
  "good",
  "fair",
  "poor",
  "manual_only",
] as const;

export const REVIEW_PRIORITIES = ["high", "medium", "low"] as const;

export const VERIFICATION_STATUSES = [
  "verified",
  "likely_valid",
  "needs_verification",
] as const;

export const RECOMMENDED_INGESTION_METHODS = [
  "official_calendar_monitoring",
  "event_page_scrape_with_review",
  "rss_or_feed_monitoring",
  "social_monitoring_manual_review",
  "event_platform_search",
  "admin_manual_entry",
  "zapier_or_webhook_possible",
  "airtable_manual_source_tracking",
  "api_possible",
  "not_recommended_for_automation",
] as const;

export const SOURCE_STATUSES = [
  "proposed",
  "approved",
  "rejected",
  "paused",
  "archived",
] as const;

const urlLike = z
  .string()
  .min(1)
  .refine((value) => {
    try {
      const parsed = new URL(value);
      return parsed.protocol === "http:" || parsed.protocol === "https:";
    } catch {
      return false;
    }
  }, "Expected an http(s) URL");

export const sourceResearchCandidateSchema = z.object({
  source_name: z.string().min(1),
  source_url: urlLike,
  source_category: z.enum(SOURCE_CATEGORIES),
  source_type: z.enum(SOURCE_TYPES),
  city_or_area_served: z.string().nullable().default(null),
  county_or_region: z.string().nullable().default(null),
  event_types: z.array(z.string()),
  family_relevance: z.string(),
  why_useful_for_sacfam_events: z.string(),
  estimated_update_frequency: z.string().nullable().default(null),
  freshness_likelihood: z.enum(FRESHNESS_LIKELIHOODS),
  automation_fit: z.enum(AUTOMATION_FITS),
  recommended_ingestion_method: z.enum(RECOMMENDED_INGESTION_METHODS),
  review_priority: z.enum(REVIEW_PRIORITIES),
  relevance_score: z.number().min(1).max(10),
  verification_status: z.enum(VERIFICATION_STATUSES),
  status: z.enum(SOURCE_STATUSES).default("proposed"),
  notes: z.string().nullable().default(null),
});

export const sourceResearchSchema = z.object({
  project: z.literal("SacFamEvents").default("SacFamEvents"),
  purpose: z
    .string()
    .default("Sacramento-area family event discovery and calendar-planning source database"),
  target_region: z.array(z.string()).default([
    "Sacramento County",
    "Placer County",
    "nearby surrounding areas",
  ]),
  source_count: z.number().int().min(0).default(0),
  sources: z.array(sourceResearchCandidateSchema),
  warnings: z.array(z.string()).default([]),
});

export type SourceResearchCandidatePayload = z.infer<typeof sourceResearchCandidateSchema>;
export type SourceResearchPayload = z.infer<typeof sourceResearchSchema>;

export interface ParsedSourceResearchCandidates {
  validCandidates: SourceResearchCandidatePayload[];
  invalidRecordErrors: string[];
}

export function parseSourceResearchCandidates(
  records: unknown[],
): ParsedSourceResearchCandidates {
  const validCandidates: SourceResearchCandidatePayload[] = [];
  const invalidRecordErrors: string[] = [];
  records.forEach((record, index) => {
    const parsed = sourceResearchCandidateSchema.safeParse(record);
    if (parsed.success) {
      validCandidates.push(parsed.data);
    } else {
      invalidRecordErrors.push(
        `sources[${index}]: ${parsed.error.issues
          .map((issue) => `${issue.path.join(".") || "record"}: ${issue.message}`)
          .join("; ")}`,
      );
    }
  });
  return { validCandidates, invalidRecordErrors };
}
