export const dynamic = "force-dynamic";

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
      <h1 className="text-3xl font-semibold">Event Monitoring</h1>
      <p className="text-sm text-muted-foreground">OpenAI webhook + source change processing health overview.</p>
      <ul className="space-y-2 text-sm">
        <li>Total sources: {sourceCount}</li>
        <li>Pending AI jobs: {pendingJobs}</li>
        <li>Failed/incomplete AI jobs: {failedJobs}</li>
        <li>Events needing review: {needsReview}</li>
      </ul>
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
