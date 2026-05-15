import crypto from "node:crypto";

import { google, type calendar_v3 } from "googleapis";
import type { OAuth2Client } from "google-auth-library";

import { prisma } from "@/lib/prisma";

const STATE_TTL_MS = 15 * 60 * 1000;

const REQUIRED_SCOPES = [
  "https://www.googleapis.com/auth/calendar.events",
  "https://www.googleapis.com/auth/calendar.readonly",
  "openid",
  "email",
  "profile",
] as const;

export interface GoogleEnv {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  /** Default fallback when an account row has no `defaultCalendarId`. */
  fallbackCalendarId: string;
}

export function getGoogleEnv(): GoogleEnv | null {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  const redirectUri = process.env.GOOGLE_REDIRECT_URI?.trim();
  if (!clientId || !clientSecret || !redirectUri) return null;
  return {
    clientId,
    clientSecret,
    redirectUri,
    fallbackCalendarId: process.env.GOOGLE_CALENDAR_ID?.trim() || "primary",
  };
}

export async function assertGoogleConfigured(): Promise<void> {
  if (!getGoogleEnv()) {
    throw new Error(
      "Google OAuth variables are incomplete. Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, and GOOGLE_REDIRECT_URI.",
    );
  }
}

function newOAuthClient(env: GoogleEnv): OAuth2Client {
  return new google.auth.OAuth2(
    env.clientId,
    env.clientSecret,
    env.redirectUri,
  );
}

/** Build a fresh OAuth consent URL and persist a state token for CSRF protection. */
export async function startGoogleOAuth(args?: {
  /** Optional return path appended to redirect after success/failure. */
  returnPath?: string;
}): Promise<{ url: string; state: string }> {
  const env = getGoogleEnv();
  if (!env) throw new Error("Google OAuth env vars missing.");
  const state = crypto.randomBytes(24).toString("base64url");
  const returnPath = sanitizeReturnPath(args?.returnPath);
  await prisma.googleOAuthState.create({
    data: { state, returnPath: returnPath ?? null },
  });
  const client = newOAuthClient(env);
  const url = client.generateAuthUrl({
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: true,
    scope: [...REQUIRED_SCOPES],
    state,
  });
  return { url, state };
}

function sanitizeReturnPath(p: string | undefined): string | null {
  if (!p) return null;
  if (!p.startsWith("/") || p.startsWith("//")) return null;
  return p.slice(0, 200);
}

interface GoogleUserInfoResponse {
  sub: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
}

async function fetchGoogleUserInfo(
  client: OAuth2Client,
): Promise<GoogleUserInfoResponse> {
  const oauth2 = google.oauth2({ version: "v2", auth: client });
  const { data } = await oauth2.userinfo.get();
  if (!data.id) throw new Error("Google userinfo returned no id");
  return {
    sub: String(data.id),
    email: data.email ?? undefined,
    email_verified: data.verified_email ?? undefined,
    name: data.name ?? undefined,
    picture: data.picture ?? undefined,
  };
}

/**
 * Verify state, exchange code for tokens, identify the Google user, persist as
 * a `GoogleAccount` row, then immediately fetch the calendar list.
 *
 * Returns the stored returnPath (if any) for the callback to redirect the user
 * back to where they started.
 */
