"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as React from "react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

interface AutomationSettings {
  automationEnabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  preferredRunTime: string;
  maxSourcesPerRun: number;
  onlyActiveSources: boolean;
  autoConfirmHighConfidence: boolean;
  autoAddToGoogleCalendar: boolean;
  minConfidenceAutoConfirm: number;
  defaultReminderProfile: "none" | "30m" | "1h" | "1d" | "custom";
  customReminderMinutesJson: string | null;
  zapierWebhookEnabled: boolean;
  slackDigestEnabled: boolean;
  slackDigestHour: number;
  notifyOnNewEvents: boolean;
  notifyOnFailedChecks: boolean;
  notifyOnReviewBacklog: boolean;
  reviewBacklogThreshold: number;
}

interface EnvFlags {
  airtableConfigured: boolean;
  googleOAuthConfigured: boolean;
  googleCalendarConnected: boolean;
  googleAccountCount: number;
  googleMapsConfigured: boolean;
  zapierConfigured: boolean;
  openaiConfigured: boolean;
  cronSecretSet: boolean;
  supabaseConfigured: boolean;
}

interface SettingsResponse {
  ok: boolean;
  message?: string;
  settings: AutomationSettings;
  env: EnvFlags;
}

async function fetchSettings(): Promise<SettingsResponse> {
  const res = await fetch("/api/settings", { cache: "no-store" });
  const body = (await res.json()) as SettingsResponse;
  if (!body.settings) throw new Error(body.message ?? "Failed to load settings");
  return body;
}

async function saveSettings(
  next: AutomationSettings,
): Promise<SettingsResponse> {
  const res = await fetch("/api/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(next),
  });
  const body = (await res.json()) as SettingsResponse & {
    message?: string;
    issues?: unknown;
  };
  if (!res.ok || !body.ok) {
    throw new Error(body.message ?? "Failed to save settings");
  }
  return body;
}

