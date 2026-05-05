import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: false,
    message:
      'Google OAuth initiation URL will redirect from here once client credentials + scopes are finalized.',
    requiredScopesHint: ["https://www.googleapis.com/auth/calendar.events"],
  });
}