export async function completeGoogleOAuth(args: {
  state: string;
  code: string;
}): Promise<{ accountId: string; email: string; returnPath: string | null }> {
  const env = getGoogleEnv();
  if (!env) throw new Error("Google OAuth env vars missing.");
  const stored = await prisma.googleOAuthState.findUnique({
    where: { state: args.state },
  });
  if (!stored) throw new Error("Unknown OAuth state");
  if (Date.now() - stored.createdAt.getTime() > STATE_TTL_MS) {
    await prisma.googleOAuthState.delete({ where: { state: args.state } });
    throw new Error("OAuth state expired");
  }
  await prisma.googleOAuthState.delete({ where: { state: args.state } });
  const returnPath = sanitizeReturnPath(stored.returnPath ?? undefined);

  const client = newOAuthClient(env);
  const { tokens } = await client.getToken(args.code);
  if (!tokens.access_token) {
    throw new Error("Google token exchange returned no access_token");
  }
  client.setCredentials(tokens);

  const userInfo = await fetchGoogleUserInfo(client);
  const email = userInfo.email ?? `unknown-${userInfo.sub}@google.local`;

  const existing = await prisma.googleAccount.findUnique({
    where: { googleUserId: userInfo.sub },
  });

  const isFirstAccount = (await prisma.googleAccount.count()) === 0;

  const saved = await prisma.googleAccount.upsert({
    where: { googleUserId: userInfo.sub },
    create: {
      googleUserId: userInfo.sub,
      email,
      name: userInfo.name ?? null,
      picture: userInfo.picture ?? null,
      accessToken: tokens.access_token,
      refreshToken: tokens.refresh_token ?? null,
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? null,
      isDefault: isFirstAccount,
      defaultCalendarId: env.fallbackCalendarId,
    },
    update: {
      email,
      name: userInfo.name ?? existing?.name ?? null,
      picture: userInfo.picture ?? existing?.picture ?? null,
      accessToken: tokens.access_token,
      // Google omits refresh_token on subsequent consents unless prompt=consent.
      ...(tokens.refresh_token ? { refreshToken: tokens.refresh_token } : {}),
      expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : null,
      scope: tokens.scope ?? existing?.scope ?? null,
    },
  });

  // Best-effort calendar list refresh; never fail the login on this.
  try {
    await refreshAccountCalendars(saved.id, client);
  } catch (err) {
    console.warn("[googleCalendar] failed to refresh calendar list", err);
  }

  return { accountId: saved.id, email: saved.email, returnPath };
}

/** Returns true if there is at least one connected GoogleAccount. */
export async function isGoogleCalendarConnected(): Promise<boolean> {
  // Try migrating the legacy singleton on first read so users upgrading from
  // the single-account version don't have to reconnect manually.
  await maybeClaimLegacySingleton().catch(() => {});
  const count = await prisma.googleAccount.count();
  return count > 0;
}

/**
 * One-shot upgrade helper: when the legacy `GoogleCalendarCredentials` singleton
 * is present but no `GoogleAccount` rows exist, use those tokens to identify
 * the user via Google's `userinfo` endpoint, then create a `GoogleAccount`
 * carrying the same credentials. Deletes the singleton on success.
 *
 * Idempotent + best-effort — failures (e.g. expired refresh token, no network)
 * are swallowed so the rest of the app keeps working; the user can always
 * reconnect manually from /settings.
 */
async function maybeClaimLegacySingleton(): Promise<void> {
  const env = getGoogleEnv();
  if (!env) return;
  const haveNew = (await prisma.googleAccount.count()) > 0;
  if (haveNew) return;
  const legacy = await prisma.googleCalendarCredentials
    .findUnique({ where: { id: "singleton" } })
    .catch(() => null);
  if (!legacy?.accessToken) return;

  const client = newOAuthClient(env);
  client.setCredentials({
    access_token: legacy.accessToken,
    refresh_token: legacy.refreshToken ?? undefined,
    expiry_date: legacy.expiry?.getTime(),
    scope: legacy.scope ?? undefined,
  });
  let userInfo: GoogleUserInfoResponse;
  try {
    userInfo = await fetchGoogleUserInfo(client);
  } catch (err) {
    console.warn(
      "[googleCalendar] failed to claim legacy singleton; user must reconnect",
      err,
    );
    return;
  }
  const email = userInfo.email ?? `unknown-${userInfo.sub}@google.local`;
  const created = await prisma.googleAccount.create({
    data: {
      googleUserId: userInfo.sub,
      email,
      name: userInfo.name ?? null,
      picture: userInfo.picture ?? null,
      accessToken: legacy.accessToken,
      refreshToken: legacy.refreshToken ?? null,
      expiry: legacy.expiry,
      scope: legacy.scope,
      isDefault: true,
      defaultCalendarId: env.fallbackCalendarId,
    },
  });
  try {
    await refreshAccountCalendars(created.id, client);
  } catch (err) {
    console.warn("[googleCalendar] legacy claim: calendar refresh failed", err);
  }
  await prisma.googleCalendarCredentials
    .delete({ where: { id: "singleton" } })
    .catch(() => {});
}

