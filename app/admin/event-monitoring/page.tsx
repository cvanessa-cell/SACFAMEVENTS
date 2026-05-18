export const dynamic = "force-dynamic";

import { runDiscoveryNowAction } from "@/app/admin/actions";
import { GlossaryHint, GlossaryTitle } from "@/components/admin/GlossaryHint";
import { glossaryDefinition } from "@/lib/admin/operationsConsoleGlossary";
import { prisma } from "@/lib/prisma";
import { checkSupabaseReachability } from "@/lib/supabase/health";

function StatBlock({
  label,
  value,
  definition,
}: {
  label: string;
  value: number;
  definition: string;
}) {
  return (
    <div className="rounded-lg border p-3">
      <div className="text-xs font-medium text-muted-foreground">{label}</div>
      <GlossaryHint term={label} definition={definition} className="mb-2 mt-0.5" />
      <div className="text-2xl font-semibold">{value}</div>
    </div>
  );
}

export default async function EventMonitoringPage() {
  const [
    sourceCount,
    pendingJobs,
    failedJobs,
    needsReview,
    queuePending,
    queueProcessing,
    queueFailed,
    supabase,
  ] = await Promise.all([
    prisma.eventSource.count(),
    prisma.aiEventExtractionJob.count({ where: { status: { in: ["created", "sent"] } } }),
    prisma.aiEventExtractionJob.count({
      where: { status: { in: ["failed", "incomplete", "cancelled"] } },
    }),
    prisma.familyEvent.count({ where: { status: "needs_review" } }),
    prisma.openAIWebhookTask.count({ where: { status: "pending" } }),
    prisma.openAIWebhookTask.count({ where: { status: "processing" } }),
    prisma.openAIWebhookTask.count({ where: { status: "failed" } }),
    checkSupabaseReachability(),
  ]);

  const runDiscoveryDef =
    glossaryDefinition("monitoring-actions", "Run discovery now") ?? "";
  const processQueueDef =
    glossaryDefinition("monitoring-actions", "Process queue now") ?? "";

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Event monitoring</h1>
          <p className="text-sm text-muted-foreground">
            OpenAI webhook + source-change processing health overview.
          </p>
        </div>
        <div className="max-w-xs space-y-1">
          <form action={runDiscoveryNowAction}>
            <GlossaryTitle term="Run discovery now" definition={runDiscoveryDef}>
              <button
                type="submit"
                className="w-full rounded-md border border-input bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
              >
                Run discovery now
              </button>
            </GlossaryTitle>
          </form>
          <GlossaryHint term="Run discovery now" definition={runDiscoveryDef} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatBlock
          label="Sources"
          value={sourceCount}
          definition={glossaryDefinition("monitoring-stats", "Sources") ?? ""}
        />
        <StatBlock
          label="Pending AI jobs"
          value={pendingJobs}
          definition={glossaryDefinition("monitoring-stats", "Pending AI jobs") ?? ""}
        />
        <StatBlock
          label="Failed AI jobs"
          value={failedJobs}
          definition={glossaryDefinition("monitoring-stats", "Failed AI jobs") ?? ""}
        />
        <StatBlock
          label="Needs review"
          value={needsReview}
          definition={glossaryDefinition("monitoring-stats", "Needs review") ?? ""}
        />
      </div>

      <div className="rounded border p-3 text-sm">
        <div className="font-medium">Supabase (optional)</div>
        <p className="mt-2 text-muted-foreground">
          {!supabase.configured &&
            "Not configured — this app uses local SQLite via Prisma and Airtable for events. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY when you add a Supabase project."}
          {supabase.configured && supabase.ok && (
            <>
              Connected to your project (<code className="rounded bg-muted px-1">auth</code> health{" "}
              {supabase.latencyMs}&nbsp;ms). Use{" "}
              <a className="underline" href="/api/health/supabase">
                /api/health/supabase
              </a>{" "}
              for uptime checks.
            </>
          )}
          {supabase.configured && !supabase.ok && (
            <>
              <span className="text-destructive">
                Reachability check failed{supabase.error ? `: ${supabase.error}` : ""}.
              </span>{" "}
              Confirm URL/key in the dashboard (Settings → API) and redeploy if needed.
            </>
          )}
        </p>
      </div>

      <div className="rounded border p-3 text-sm">
        <div className="font-medium">Webhook queue</div>
        <ul className="mt-2 space-y-2">
          <li>
            <span className="font-medium">Pending:</span> {queuePending}
            <GlossaryHint term="Webhook queue — Pending" className="mt-0.5" />
          </li>
          <li>
            <span className="font-medium">Processing:</span> {queueProcessing}
            <GlossaryHint term="Webhook queue — Processing" className="mt-0.5" />
          </li>
          <li>
            <span className="font-medium">Failed:</span> {queueFailed}
            <GlossaryHint term="Webhook queue — Failed" className="mt-0.5" />
          </li>
        </ul>
        <form
          className="mt-3 space-y-1"
          action="/api/admin/openai-webhook-tasks/process-now"
          method="post"
        >
          <GlossaryTitle term="Process queue now" definition={processQueueDef}>
            <button type="submit" className="rounded border px-3 py-1">
              Process queue now
            </button>
          </GlossaryTitle>
          <GlossaryHint term="Process queue now" definition={processQueueDef} />
        </form>
      </div>

      <div className="text-sm">
        <a className="underline" href="/admin/event-sources">
          Open event sources
        </a>
        <span className="text-muted-foreground">
          {" "}
          — manage per-source badges (Enabled, Due, Changed) and Check now / AI monitor
        </span>
        {" · "}
        <a className="underline" href="/admin/event-review">
          Open review queue
        </a>
        <span className="text-muted-foreground">
          {" "}
          — approve extracted events for the public site
        </span>
      </div>
    </div>
  );
}
