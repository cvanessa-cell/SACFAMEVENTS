export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import {
  fetchFamilyEventsFromAirtable,
  isAirtableConfigured,
} from "@/lib/airtable";
import {
  calendarTitleForEvent,
  ensureMapsLink,
  formatCalendarDescriptionStructured,
} from "@/lib/eventFormatting";
import {
  getGoogleEnv,
  insertCalendarEvent,
  isGoogleCalendarConnected,
  reminderProfileFromName,
  type CalendarInsertInput,
} from "@/lib/googleCalendar";
import { MOCK_FAMILY_EVENTS } from "@/lib/mockEvents";
import { prisma } from "@/lib/prisma";
import { calendarExportPayloadSchema, type FamilyEvent } from "@/lib/validation";

interface ItemResult {
  eventId: string;
  ok: boolean;
  message?: string;
  source?: "postgres" | "airtable" | "mock";
  googleCalendarEventId?: string;
  htmlLink?: string | null;
  accountEmail?: string;
  calendarSummary?: string | null;
}

function combineDateTime(date: string, time: string | undefined, fallback: "start" | "end"): Date {
  const t = time?.trim() || (fallback === "start" ? "09:00" : "10:00");
  const iso = `${date}T${t.length === 5 ? `${t}:00` : t}`;
  return new Date(`${iso}-07:00`);
}

function airtableEventToInsertInput(ev: FamilyEvent): CalendarInsertInput {
  const start = combineDateTime(ev.date, ev.startTime, "start");
  const end = combineDateTime(ev.date, ev.endTime ?? ev.startTime, "end");
  if (end.getTime() <= start.getTime()) {
    end.setTime(start.getTime() + 60 * 60 * 1000);
  }
  return {
    title: calendarTitleForEvent(ev),
    description: formatCalendarDescriptionStructured({
      event: ev,
      mapsLink: ensureMapsLink(ev),
    }),
    location: [ev.venue, ev.address, ev.city].filter(Boolean).join(", "),
    startDatetime: start,
    endDatetime: end,
    timezone: "America/Los_Angeles",
  };
}

interface PostgresFamilyEvent {
  id: string;
  title: string;
  description: string | null;
  city: string | null;
  venueName: string | null;
  address: string | null;
  startDatetime: Date | null;
  endDatetime: Date | null;
  timezone: string;
  registrationUrl: string | null;
  sourceEventUrl: string | null;
}

function postgresEventToInsertInput(ev: PostgresFamilyEvent): CalendarInsertInput {
  if (!ev.startDatetime) {
    throw new Error(`Event ${ev.id} has no startDatetime`);
  }
  const end =
    ev.endDatetime && ev.endDatetime.getTime() > ev.startDatetime.getTime()
      ? ev.endDatetime
      : new Date(ev.startDatetime.getTime() + 60 * 60 * 1000);

  const lines: string[] = [];
  if (ev.description) lines.push(ev.description.trim());
  if (ev.sourceEventUrl) lines.push(`Source: ${ev.sourceEventUrl}`);
  if (ev.registrationUrl) lines.push(`Register: ${ev.registrationUrl}`);

  return {
    title: ev.title,
    description: lines.join("\n\n") || undefined,
    location:
      [ev.venueName, ev.address, ev.city].filter(Boolean).join(", ") ||
      undefined,
    startDatetime: ev.startDatetime,
    endDatetime: end,
    timezone: ev.timezone || "America/Los_Angeles",
  };
}

async function lookupAirtableEvent(id: string): Promise<FamilyEvent | null> {
  if (id.startsWith("mock_")) {
    return MOCK_FAMILY_EVENTS.find((e) => e.airtableRecordId === id) ?? null;
  }
  if (!isAirtableConfigured()) return null;
  const rows = await fetchFamilyEventsFromAirtable();
  return rows.find((e) => e.airtableRecordId === id) ?? null;
}

async function loadDefaultReminderMinutes(): Promise<number[] | undefined> {
  const settings = await prisma.appAutomationSettings.findUnique({
    where: { id: "singleton" },
  });
  if (!settings) return undefined;
  const profile = reminderProfileFromName(
    settings.defaultReminderProfile,
    settings.customReminderMinutesJson,
  );
  if (profile.kind === "default") return undefined;
  return profile.minutes;
}