export function SettingsPanel() {
  const queryClient = useQueryClient();
  const { data, isLoading, error, isFetching } = useQuery({
    queryKey: ["app-settings"],
    queryFn: fetchSettings,
  });

  const [draft, setDraft] = React.useState<AutomationSettings | null>(null);
  const [savedAt, setSavedAt] = React.useState<Date | null>(null);

  React.useEffect(() => {
    if (data?.settings && !draft) setDraft(data.settings);
  }, [data?.settings, draft]);

  const mutation = useMutation({
    mutationFn: saveSettings,
    onSuccess: (resp) => {
      queryClient.setQueryData(["app-settings"], resp);
      setDraft(resp.settings);
      setSavedAt(new Date());
    },
  });

  function update<K extends keyof AutomationSettings>(
    key: K,
    value: AutomationSettings[K],
  ) {
    setDraft((prev) => (prev ? { ...prev, [key]: value } : prev));
  }

  function resetToServer() {
    if (data?.settings) setDraft(data.settings);
  }

  const dirty =
    draft && data?.settings
      ? JSON.stringify(draft) !== JSON.stringify(data.settings)
      : false;

  return (
    <div className="space-y-6">
      <EnvStatusCard env={data?.env} loading={isLoading} />

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Automation preferences</CardTitle>
            <CardDescription>
              Stored in Postgres (Prisma · <code>AppAutomationSettings</code>).
              Master event data still lives in Airtable.
            </CardDescription>
          </div>
          {savedAt ? (
            <span className="text-xs text-muted-foreground">
              Saved {savedAt.toLocaleTimeString()}
            </span>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-6">
          {error ? (
            <div className="rounded border border-destructive/50 p-3 text-sm text-destructive">
              {error instanceof Error
                ? error.message
                : "Failed to load settings"}
            </div>
          ) : null}
          {mutation.isError ? (
            <div className="rounded border border-destructive/50 p-3 text-sm text-destructive">
              {mutation.error instanceof Error
                ? mutation.error.message
                : "Save failed"}
            </div>
          ) : null}
          {isLoading || !draft ? (
            <p className="text-sm text-muted-foreground">Loading…</p>
          ) : (
            <form
              className="space-y-6"
              onSubmit={(e) => {
                e.preventDefault();
                if (draft) mutation.mutate(draft);
              }}
            >
              <Section title="Scheduler">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="automationEnabled"
                    checked={draft.automationEnabled}
                    onCheckedChange={(v) =>
                      update("automationEnabled", Boolean(v))
                    }
                  />
                  <Label htmlFor="automationEnabled">
                    Enable scheduled discovery runs
                  </Label>
                </div>
                <div className="grid gap-3 sm:grid-cols-3">
                  <Field label="Frequency">
                    <select
                      value={draft.frequency}
                      onChange={(e) =>
                        update(
                          "frequency",
                          e.target
                            .value as AutomationSettings["frequency"],
                        )
                      }
                      className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    >
                      <option value="daily">Daily</option>
                      <option value="weekly">Weekly</option>
                      <option value="monthly">Monthly</option>
                    </select>
                  </Field>
                  <Field label="Preferred run time (HH:mm)">
                    <Input
                      type="time"
                      value={draft.preferredRunTime}
                      onChange={(e) =>
                        update("preferredRunTime", e.target.value)
                      }
                    />
                  </Field>
                  <Field label="Max sources per run">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={draft.maxSourcesPerRun}
                      onChange={(e) =>
                        update(
                          "maxSourcesPerRun",
                          Math.max(
                            1,
                            Math.min(500, Number(e.target.value) || 1),
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="onlyActiveSources"
                    checked={draft.onlyActiveSources}
                    onCheckedChange={(v) =>
                      update("onlyActiveSources", Boolean(v))
                    }
                  />
                  <Label htmlFor="onlyActiveSources">
                    Only check sources marked Active
                  </Label>
                </div>
              </Section>

              <Section title="Auto-confirmation">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="autoConfirmHighConfidence"
                    checked={draft.autoConfirmHighConfidence}
                    onCheckedChange={(v) =>
                      update("autoConfirmHighConfidence", Boolean(v))
                    }
                  />
                  <Label htmlFor="autoConfirmHighConfidence">
                    Auto-confirm high-confidence extractions
                  </Label>
                </div>
                <Field label="Minimum confidence to auto-confirm (0–1)">
                  <Input
                    type="number"
                    min={0}
                    max={1}
                    step={0.01}
                    value={draft.minConfidenceAutoConfirm}
                    onChange={(e) =>
                      update(
                        "minConfidenceAutoConfirm",
                        Math.max(
                          0,
                          Math.min(1, Number(e.target.value) || 0),
                        ),
                      )
                    }
                  />
                </Field>
              </Section>

              <Section title="Calendar &amp; reminders">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="autoAddToGoogleCalendar"
                    checked={draft.autoAddToGoogleCalendar}
                    onCheckedChange={(v) =>
                      update("autoAddToGoogleCalendar", Boolean(v))
                    }
                  />
                  <Label htmlFor="autoAddToGoogleCalendar">
                    Auto-add confirmed events to Google Calendar
                  </Label>
                </div>
                <Field label="Default reminder profile">
                  <select
                    value={draft.defaultReminderProfile}
                    onChange={(e) =>
                      update(
                        "defaultReminderProfile",
                        e.target
                          .value as AutomationSettings["defaultReminderProfile"],
                      )
                    }
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="none">None</option>
                    <option value="30m">30 minutes before</option>
                    <option value="1h">1 hour before</option>
                    <option value="1d">1 day before</option>
                    <option value="custom">Custom (JSON)</option>
                  </select>
                </Field>
                {draft.defaultReminderProfile === "custom" ? (
                  <Field label="Custom reminder minutes (JSON array)">
                    <Input
                      placeholder="[60, 1440]"
                      value={draft.customReminderMinutesJson ?? ""}
                      onChange={(e) =>
                        update(
                          "customReminderMinutesJson",
                          e.target.value || null,
                        )
                      }
                    />
                  </Field>
                ) : null}
              </Section>

              <Section title="Outbound webhooks">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="zapierWebhookEnabled"
                    checked={draft.zapierWebhookEnabled}
                    onCheckedChange={(v) =>
                      update("zapierWebhookEnabled", Boolean(v))
                    }
                  />
                  <Label htmlFor="zapierWebhookEnabled">
                    Send confirmed events to Zapier
                  </Label>
                </div>
                {!data?.env.zapierConfigured && draft.zapierWebhookEnabled ? (
                  <p className="text-xs text-amber-600">
                    Zapier webhook URL is not configured in <code>.env</code>;
                    saving this flag will not deliver events until{" "}
                    <code>ZAPIER_WEBHOOK_URL</code> is set.
                  </p>
                ) : null}
              </Section>

              <Section title="Notifications">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="slackDigestEnabled"
                    checked={draft.slackDigestEnabled}
                    onCheckedChange={(v) =>
                      update("slackDigestEnabled", Boolean(v))
                    }
                  />
                  <Label htmlFor="slackDigestEnabled">
                    Enable daily Slack digest
                  </Label>
                </div>
                {draft.slackDigestEnabled && (
                  <Field label="Digest hour (0–23, local time)">
                    <Input
                      type="number"
                      min={0}
                      max={23}
                      value={draft.slackDigestHour}
                      onChange={(e) =>
                        update(
                          "slackDigestHour",
                          Math.max(0, Math.min(23, Number(e.target.value) || 0)),
                        )
                      }
                    />
                  </Field>
                )}
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notifyOnNewEvents"
                    checked={draft.notifyOnNewEvents}
                    onCheckedChange={(v) =>
                      update("notifyOnNewEvents", Boolean(v))
                    }
                  />
                  <Label htmlFor="notifyOnNewEvents">
                    Notify when new events are extracted
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notifyOnFailedChecks"
                    checked={draft.notifyOnFailedChecks}
                    onCheckedChange={(v) =>
                      update("notifyOnFailedChecks", Boolean(v))
                    }
                  />
                  <Label htmlFor="notifyOnFailedChecks">
                    Notify on failed source checks
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="notifyOnReviewBacklog"
                    checked={draft.notifyOnReviewBacklog}
                    onCheckedChange={(v) =>
                      update("notifyOnReviewBacklog", Boolean(v))
                    }
                  />
                  <Label htmlFor="notifyOnReviewBacklog">
                    Notify when review backlog exceeds threshold
                  </Label>
                </div>
                {draft.notifyOnReviewBacklog && (
                  <Field label="Review backlog threshold">
                    <Input
                      type="number"
                      min={1}
                      max={500}
                      value={draft.reviewBacklogThreshold}
                      onChange={(e) =>
                        update(
                          "reviewBacklogThreshold",
                          Math.max(1, Math.min(500, Number(e.target.value) || 25)),
                        )
                      }
                    />
                  </Field>
                )}
              </Section>

              <div className="flex flex-wrap items-center gap-3 border-t pt-4">
                <Button
                  type="submit"
                  disabled={mutation.isPending || !dirty}
                >
                  {mutation.isPending ? "Saving…" : "Save changes"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={resetToServer}
                  disabled={mutation.isPending || !dirty}
                >
                  Discard changes
                </Button>
                {isFetching ? (
                  <span className="text-xs text-muted-foreground">
                    Refreshing…
                  </span>
                ) : null}
                {dirty ? (
                  <Badge variant="secondary">Unsaved changes</Badge>
                ) : null}
              </div>
            </form>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <fieldset className="space-y-3 rounded-md border p-4">
      <legend className="px-1 text-sm font-semibold">{title}</legend>
      {children}
    </fieldset>
  );
}

function Field({
  label,
  children,
}: {
  label: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-sm">
      <span className="text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function EnvStatusCard({
  env,
  loading,
}: {
  env: EnvFlags | undefined;
  loading: boolean;
}) {
  const items: { label: string; key: keyof EnvFlags; help: string }[] = [
    {
      label: "Airtable",
      key: "airtableConfigured",
      help: "AIRTABLE_API_KEY + AIRTABLE_BASE_ID",
    },
    {
      label: "Google OAuth",
      key: "googleOAuthConfigured",
      help: "GOOGLE_CLIENT_ID + SECRET + REDIRECT_URI",
    },
    {
      label: "Google account(s) connected",
      key: "googleCalendarConnected",
      help: "Connect one or more accounts in the card above",
    },
    {
      label: "Google Maps embed",
      key: "googleMapsConfigured",
      help: "NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY (optional)",
    },
    {
      label: "OpenAI",
      key: "openaiConfigured",
      help: "OPENAI_API_KEY",
    },
    {
      label: "Zapier",
      key: "zapierConfigured",
      help: "ZAPIER_WEBHOOK_URL + ZAPIER_ENABLED",
    },
    {
      label: "Cron secret",
      key: "cronSecretSet",
      help: "CRON_SECRET (required for /api/cron/*)",
    },
    {
      label: "Supabase",
      key: "supabaseConfigured",
      help: "NEXT_PUBLIC_SUPABASE_URL + key",
    },
  ];
  return (
    <Card>
      <CardHeader>
        <CardTitle>Integration status</CardTitle>
        <CardDescription>
          Read-only check of environment variables used by this app.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const ok = env ? env[item.key] : false;
            return (
              <li
                key={item.key}
                className="flex items-center justify-between gap-2 rounded border p-2 text-sm"
              >
                <div>
                  <div className="font-medium">{item.label}</div>
                  <div className="text-xs text-muted-foreground">
                    {item.help}
                  </div>
                </div>
                <Badge variant={ok ? "default" : "secondary"}>
                  {loading
                    ? "…"
                    : ok
                      ? "Configured"
                      : "Missing"}
                </Badge>
              </li>
            );
          })}
        </ul>
      </CardContent>
    </Card>
  );
}
