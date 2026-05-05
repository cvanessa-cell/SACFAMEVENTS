import { NextResponse } from "next/server";

import { calendarExportPayloadSchema } from "@/lib/validation";

export async function POST(req: Request) {
  const payload = calendarExportPayloadSchema.safeParse(await req.json());
  if (!payload.success) {
    return NextResponse.json(
      { ok: false, issues: payload.error.flatten() },
      { status: 422 },
    );
  }

  const hasGoogleSecrets =
    Boolean(process.env.GOOGLE_CLIENT_ID) &&
    Boolean(process.env.GOOGLE_CLIENT_SECRET) &&
    Boolean(process.env.GOOGLE_REDIRECT_URI);

  if (!hasGoogleSecrets) {
    return NextResponse.json({
      ok: false,
      message:
        "Google OAuth secrets are missing. Populate GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI, then authorize via /api/calendar/auth.",
    });
  }

  return NextResponse.json({
    ok: false,
    message:
      "Google Calendar OAuth + inserts are scaffolded next (Milestone 4). Payload validated successfully.",
    eventCount: payload.data.eventIds.length,
  });
}
