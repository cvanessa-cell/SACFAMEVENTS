// Live credential checks — run: INTEGRATION_CREDENTIALS=1 npm run test:integration
// Skip Calendar ping: SKIP_GOOGLE_CALENDAR_LIVE=1. Does not print secret values.
import path from "node:path";

import { config as loadEnv } from "dotenv";
import { afterAll, describe, expect, it } from "vitest";

import { getAirtableConfig } from "@/lib/airtable";
import { pingGoogleCalendarFromPrisma } from "@/lib/google/calendarPing";
import { prisma } from "@/lib/prisma";
import { checkSupabaseReachability } from "@/lib/supabase/health";

loadEnv({ path: path.resolve(process.cwd(), ".env") });

const LIVE = process.env.INTEGRATION_CREDENTIALS === "1";

describe.skipIf(!LIVE)("integration credentials (INTEGRATION_CREDENTIALS=1)", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("Airtable: PAT can read base metadata", async () => {
    const cfg = getAirtableConfig();
    expect(cfg, "Set AIRTABLE_API_KEY and AIRTABLE_BASE_ID in .env").not.toBeNull();
    const res = await fetch(
      `https://api.airtable.com/v0/meta/bases/${cfg!.baseId}/tables`,
      {
        headers: { Authorization: `Bearer ${cfg!.apiKey}` },
        signal: AbortSignal.timeout(20_000),
      },
    );
    expect(res.status, `Airtable meta HTTP ${res.status}`).toBe(200);
    const body = (await res.json()) as { tables?: unknown[] };
    expect(Array.isArray(body.tables)).toBe(true);
  });

  it("Google OAuth: required env vars are set and redirect is a URL", () => {
    const id = process.env.GOOGLE_CLIENT_ID?.trim();
    const secret = process.env.GOOGLE_CLIENT_SECRET?.trim();
    const redirect = process.env.GOOGLE_REDIRECT_URI?.trim();
    expect(id, "GOOGLE_CLIENT_ID").toBeTruthy();
    expect(secret, "GOOGLE_CLIENT_SECRET").toBeTruthy();
    expect(redirect, "GOOGLE_REDIRECT_URI").toBeTruthy();
    expect(id!.endsWith(".apps.googleusercontent.com")).toBe(true);
    expect(() => new URL(redirect!)).not.toThrow();
  });

  it.skipIf(process.env.SKIP_GOOGLE_CALENDAR_LIVE === "1")(
    "Google Calendar: Prisma OAuth tokens can call calendarList.list",
    async () => {
      const result = await pingGoogleCalendarFromPrisma();
      const reason = (result as { reason?: string }).reason;
      const hint =
        reason === "no_stored_credentials"
          ? "Add GoogleCalendarCredentials (id=singleton) after completing Calendar OAuth, or set SKIP_GOOGLE_CALENDAR_LIVE=1 to skip."
          : reason === "missing_oauth_env"
            ? "Set GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI."
            : reason;
      expect(result.ok, hint).toBe(true);
    },
    60_000,
  );

  it("Cron: CRON_SECRET is strong enough and APP_BASE_URL is a URL", () => {
    const cron = process.env.CRON_SECRET?.trim();
    const base = process.env.APP_BASE_URL?.trim();
    expect(cron, "CRON_SECRET").toBeTruthy();
    expect(cron!.length, "CRON_SECRET should be at least 16 characters").toBeGreaterThanOrEqual(16);
    expect(base, "APP_BASE_URL").toBeTruthy();
    expect(() => new URL(base!)).not.toThrow();
  });

  it(
    "Cron: Bearer is accepted by /api/cron/check-event-sources when dev server is up",
    async () => {
      const secret = process.env.CRON_SECRET?.trim();
      const base = process.env.APP_BASE_URL?.replace(/\/$/, "");
      expect(secret).toBeTruthy();
      expect(base).toBeTruthy();
      const url = `${base}/api/cron/check-event-sources`;
      try {
        const res = await fetch(url, {
          headers: { Authorization: `Bearer ${secret}` },
          signal: AbortSignal.timeout(120_000),
        });
        expect(
          res.status,
          "401 = wrong CRON_SECRET; 503/connection = server down or handler error — see body",
        ).not.toBe(401);
        if (res.status === 503 || res.status === 500) {
          const j = (await res.json()) as { message?: string };
          expect(
            j.message || res.statusText,
            "Cron route returned error — check OPENAI/Prisma logs in server terminal",
          ).toBeTruthy();
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        if (msg.includes("fetch failed") || msg.includes("ECONNREFUSED") || msg.includes("aborted")) {
          expect.fail(
            "Could not reach APP_BASE_URL. Start `npm run dev` then re-run this test, or set APP_BASE_URL to a reachable host.",
          );
        }
        throw e;
      }
    },
    150_000,
  );

  it("Supabase: optional — reach auth health when configured", async () => {
    const result = await checkSupabaseReachability();
    if (!result.configured) {
      expect(true, "Supabase vars not set — skipping live check").toBe(true);
      return;
    }
    expect(result.ok, result.error ?? "Supabase auth health failed").toBe(true);
    expect(result.latencyMs).toBeGreaterThan(0);
  });
});