export async function disconnectGoogleCalendar(): Promise<void> {
  await prisma.googleAccount.deleteMany({}).catch(() => {});
  await prisma.googleCalendarCredentials
    .delete({ where: { id: "singleton" } })
    .catch(() => {});
}

export async function disconnectGoogleAccount(accountId: string): Promise<void> {
  await prisma.googleAccount.delete({ where: { id: accountId } });
}

export async function setDefaultGoogleAccount(accountId: string): Promise<void> {
  await prisma.$transaction([
    prisma.googleAccount.updateMany({
      where: { isDefault: true },
      data: { isDefault: false },
    }),
    prisma.googleAccount.update({
      where: { id: accountId },
      data: { isDefault: true },
    }),
  ]);
}

export async function setAccountDefaultCalendar(args: {
  accountId: string;
  calendarId: string;
  calendarSummary?: string | null;
}): Promise<void> {
  await prisma.googleAccount.update({
    where: { id: args.accountId },
    data: {
      defaultCalendarId: args.calendarId,
      defaultCalendarSummary: args.calendarSummary ?? null,
    },
  });
}

/**
 * Returns an OAuth2Client bound to a specific account's persisted credentials.
 * Listens for `tokens` events so refreshed access tokens are written back.
 */
export async function getAuthorizedClientForAccount(
  accountId: string,
): Promise<OAuth2Client> {
  const env = getGoogleEnv();
  if (!env) throw new Error("Google OAuth env vars missing.");
  const row = await prisma.googleAccount.findUnique({
    where: { id: accountId },
  });
  if (!row) {
    throw new Error(
      `Google account ${accountId} not found. Reconnect from /settings.`,
    );
  }
  const client = newOAuthClient(env);
  client.setCredentials({
    access_token: row.accessToken,
    refresh_token: row.refreshToken ?? undefined,
    expiry_date: row.expiry?.getTime(),
    scope: row.scope ?? undefined,
  });
  client.on("tokens", (tokens) => {
    void prisma.googleAccount
      .update({
        where: { id: accountId },
        data: {
          ...(tokens.access_token ? { accessToken: tokens.access_token } : {}),
          ...(tokens.refresh_token
            ? { refreshToken: tokens.refresh_token }
            : {}),
          ...(tokens.expiry_date
            ? { expiry: new Date(tokens.expiry_date) }
            : {}),
          ...(tokens.scope ? { scope: tokens.scope } : {}),
        },
      })
      .catch((err) => {
        console.error(
          "[googleCalendar] failed to persist refreshed tokens",
          err,
        );
      });
  });
  return client;
}

/** Resolve which account+calendar to use for an export. Falls back to the default account. */
export async function resolveExportTarget(args: {
  accountId?: string | null;
  calendarId?: string | null;
}): Promise<{
  accountId: string;
  calendarId: string;
  calendarSummary: string | null;
  email: string;
  name: string | null;
}> {
  const accountId = args.accountId
    ? args.accountId
    : (await prisma.googleAccount.findFirst({ where: { isDefault: true } }))
        ?.id ?? (await prisma.googleAccount.findFirst())?.id;
  if (!accountId) {
    throw new Error(
      "No Google account is connected. Connect one from /settings.",
    );
  }
  const account = await prisma.googleAccount.findUnique({
    where: { id: accountId },
    include: { calendars: true },
  });
  if (!account) {
    throw new Error(`Google account ${accountId} not found.`);
  }
  const calendarId = args.calendarId ?? account.defaultCalendarId ?? "primary";
  const cal = account.calendars.find((c) => c.calendarId === calendarId);
  return {
    accountId: account.id,
    calendarId,
    calendarSummary:
      cal?.summary ?? account.defaultCalendarSummary ?? (calendarId === "primary" ? "Primary" : calendarId),
    email: account.email,
    name: account.name,
  };
}

