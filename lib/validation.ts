import { z } from "zod";

export const sourceSchema = z.object({
  sourceName: z.string().min(1),
  sourceType: z.string(),
  cityArea: z.string().optional(),
  websiteUrl: z.string().url().optional().or(z.literal("")),
  facebookUrl: z.string().url().optional().or(z.literal("")),
  sourceLink: z.string().url().optional().or(z.literal("")),
  bestFor: z.string().optional(),
  howOftenToCheck: z.string().optional(),
  active: z.boolean().optional(),
  lastCheckedDate: z.string().optional(),
  notes: z.string().optional(),
  priority: z.number().optional(),
  scrapeMethod: z.string().optional(),
  requiresManualReview: z.boolean().optional(),
  sourceReliabilityScore: z.number().min(0).max(1).optional(),
});

export const venueSchema = z.object({
  venueName: z.string().min(1),
  address: z.string().optional(),
  city: z.string().optional(),
  website: z.string().url().optional().or(z.literal("")),
  indoorOutdoor: z.string().optional(),
  parkingNotes: z.string().optional(),
  restrooms: z.boolean().optional(),
  strollerFriendly: z.boolean().optional(),
  notes: z.string().optional(),
});

export const categorySchema = z.object({
  categoryName: z.string().min(1),
  calendarPrefix: z.string().optional(),
  description: z.string().optional(),
  defaultColor: z.string().optional(),
  active: z.boolean().optional(),
});

export const eventStatusSchema = z.enum([
  "Need Review",
  "Confirmed",
  "Added to Calendar",
  "Expired",
  "Duplicate",
  "Rejected",
]);

export const reminderPreferenceSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("none") }),
  z.object({ kind: z.literal("minutes"), minutes: z.number().int().positive() }),
  z.object({
    kind: z.literal("multiple"),
    minutesBefore: z.array(z.number().int().positive()),
  }),
]);

export const familyEventSchema = z.object({
  airtableRecordId: z.string().optional(),
  eventName: z.string().min(1),
  date: z.string().min(1),
  startTime: z.string().optional(),
  endTime: z.string().optional(),
  city: z.string().optional(),
  venue: z.string().optional(),
  address: z.string().optional(),
  sourceName: z.string().optional(),
  sourceType: z.string().optional(),
  sourceLink: z.string().optional(),
  eventLink: z.string().optional(),
  ageRange: z.string().optional(),
  cost: z.string().optional(),
  free: z.boolean().optional(),
  category: z.string().optional(),
  categoryPrefix: z.string().optional(),
  indoorOutdoor: z.string().optional(),
  recurring: z.boolean().optional(),
  registrationRequired: z.boolean().optional(),
  kidFriendlyNotes: z.string().optional(),
  description: z.string().optional(),
  screenshotUrl: z.string().optional(),
  googleMapsLink: z.string().optional(),
  lastCheckedDate: z.string().optional(),
  status: eventStatusSchema,
  addedToGoogleCalendar: z.boolean().optional(),
  googleCalendarEventId: z.string().optional(),
  addedDate: z.string().optional(),
  reminderPreference: reminderPreferenceSchema.optional(),
  confidenceScore: z.number().min(0).max(1).optional(),
  duplicateGroupId: z.string().optional(),
  normalizedEventKey: z.string().optional(),
  extractedRawText: z.string().optional(),
  sourceReliabilityScore: z.number().min(0).max(1).optional(),
  zapierWebhookStatus: z.string().optional(),
  zapierLastSentAt: z.string().optional(),
});

export const calendarExportReminderSchema = z.union([
  z.object({ useDefault: z.literal(true) }),
  z.object({ useDefault: z.literal(false), preference: reminderPreferenceSchema }),
]);

export const calendarExportPayloadSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
  reminder: calendarExportReminderSchema,
});

export const zapierExportPayloadSchema = z.object({
  eventIds: z.array(z.string().min(1)).min(1),
});

export const openAIExtractedEventSchema = z.object({
  eventName: z.string(),
  date: z.string(),
  startTime: z.string(),
  endTime: z.string(),
  city: z.string(),
  venue: z.string(),
  address: z.string(),
  sourceName: z.string(),
  sourceType: z.string(),
  sourceLink: z.string(),
  eventLink: z.string(),
  ageRange: z.string(),
  cost: z.string(),
  free: z.boolean(),
  category: z.string(),
  indoorOutdoor: z.string(),
  recurring: z.boolean(),
  registrationRequired: z.boolean(),
  kidFriendlyNotes: z.string(),
  description: z.string(),
  confidenceScore: z.number(),
  missingFields: z.array(z.string()),
});

export const openAIExtractionResponseSchema = z.object({
  events: z.array(openAIExtractedEventSchema),
});

export type FamilyEvent = z.infer<typeof familyEventSchema>;
export type SourceDraft = z.infer<typeof sourceSchema>;
export type CalendarExportPayload = z.infer<typeof calendarExportPayloadSchema>;
export type ZapierExportPayload = z.infer<typeof zapierExportPayloadSchema>;
export type OpenAIExtractionResponse = z.infer<
  typeof openAIExtractionResponseSchema
>;

const LOW_CONFIDENCE = 0.45;

export function shouldNeedReview(reasons: string[]): boolean {
  return reasons.length > 0;
}

export function validationReasonsForEvent(
  candidate: Partial<z.infer<typeof openAIExtractedEventSchema>>,
): string[] {
  const reasons: string[] = [];
  if (!candidate.eventName?.trim()) reasons.push("missing_event_name");
  if (!candidate.date?.trim()) reasons.push("missing_date");
  if (!candidate.sourceLink?.trim()) reasons.push("missing_source_link");
  if (
    typeof candidate.confidenceScore === "number" &&
    candidate.confidenceScore < LOW_CONFIDENCE
  ) {
    reasons.push("low_confidence");
  }
  if (candidate.missingFields?.length) {
    reasons.push(...candidate.missingFields.map((m) => `missing_${m}`));
  }
  return reasons;
}
