/**
 * Zod schema for SacFam Event Source Monitoring Agent OpenAI structured output.
 *
 * Field names use snake_case to match the prompt and OpenAI response convention.
 * Services map to camelCase before persisting to Prisma.
 */

import { z } from "zod";

export const EVENT_CHANGE_TYPES = [
  "new_event",
  "updated_event",
  "canceled_event",
  "duplicate_possible",
  "stale_event",
  "no_change",
  "needs_manual_review",
] as const;

export const CALENDAR_READY_VALUES = ["yes", "no", "needs_review"] as const;
export const EVENT_REVIEW_STATUSES = [
  "pending",
  "approved",
  "rejected",
  "needs_edit",
  "duplicate",
] as const;

export const eventCandidateSchema = z.object({
  event_title: z.string().min(1),
  event_url: z.string().nullable(),
  source_name: z.string(),
  source_url: z.string(),
  event_date: z.string().nullable(),
  event_start_time: z.string().nullable(),
  event_end_time: z.string().nullable(),
  location_name: z.string().nullable(),
  street_address: z.string().nullable(),
  city: z.string().nullable(),
  county_or_region: z.string().nullable(),
  event_category: z.string().nullable(),
  family_age_range: z.string().nullable(),
  cost: z.string().nullable(),
  registration_required: z.boolean().nullable(),
  description_summary: z.string(),
  why_relevant_for_families: z.string(),
  confidence_score: z.number().min(0).max(1),
  admin_review_required: z.boolean(),
  change_type: z.enum(EVENT_CHANGE_TYPES),
  calendar_ready: z.enum(CALENDAR_READY_VALUES),
  missing_fields: z.array(z.string()),
  review_status: z.enum(EVENT_REVIEW_STATUSES).default("pending"),
  notes: z.string().nullable(),
});

export const eventMonitorSchema = z.object({
  source_active: z.boolean(),
  source_summary: z.string(),
  new_events_found: z.number().int().min(0),
  updated_events_found: z.number().int().min(0),
  events_needing_review: z.number().int().min(0),
  calendar_ready_events: z.number().int().min(0),
  events: z.array(eventCandidateSchema),
  warnings: z.array(z.string()),
});

export type EventCandidatePayload = z.infer<typeof eventCandidateSchema>;
export type EventMonitorPayload = z.infer<typeof eventMonitorSchema>;
