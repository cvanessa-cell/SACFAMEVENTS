export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";
import { z } from "zod";

import { isGoogleCalendarConnected } from "@/lib/googleCalendar";
import { prisma } from "@/lib/prisma";

const SINGLETON_ID = "singleton";

const settingsSchema = z.object({
  automationEnabled: z.boolean(),
  frequency: z.enum(["daily", "weekly", "monthly"]),
  preferredRunTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/, "preferredRunTime must be HH:mm"),
  maxSourcesPerRun: z.number().int().min(1).max(500),
  onlyActiveSources: z.boolean(),
  autoConfirmHighConfidence: z.boolean(),
  autoAddToGoogleCalendar: z.boolean(),
  minConfidenceAutoConfirm: z.number().min(0).max(1),
  defaultReminderProfile: z.enum(["none", "30m", "1h", "1d", "custom"]),
  customReminderMinutesJson: z.string().nullable().optional(),
  zapierWebhookEnabled: z.boolean(),
  slackDigestEnabled: z.boolean().optional().default(true),
  slackDigestHour: z.number().int().min(0).max(23).optional().default(16),
  notifyOnNewEvents: z.boolean().optional().default(true),
  notifyOnFailedChecks: z.boolean().optional().default(true),
  notifyOnReviewBacklog: z.boolean().optional().default(true),
  reviewBacklogThreshold: z.number().int().min(1).max(500).optional().default(25),
});

export type AppAutomationSettingsPayload = z.infer<typeof settingsSchema>;

const DEFAULTS: AppAutomationSettingsPayload = {
  automationEnabled: false,
  frequency: "weekly",
  preferredRunTime: "09:00",
  maxSourcesPerRun: 25,
  onlyActiveSources: true,
  autoConfirmHighConfidence: false,
  autoAddToGoogleCalendar: false,
  minConfidenceAutoConfirm: 0.85,
  defaultReminderProfile: "1h",
  customReminderMinutesJson: null,
  zapierWebhookEnabled: false,
  slackDigestEnabled: true,
  slackDigestHour: 16,
  notifyOnNewEvents: true,
  notifyOnFailedChecks: true,
  notifyOnReviewBacklog: true,
  reviewBacklogThreshold: 25,
};

async function envFlags() {
  let googleCalendarConnected = false;
  let googleAccountCount = 0;
  try {
    googleCalendarConnected = await isGoogleCalendarConnected();
    googleAccountCount = await prisma.googleAccount.count();
  } catch {
    /* ignore — DB might be cold */
  }
  return {
    airtableConfigured: Boolean(
      process.env.AIRTABLE_API_KEY?.trim() &&
        process.env.AIRTABLE_BASE_ID?.trim(),
    ),
    googleOAuthConfigured: Boolean(
      process.env.GOOGLE_CLIENT_ID?.trim() &&
        process.env.GOOGLE_CLIENT_SECRET?.trim() &&
        process.env.GOOGLE_REDIRECT_URI?.trim(),
    ),
    googleCalendarConnected,
    googleAccountCount,
    googleMapsConfigured: Boolean(
      process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim(),
    ),
    zapierConfigured:
      Boolean(process.env.ZAPIER_WEBHOOK_URL?.trim()) &&
      process.env.ZAPIER_ENABLED?.toLowerCase() !== "false",
    openaiConfigured: Boolean(process.env.OPENAI_API_KEY?.trim()),
    cronSecretSet: Boolean(process.env.CRON_SECRET?.trim()),
    supabaseConfigured: Boolean(
      process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() &&
        (process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
          process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim()),
    ),
  };
}

async function loadOrInitSettings(): Promise<AppAutomationSettingsPayload> {
  const row = await prisma.appAutomationSettings.findUnique({
    where: { id: SINGLETON_ID },
  });
  if (!row) {
    const created = await prisma.appAutomationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...DEFAULTS },
      update: {},
    });
    return rowToPayload(created);
  }
  return rowToPayload(row);
}

function rowToPayload(row: {
  automationEnabled: boolean;
  frequency: string;
  preferredRunTime: string;
  maxSourcesPerRun: number;
  onlyActiveSources: boolean;
  autoConfirmHighConfidence: boolean;
  autoAddToGoogleCalendar: boolean;
  minConfidenceAutoConfirm: number;
  defaultReminderProfile: string;
  customReminderMinutesJson: string | null;
  zapierWebhookEnabled: boolean;
  slackDigestEnabled?: boolean;
  slackDigestHour?: number;
  notifyOnNewEvents?: boolean;
  notifyOnFailedChecks?: boolean;
  notifyOnReviewBacklog?: boolean;
  reviewBacklogThreshold?: number;
}): AppAutomationSettingsPayload {
  return settingsSchema.parse({
    automationEnabled: row.automationEnabled,
    frequency: row.frequency,
    preferredRunTime: row.preferredRunTime,
    maxSourcesPerRun: row.maxSourcesPerRun,
    onlyActiveSources: row.onlyActiveSources,
    autoConfirmHighConfidence: row.autoConfirmHighConfidence,
    autoAddToGoogleCalendar: row.autoAddToGoogleCalendar,
    minConfidenceAutoConfirm: row.minConfidenceAutoConfirm,
    defaultReminderProfile: row.defaultReminderProfile,
    customReminderMinutesJson: row.customReminderMinutesJson,
    zapierWebhookEnabled: row.zapierWebhookEnabled,
    slackDigestEnabled: row.slackDigestEnabled,
    slackDigestHour: row.slackDigestHour,
    notifyOnNewEvents: row.notifyOnNewEvents,
    notifyOnFailedChecks: row.notifyOnFailedChecks,
    notifyOnReviewBacklog: row.notifyOnReviewBacklog,
    reviewBacklogThreshold: row.reviewBacklogThreshold,
  });
}

export async function GET() {
  try {
    const [settings, env] = await Promise.all([
      loadOrInitSettings(),
      envFlags(),
    ]);
    return NextResponse.json({
      ok: true,
      settings,
      env,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      {
        ok: false,
        message,
        settings: DEFAULTS,
        env: await envFlags(),
      },
      { status: 503 },
    );
  }
}

export async function PUT(req: Request) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const parsed = settingsSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        ok: false,
        message: "Validation failed",
        issues: parsed.error.issues,
      },
      { status: 400 },
    );
  }

  try {
    const saved = await prisma.appAutomationSettings.upsert({
      where: { id: SINGLETON_ID },
      create: { id: SINGLETON_ID, ...parsed.data },
      update: parsed.data,
    });
    return NextResponse.json({
      ok: true,
      settings: rowToPayload(saved),
      env: await envFlags(),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Unknown error";
    return NextResponse.json(
      { ok: false, message },
      { status: 500 },
    );
  }
}
