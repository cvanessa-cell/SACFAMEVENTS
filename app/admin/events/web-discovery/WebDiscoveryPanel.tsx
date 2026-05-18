"use client";

import { useState, useTransition } from "react";

import {
  runWebDiscoveryAndSaveAction,
  runWebDiscoveryDryRunAction,
} from "@/app/admin/events/web-discovery/actions";
import type { DailyWebEventDiscoverySummary } from "@/lib/events/dailyWebEventDiscoveryService";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

interface WebDiscoveryPanelProps {
  enabled: boolean;
  dryRun: boolean;
  limit: number;
  lookaheadDays: number;
  model: string;
  hasOpenAiKey: boolean;
  hasAirtableConfig: boolean;
}

export function WebDiscoveryPanel({
  enabled,
  dryRun,
  limit,
  lookaheadDays,
  model,
  hasOpenAiKey,
  hasAirtableConfig,
}: WebDiscoveryPanelProps) {
  const [pending, startTransition] = useTransition();
  const [summary, setSummary] = useState<DailyWebEventDiscoverySummary | null>(null);
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<DailyWebEventDiscoverySummary>) {
    setError(null);
    startTransition(async () => {
      try {
        const result = await action();
        setSummary(result);
        if (!result.ok && result.message) setError(result.message);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Run failed");
      }
    });
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>Daily web event discovery</CardTitle>
          <CardDescription>
            OpenAI web search finds family-friendly events across Sacramento / Placer. New
            records are saved to Airtable as Need Review (never auto-published).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <dl className="grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-muted-foreground">Feature</dt>
              <dd className="font-medium">{enabled ? "Enabled" : "Disabled"}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Dry run (env)</dt>
              <dd className="font-medium">
                {dryRun ? "Yes — no Airtable writes" : "No — writes enabled"}
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Daily limit</dt>
              <dd className="font-medium">{limit} events</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Lookahead</dt>
              <dd className="font-medium">{lookaheadDays} days</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Model</dt>
              <dd className="font-mono text-xs">{model}</dd>
            </div>
            <div>
              <dt className="text-muted-foreground">OpenAI / Airtable</dt>
              <dd className="font-medium">
                {hasOpenAiKey ? "OpenAI OK" : "OpenAI missing"} ·{" "}
                {hasAirtableConfig ? "Airtable OK" : "Airtable missing"}
              </dd>
            </div>
          </dl>

          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={pending || !enabled}
              onClick={() => run(runWebDiscoveryDryRunAction)}
            >
              {pending ? "Running…" : "Run Web Discovery Dry Run"}
            </Button>
            <Button
              type="button"
              disabled={pending || !enabled || !hasAirtableConfig}
              onClick={() => run(runWebDiscoveryAndSaveAction)}
            >
              {pending ? "Running…" : "Run Web Discovery and Save Events"}
            </Button>
          </div>

          {error ? (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          ) : null}
        </CardContent>
      </Card>

      {summary ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Last run summary</CardTitle>
            <CardDescription>
              {summary.runAt} · {summary.dateWindow.startDate} → {summary.dateWindow.endDate}
              {summary.dryRun ? " · dry run" : ""}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4 text-sm">
            <ul className="grid gap-1 sm:grid-cols-2">
              <li>Source preferences: {summary.sourcePreferencesLoaded}</li>
              <li>Candidates found: {summary.candidatesFound}</li>
              <li>Valid in window: {summary.candidatesValid}</li>
              <li>Duplicates skipped: {summary.duplicatesSkipped}</li>
              <li>Selected: {summary.eventsSelected}</li>
              <li>Created in Airtable: {summary.eventsCreated}</li>
            </ul>

            {summary.errors.length > 0 ? (
              <div>
                <p className="font-medium text-destructive">Errors</p>
                <ul className="list-inside list-disc text-destructive">
                  {summary.errors.map((e) => (
                    <li key={e}>{e}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {summary.selectedEvents.length > 0 ? (
              <div className="space-y-3">
                <p className="font-medium">Selected events</p>
                {summary.selectedEvents.map((ev) => (
                  <div
                    key={`${ev.event_url}-${ev.event_date}`}
                    className="rounded-md border p-3"
                  >
                    <p className="font-medium">{ev.event_title}</p>
                    <p className="text-muted-foreground">
                      {ev.event_date} · {ev.city} · score {ev.confidence_score}/10
                    </p>
                    <a
                      href={ev.event_url}
                      className="text-primary underline"
                      target="_blank"
                      rel="noreferrer"
                    >
                      Event page
                    </a>
                  </div>
                ))}
              </div>
            ) : null}
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
