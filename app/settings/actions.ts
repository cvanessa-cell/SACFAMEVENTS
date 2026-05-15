"use server";

import { revalidatePath } from "next/cache";

import {
  disconnectGoogleAccount,
  refreshAccountCalendars,
  setAccountDefaultCalendar,
  setDefaultGoogleAccount,
} from "@/lib/googleCalendar";

const PATHS_TO_REVALIDATE = [
  "/settings",
  "/admin/event-review",
];

function revalidate() {
  for (const p of PATHS_TO_REVALIDATE) revalidatePath(p);
}

export async function disconnectGoogleAccountAction(
  formData: FormData,
): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;
  await disconnectGoogleAccount(accountId);
  revalidate();
}

export async function setDefaultGoogleAccountAction(
  formData: FormData,
): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;
  await setDefaultGoogleAccount(accountId);
  revalidate();
}

export async function setAccountDefaultCalendarAction(
  formData: FormData,
): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  const calendarId = String(formData.get("calendarId") ?? "");
  const calendarSummary =
    (formData.get("calendarSummary") as string | null) || null;
  if (!accountId || !calendarId) return;
  await setAccountDefaultCalendar({ accountId, calendarId, calendarSummary });
  revalidate();
}

export async function refreshAccountCalendarsAction(
  formData: FormData,
): Promise<void> {
  const accountId = String(formData.get("accountId") ?? "");
  if (!accountId) return;
  await refreshAccountCalendars(accountId);
  revalidate();
}
