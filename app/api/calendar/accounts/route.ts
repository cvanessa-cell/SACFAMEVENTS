export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import {
  getGoogleEnv,
  listGoogleAccounts,
  refreshAccountCalendars,
  setAccountDefaultCalendar,
  setDefaultGoogleAccount,
} from "@/lib/googleCalendar";

export async function GET() {
  const env = getGoogleEnv();
  const accounts = await listGoogleAccounts();
  return NextResponse.json({
    ok: true,
    configured: Boolean(env),
    accounts,
  });
}

const patchSchema = z.discriminatedUnion("action", [
  z.object({ action: z.literal("setDefaultAccount"), accountId: z.string() }),
  z.object({
    action: z.literal("setDefaultCalendar"),
    accountId: z.string(),
    calendarId: z.string(),
    calendarSummary: z.string().optional(),
  }),
  z.object({ action: z.literal("refreshCalendars"), accountId: z.string() }),
]);

export async function PATCH(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { ok: false, message: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    switch (parsed.data.action) {
      case "setDefaultAccount":
        await setDefaultGoogleAccount(parsed.data.accountId);
        return NextResponse.json({ ok: true, message: "Default account updated." });
      case "setDefaultCalendar":
        await setAccountDefaultCalendar({
          accountId: parsed.data.accountId,
          calendarId: parsed.data.calendarId,
          calendarSummary: parsed.data.calendarSummary ?? null,
        });
        return NextResponse.json({ ok: true, message: "Default calendar updated." });
      case "refreshCalendars": {
        const result = await refreshAccountCalendars(parsed.data.accountId);
        return NextResponse.json({
          ok: true,
          message: `Synced ${result.count} calendar${result.count === 1 ? "" : "s"}.`,
          count: result.count,
        });
      }
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
