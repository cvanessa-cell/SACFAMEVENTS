export const dynamic = "force-dynamic";

import { runDiscoveryNowAction } from "@/app/admin/actions";
import { prisma } from "@/lib/prisma";
import { checkSupabaseReachability } from "@/lib/supabase/health";

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
    prisma.aiEventExtractionJob.count({ where: { status: { in: ["failed", "incomplete", "cancelled"] } } }),
    prisma.familyEvent.count({ where: { status: "needs_review" } }),
    prisma.openAIWebhookTask.count({ where: { status: "pending" } }),
    prisma.openAIWebhookTask.count({ where: { status: "processing" } }),
    prisma.openAIWebhookTask.count({ where: { status: "failed" } }),
    checkSupabaseReachability(),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h1 className="text-3xl font-semibold">Event monitoring</h1>
          <p className="text-sm text-muted-foreground">
            OpenAI webhook + source-change processing health overview.
          </p>
        </div>
        <form action={runDiscoveryNowAction}>
          <button
            type="submit"
            className="rounded-md border border-input bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90"
          >
            Run discovery now
          </button>
        </form>
      </div>
      <div className="grid gap-3 grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Sources</div>
          <div className="text-2xl font-semibold">{sourceCount}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Pending AI jobs</div>
          <div className="text-2xl font-semibold">{pendingJobs}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Failed AI jobs</div>
          <div className="text-2xl font-semibold">{failedJobs}</div>
        </div>
        <div className="rounded-lg border p-3">
          <div className="text-xs text-muted-foreground">Needs review</div>
          <div className="text-2xl font-semibold">{needsReview}</div>
        </div>
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
        <ul className="mt-2 space-y-1">
          <li>Pending: {queuePending}</li>
          <li>Processing: {queueProcessing}</li>
          <li>Failed: {queueFailed}</li>
        </ul>
        <form className="mt-3" action="/api/admin/openai-webhook-tasks/process-now" method="post">
          <button type="submit" className="rounded border px-3 py-1">
            Process queue now
          </button>
        </form>
      </div>
      <div className="text-sm">
        <a className="underline" href="/admin/event-sources">Open event sources</a>
        {" · "}
        <a className="underline" href="/admin/event-review">Open review queue</a>
      </div>
    </div>
  );
}
