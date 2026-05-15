"use server";

import { revalidatePath } from "next/cache";

import { syncApprovedEventToAirtable } from "@/lib/airtable";
import { runAutoReview } from "@/lib/events/autoReview";
import { checkSingleSource, checkDueSources } from "@/lib/events/sourceChecker";
import {
  getGoogleEnv,
  insertCalendarEvent,
  isGoogleCalendarConnected,
  reminderProfileFromName,
} from "@/lib/googleCalendar";
import { logger } from "@/lib/logger";
import { createEventExtractionJob } from "@/lib/openai/createEventExtractionJob";
import { prisma } from "@/lib/prisma";
import { markProjectActivity } from "@/lib/project/activityHeartbeat";

const PATHS_TO_REVALIDATE = [
  "/admin/event-monitoring",
  "/admin/event-sources",
  "/admin/event-review",
  "/settings",
];

function revalidateAdmin() {
  for (const p of PATHS_TO_REVALIDATE) revalidatePath(p);
}

/**
 * Server action: run a discovery batch (one pass of `checkDueSources`).
 * Equivalent to the cron endpoint, callable from the admin UI without a Bearer token.
 */
export async function runDiscoveryNowAction(): Promise<void> {
  await markProjectActivity();
  const batch = Number(process.env.EVENT_SOURCE_CHECK_BATCH_SIZE ?? "20") || 20;
  await checkDueSources(batch);
  revalidateAdmin();
}

/** Server action: force a single source's check-now path. */
export async function checkSourceNowAction(formData: FormData): Promise<void> {
  const id = String(formData.get("sourceId") ?? "");
  if (!id) return;
  await markProjectActivity();
  await checkSingleSource(id);
  revalidateAdmin();
}

/** Server action: enable/disable an EventSource row. */
export async function toggleSourceAction(formData: FormData): Promise<void> {
  const id = String(formData.get("sourceId") ?? "");
  const enabled = String(formData.get("enabled") ?? "") === "true";
  if (!id) return;
  await prisma.eventSource.update({
    where: { id },
    data: { enabled },
  });
  revalidateAdmin();
}

/** Server action: re-enqueue an OpenAI extraction job for a source change. */
export async function retryAiExtractionAction(formData: FormData): Promise<void> {
  const id = String(formData.get("sourceChangeId") ?? "");
  if (!id) return;
  const change = await prisma.sourceChange.findUnique({
    where: { id },
    include: { source: true },
  });
  if (!change || !change.source) return;
  await createEventExtractionJob({
    sourceChangeId: change.id,
    sourceName: change.source.name,
    sourceUrl: change.source.sourceUrl,
    sourceCategory: change.source.category,
    changedText: change.fullSnapshotText ?? change.changedTextExcerpt ?? "",
  });
  revalidateAdmin();
}

/**
 * Server action: insert an approved (or already-exported) FamilyEvent into Google Calendar.
 * Optional `accountId` and `calendarId` form fields target a specific
 * (account, calendar) pair; otherwise the user's default is used.
 *
 * Records a `FamilyEventCalendarExport` row per (event, account, calendar)
 * and flips the FamilyEvent status to `exported_to_calendar`.
 */