/**
 * Fetch the user's calendar list from Google and upsert into
 * GoogleAccountCalendar. Returns the persisted rows (post-upsert).
 */
export async function refreshAccountCalendars(
  accountId: string,
  authOverride?: OAuth2Client,
): Promise<{ count: number }> {
  const auth = authOverride ?? (await getAuthorizedClientForAccount(accountId));
  const calendar = google.calendar({ version: "v3", auth });
  const list = await calendar.calendarList.list({ maxResults: 100 });
  const items = list.data.items ?? [];

  const ops = items
    .filter((c) => c.id)
    .map((c) =>
      prisma.googleAccountCalendar.upsert({
        where: {
          accountId_calendarId: {
            accountId,
            calendarId: c.id as string,
          },
        },
        create: {
          accountId,
          calendarId: c.id as string,
          summary: c.summaryOverride ?? c.summary ?? c.id ?? "",
          description: c.description ?? null,
          timeZone: c.timeZone ?? null,
          backgroundColor: c.backgroundColor ?? null,
          foregroundColor: c.foregroundColor ?? null,
          accessRole: c.accessRole ?? null,
          primary: Boolean(c.primary),
        },
        update: {
          summary: c.summaryOverride ?? c.summary ?? c.id ?? "",
          description: c.description ?? null,
          timeZone: c.timeZone ?? null,
          backgroundColor: c.backgroundColor ?? null,
          foregroundColor: c.foregroundColor ?? null,
          accessRole: c.accessRole ?? null,
          primary: Boolean(c.primary),
          refreshedAt: new Date(),
        },
      }),
    );
  await prisma.$transaction(ops);

  // If the account's defaultCalendarId is "primary", snapshot the primary cal's summary.
  const primary = items.find((c) => c.primary);
  if (primary) {
    await prisma.googleAccount.update({
      where: { id: accountId },
      data: {
        defaultCalendarSummary:
          primary.summaryOverride ?? primary.summary ?? null,
      },
    });
  }

  return { count: items.length };
}

export interface CalendarInsertInput {
  title: string;
  description?: string;
  location?: string;
  startDatetime: Date;
  endDatetime: Date;
  timezone?: string;
  reminderOverridesMinutes?: number[];
  /** Optional account+calendar override; resolves defaults when missing. */
  accountId?: string | null;
  calendarId?: string | null;
}

export interface CalendarInsertResult {
  accountId: string;
  accountEmail: string;
  accountName: string | null;
  calendarId: string;
  calendarSummary: string | null;
  eventId: string;
  htmlLink?: string | null;
  status?: string | null;
}

