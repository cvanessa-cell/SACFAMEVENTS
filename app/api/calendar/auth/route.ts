export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { getGoogleEnv, startGoogleOAuth } from "@/lib/googleCalendar";

export async function GET(req: Request) {
  if (!getGoogleEnv()) {
    return NextResponse.json(
      {
        ok: false,
        message:
          "Google OAuth secrets are missing. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI in .env, then reload.",
        requiredScopesHint: [
          "https://www.googleapis.com/auth/calendar.events",
          "https://www.googleapis.com/auth/calendar.readonly",
          "openid",
          "email",
          "profile",
        ],
      },
      { status: 503 },
    );
  }

  try {
    const url = new URL(req.url);
    const returnPath = url.searchParams.get("return") ?? undefined;
    const { url: consentUrl } = await startGoogleOAuth({ returnPath });
    return NextResponse.redirect(consentUrl, { status: 302 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unable to start OAuth";
    return NextResponse.json({ ok: false, message }, { status: 500 });
  }
}