export async function addEventToCalendarAction(formData: FormData): Promise<void> {
  const id = String(formData.get("eventId") ?? "");
  const accountId = (formData.get("accountId") as string | null) || null;
  const calendarId = (formData.get("calendarId") as string | null) || null;
  if (!id) return;
  if (!getGoogleEnv()) {
    throw new Error(
      "Google OAuth env vars are missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI.",
    );
  }
  if (!(await isGoogleCalendarConnected())) {
    throw new Error(
      "No Google account is connected. Visit /api/calendar/auth to authorize.",
    );
  }
  const ev = await prisma.familyEvent.findUnique({ where: { id } });
  if (!ev) throw new Error("Event not found");
  if (!ev.startDatetime) throw new Error("Event has no startDatetime");

  const settings = await prisma.appAutomationSettings.findUnique({
    where: { id: "singleton" },
  });
  const reminderProfile = settings
    ? reminderProfileFromName(
        settings.defaultReminderProfile,
        settings.customReminderMinutesJson,
      )
    : { kind: "default" as const };
  const reminderOverridesMinutes =
    reminderProfile.kind === "minutes" ? reminderProfile.minutes : undefined;

  const end =
    ev.endDatetime && ev.endDatetime.getTime() > ev.startDatetime.getTime()
      ? ev.endDatetime
      : new Date(ev.startDatetime.getTime() + 60 * 60 * 1000);

  const descriptionLines: string[] = [];
  if (ev.description) descriptionLines.push(ev.description.trim());
  if (ev.sourceEventUrl) descriptionLines.push(`Source: ${ev.sourceEventUrl}`);
  if (ev.registrationUrl) descriptionLines.push(`Register: ${ev.registrationUrl}`);

  const inserted = await insertCalendarEvent({
    title: ev.title,
    description: descriptionLines.join("\n\n") || undefined,
    location:
      [ev.venueName, ev.address, ev.city].filter(Boolean).join(", ") ||
      undefined,
    startDatetime: ev.startDatetime,
    endDatetime: end,
    timezone: ev.timezone || "America/Los_Angeles",
    reminderOverridesMinutes,
    accountId,
    calendarId,
  });

  await prisma.familyEventCalendarExport.upsert({
    where: {
      familyEventId_accountId_calendarId_googleEventId: {
        familyEventId: id,
        accountId: inserted.accountId,
        calendarId: inserted.calendarId,
        googleEventId: inserted.eventId,
      },
    },
    create: {
      familyEventId: id,
      accountId: inserted.accountId,
      accountEmailSnapshot: inserted.accountEmail,
      accountNameSnapshot: inserted.accountName,
      calendarId: inserted.calendarId,
      calendarSummarySnapshot: inserted.calendarSummary,
      googleEventId: inserted.eventId,
      htmlLink: inserted.htmlLink ?? null,
    },
    update: {
      htmlLink: inserted.htmlLink ?? null,
      calendarSummarySnapshot: inserted.calendarSummary,
      accountEmailSnapshot: inserted.accountEmail,
      accountNameSnapshot: inserted.accountName,
    },
  });

  await prisma.familyEvent.update({
    where: { id },
    data: {
      status: "exported_to_calendar",
      googleCalendarEventId: inserted.eventId,
      googleCalendarHtmlLink: inserted.htmlLink ?? null,
      googleCalendarExportedAt: new Date(),
    },
  });
  await markProjectActivity();
  revalidateAdmin();
}

/** Server action: update the review status of a FamilyEvent (approve/reject/duplicate/reopen). */
export async function reviewEventAction(formData: FormData): Promise<void> {
  const id = String(formData.get("eventId") ?? "");
  const status = String(formData.get("status") ?? "");
  if (!id) return;
  if (!["approved", "rejected", "duplicate", "needs_review"].includes(status)) {
    return;
  }
  const note = String(formData.get("note") ?? "").trim();
  await markProjectActivity();
  await prisma.familyEvent.update({
    where: { id },
    data: { status },
  });
  if (note) {
    await prisma.eventReviewNote.create({
      data: { familyEventId: id, note },
    });
  }

  if (status === "approved") {
    try {
      const event = await prisma.familyEvent.findUnique({
        where: { id },
        include: { source: true },
      });
      if (event) {
        await syncApprovedEventToAirtable(event);
      }
    } catch (err) {
      logger.error("Airtable sync failed on approval", err, "reviewEventAction");
    }
  }

  revalidateAdmin();
}

/**
 * Server action: run the auto-review process on all needs_review events.
 * Verifies event details and auto-approves or auto-rejects them.
 */
export async function runAutoReviewAction(): Promise<{
  processed: number;
  approved: number;
  rejected: number;
}> {
  await markProjectActivity();
  const result = await runAutoReview();
  revalidateAdmin();
  return {
    processed: result.processed,
    approved: result.approved,
    rejected: result.rejected,
  };
}