export async function insertCalendarEvent(
  input: CalendarInsertInput,
): Promise<CalendarInsertResult> {
  const env = getGoogleEnv();
  if (!env) throw new Error("Google OAuth env vars missing.");
  const target = await resolveExportTarget({
    accountId: input.accountId,
    calendarId: input.calendarId,
  });
  const auth = await getAuthorizedClientForAccount(target.accountId);
  const calendar = google.calendar({ version: "v3", auth });

  const requestBody: calendar_v3.Schema$Event = {
    summary: input.title,
    description: input.description,
    location: input.location,
    start: {
      dateTime: input.startDatetime.toISOString(),
      timeZone: input.timezone ?? "America/Los_Angeles",
    },
    end: {
      dateTime: input.endDatetime.toISOString(),
      timeZone: input.timezone ?? "America/Los_Angeles",
    },
    reminders: input.reminderOverridesMinutes
      ? {
          useDefault: false,
          overrides: input.reminderOverridesMinutes.map((m) => ({
            method: "popup" as const,
            minutes: m,
          })),
        }
      : { useDefault: true },
  };

  const res = await calendar.events.insert({
    calendarId: target.calendarId,
    requestBody,
    sendUpdates: "none",
  });

  const id = res.data.id;
  if (!id) throw new Error("Google Calendar insert returned no event id");

  await prisma.googleAccount.update({
    where: { id: target.accountId },
    data: { lastUsedAt: new Date() },
  });

  return {
    accountId: target.accountId,
    accountEmail: target.email,
    accountName: target.name,
    calendarId: target.calendarId,
    calendarSummary: target.calendarSummary,
    eventId: id,
    htmlLink: res.data.htmlLink ?? null,
    status: res.data.status ?? null,
  };
}

export type CalendarReminderProfile =
  | { kind: "default" }
  | { kind: "minutes"; minutes: number[] };

export function reminderProfileFromName(
  profile: string,
  customJson?: string | null,
): CalendarReminderProfile {
  switch (profile) {
    case "none":
      return { kind: "minutes", minutes: [] };
    case "30m":
      return { kind: "minutes", minutes: [30] };
    case "1h":
      return { kind: "minutes", minutes: [60] };
    case "1d":
      return { kind: "minutes", minutes: [1440] };
    case "custom": {
      if (!customJson) return { kind: "default" };
      try {
        const parsed = JSON.parse(customJson);
        if (
          Array.isArray(parsed) &&
          parsed.every((n) => Number.isFinite(n) && n >= 0)
        ) {
          return { kind: "minutes", minutes: parsed.map((n) => Math.round(n)) };
        }
      } catch {
        /* fall through */
      }
      return { kind: "default" };
    }
    default:
      return { kind: "default" };
  }
}

/* ------------------------------------------------------------------ */
/*   Account listing helpers (consumed by /settings UI and pickers)    */
/* ------------------------------------------------------------------ */

export interface GoogleAccountSummary {
  id: string;
  email: string;
  name: string | null;
  picture: string | null;
  isDefault: boolean;
  defaultCalendarId: string;
  defaultCalendarSummary: string | null;
  lastUsedAt: Date | null;
  createdAt: Date;
  calendars: GoogleAccountCalendarSummary[];
}

export interface GoogleAccountCalendarSummary {
  id: string;
  calendarId: string;
  summary: string;
  description: string | null;
  timeZone: string | null;
  primary: boolean;
  accessRole: string | null;
  backgroundColor: string | null;
}

export async function listGoogleAccounts(): Promise<GoogleAccountSummary[]> {
  const rows = await prisma.googleAccount.findMany({
    orderBy: [{ isDefault: "desc" }, { createdAt: "asc" }],
    include: { calendars: { orderBy: [{ primary: "desc" }, { summary: "asc" }] } },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    name: r.name,
    picture: r.picture,
    isDefault: r.isDefault,
    defaultCalendarId: r.defaultCalendarId,
    defaultCalendarSummary: r.defaultCalendarSummary,
    lastUsedAt: r.lastUsedAt,
    createdAt: r.createdAt,
    calendars: r.calendars.map((c) => ({
      id: c.id,
      calendarId: c.calendarId,
      summary: c.summary,
      description: c.description,
      timeZone: c.timeZone,
      primary: c.primary,
      accessRole: c.accessRole,
      backgroundColor: c.backgroundColor,
    })),
  }));
}

export async function getDefaultGoogleAccount(): Promise<GoogleAccountSummary | null> {
  const accounts = await listGoogleAccounts();
  return accounts.find((a) => a.isDefault) ?? accounts[0] ?? null;
}
