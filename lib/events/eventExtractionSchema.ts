import { z } from "zod";

const tzLiteral = z.literal("America/Los_Angeles");

const extractedEventSchema = z.object({
  title: z.string().min(1),
  description: z.string().nullable(),
  venue_name: z.string().nullable(),
  address: z.string().nullable(),
  city: z.string().nullable(),
  county: z.string().nullable(),
  start_datetime: z.string().nullable(),
  end_datetime: z.string().nullable(),
  timezone: tzLiteral,
  age_range: z.string().nullable(),
  price_text: z.string().nullable(),
  registration_url: z.string().nullable(),
  source_event_url: z.string().nullable(),
  family_friendly_score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
  needs_human_review: z.boolean(),
  reasoning_summary: z.string(),
  possible_existing_duplicate_key: z.string().nullable().optional(),
});

export const eventExtractionSchema = z.object({
  source_summary: z.string(),
  new_events: z.array(extractedEventSchema),
  updated_events: z.array(extractedEventSchema),
  cancelled_events: z.array(
    z.object({
      title: z.string(),
      source_event_url: z.string().nullable(),
      start_datetime: z.string().nullable(),
      confidence: z.number().min(0).max(1),
      needs_human_review: z.boolean(),
      reasoning_summary: z.string(),
    }),
  ),
  irrelevant_content: z.array(
    z.object({
      text: z.string(),
      reason: z.string(),
    }),
  ),
  warnings: z.array(z.string()),
});

export type EventExtractionResult = z.infer<typeof eventExtractionSchema>;