function explicitReminderMinutes(
  reminder: { useDefault: true } | { useDefault: false; preference: unknown },
): number[] | undefined | null {
  if (reminder.useDefault) return null;
  const pref = reminder.preference as
    | { kind: "none" }
    | { kind: "minutes"; minutes: number }
    | { kind: "multiple"; minutesBefore: number[] };
  if (pref.kind === "none") return [];
  if (pref.kind === "minutes") return [pref.minutes];
  return pref.minutesBefore;
}

export async function POST(req: Request) {
  let parsedBody: unknown;
  try {
    parsedBody = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const payload = calendarExportPayloadSchema.safeParse(parsedBody);
  if (!payload.success) {
    return NextResponse.json(
      { ok: false, issues: payload.error.flatten() },
      { status: 422 },
    );
  }

  if (!getGoogleEnv()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Google OAuth secrets are missing. Populate GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI in .env.",
      },
      { status: 503 },
    );
  }

  if (!(await isGoogleCalendarConnected())) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "No Google account is connected. Visit /api/calendar/auth to authorize.",
        connectUrl: "/api/calendar/auth",
      },
      { status: 412 },
    );
  }

  const explicit = explicitReminderMinutes(payload.data.reminder);
  const reminderOverridesMinutes =
    explicit === null ? await loadDefaultReminderMinutes() : explicit;

  // Optional account/calendar override carried via top-level fields on the body.
  const overrides = parsedBody as {
    accountId?: string | null;
    calendarId?: string | null;
  };

  const results: ItemResult[] = [];

  for (const eventId of payload.data.eventIds) {
    try {
      const pg = await prisma.familyEvent.findUnique({
        where: { id: eventId },
      });
      if (pg) {
        const input = postgresEventToInsertInput(pg);
        const inserted = await insertCalendarEvent({
          ...input,
          reminderOverridesMinutes,
          accountId: overrides.accountId ?? null,
          calendarId: overrides.calendarId ?? null,
        });
        await prisma.familyEventCalendarExport.upsert({
          where: {
            familyEventId_accountId_calendarId_googleEventId: {
              familyEventId: pg.id,
              accountId: inserted.accountId,
              calendarId: inserted.calendarId,
              googleEventId: inserted.eventId,
            },
          },
          create: {
            familyEventId: pg.id,
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
          where: { id: eventId },
          data: {
            status: "exported_to_calendar",
            googleCalendarEventId: inserted.eventId,
            googleCalendarHtmlLink: inserted.htmlLink ?? null,
            googleCalendarExportedAt: new Date(),
          },
        });
        results.push({
          eventId,
          ok: true,
          source: "postgres",
          googleCalendarEventId: inserted.eventId,
          htmlLink: inserted.htmlLink,
          accountEmail: inserted.accountEmail,
          calendarSummary: inserted.calendarSummary,
        });
        continue;
      }

      const airtable = await lookupAirtableEvent(eventId);
      if (!airtable) {
        results.push({
          eventId,
          ok: false,
          message: "Event not found in Postgres or Airtable.",
        });
        continue;
      }
      if (eventId.startsWith("mock_")) {
        results.push({
          eventId,
          ok: false,
          source: "mock",
          message:
            "Mock events cannot be exported. Connect Airtable or use a real Postgres FamilyEvent.",
        });
        continue;
      }
      const input = airtableEventToInsertInput(airtable);
      const inserted = await insertCalendarEvent({
        ...input,
        reminderOverridesMinutes,
        accountId: overrides.accountId ?? null,
        calendarId: overrides.calendarId ?? null,
      });
      results.push({
        eventId,
        ok: true,
        source: "airtable",
        googleCalendarEventId: inserted.eventId,
        htmlLink: inserted.htmlLink,
        accountEmail: inserted.accountEmail,
        calendarSummary: inserted.calendarSummary,
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      results.push({ eventId, ok: false, message });
    }
  }

  const successCount = results.filter((r) => r.ok).length;
  const okOverall = successCount === results.length;
  return NextResponse.json(
    {
      ok: okOverall,
      message: okOverall
        ? `Inserted ${successCount} event${successCount === 1 ? "" : "s"} into Google Calendar.`
        : `Inserted ${successCount} of ${results.length}; see results for details.`,
      eventCount: payload.data.eventIds.length,
      results,
    },
    { status: okOverall ? 200 : 207 },
  );
}
