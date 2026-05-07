import { google } from "googleapis";

import { prisma } from "@/lib/prisma";

export type CalendarPingResult =
  | { ok: true }
  | { ok: false; reason: string };

/**
 * Uses OAuth env + tokens stored in Prisma ({ id: "singleton" }).
 * Calls Calendar API calendarList.list (minimal read) to validate refresh/access flow.
 */
export async function pingGoogleCalendarFromPrisma(): Promise<CalendarPingResult> {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) {
    return { ok: false, reason: "missing_oauth_env" };
  }

  const row = await prisma.googleCalendarCredentials.findUnique({
    where: { id: "singleton" },
  });
  if (!row?.accessToken?.trim()) {
    return { ok: false, reason: "no_stored_credentials" };
  }

  const oauth2 = new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  oauth2.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken ?? undefined,
    expiry_date: row.expiry ? row.expiry.getTime() : undefined,
  });

  try {
    const calendar = google.calendar({ version: "v3", auth: oauth2 });
    await calendar.calendarList.list({ maxResults: 1 });

    const creds = oauth2.credentials;
    const accessChanged =
      typeof creds.access_token === "string" &&
      creds.access_token.length > 0 &&
      creds.access_token !== row.accessToken;
    const expiryChanged =
      typeof creds.expiry_date === "number" &&
      creds.expiry_date !== row.expiry?.getTime();

    if (accessChanged || expiryChanged) {
      await prisma.googleCalendarCredentials.update({
        where: { id: "singleton" },
        data: {
          accessToken: creds.access_token ?? row.accessToken,
          expiry:
            typeof creds.expiry_date === "number"
              ? new Date(creds.expiry_date)
              : row.expiry,
          ...(creds.refresh_token ? { refreshToken: creds.refresh_token } : {}),
        },
      });
    }

    return { ok: true };
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, reason: msg.slice(0, 240) };
  }
}
