export const dynamic = "force-dynamic";

import Link from "next/link";

import {
  checkSourceNowAction,
  retryAiExtractionAction,
  runDiscoveryNowAction,
  toggleSourceAction,
} from "@/app/admin/actions";
import { runEventMonitorAction } from "@/app/admin/sacfamAgentActions";
import { GlossaryHint, GlossaryTitle } from "@/components/admin/GlossaryHint";
import { readSacfamAgentConfig } from "@/lib/ai/sacfamAgentEnv";
import { glossaryDefinition } from "@/lib/admin/operationsConsoleGlossary";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { prisma } from "@/lib/prisma";

interface PageProps {
  searchParams?: { q?: string; status?: string };
}

const STATUS_FILTERS = ["all", "enabled", "disabled", "failed", "due"] as const;
type StatusFilter = (typeof STATUS_FILTERS)[number];

function isDue(
  source: {
    enabled: boolean;
    lastCheckedAt: Date | null;
    checkFrequencyMinutes: number;
    fetchStrategy: string;
  },
  now: number,
): boolean {
  if (!source.enabled) return false;
  if (source.fetchStrategy === "disabled" || source.fetchStrategy === "manual_review") {
    return false;
  }
  if (!source.lastCheckedAt) return true;
  const intervalMs = Math.max(1, source.checkFrequencyMinutes) * 60_000;
  return source.lastCheckedAt.getTime() + intervalMs <= now;
}

function statusVariant(
  status: string | null,
): "default" | "secondary" | "destructive" | "outline" {
  if (!status) return "secondary";
  if (status === "failed") return "destructive";
  if (status === "changed") return "default";
  if (status === "skipped") return "outline";
  return "secondary";
}

function formatRelative(date: Date | null): string {
  if (!date) return "never";
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

export default async function EventSourcesAdminPage({
  searchParams,
}: PageProps) {
  const q = searchParams?.q?.trim().toLowerCase() ?? "";
  const statusParam = (searchParams?.status ?? "all") as StatusFilter;
  const status: StatusFilter = STATUS_FILTERS.includes(statusParam)
    ? statusParam
    : "all";

  const [
    allSources,
    totalCount,
    enabledCount,
    failedCount,
    recentChanges,
    recentJobs,
    pendingChanges,
  ] = await Promise.all([
    prisma.eventSource.findMany({
      orderBy: [{ lastFailureAt: "desc" }, { lastCheckedAt: "asc" }],
      take: 500,
    }),
    prisma.eventSource.count(),
    prisma.eventSource.count({ where: { enabled: true } }),
    prisma.eventSource.count({ where: { lastStatus: "failed" } }),
    prisma.sourceChange.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { source: true },
    }),
    prisma.aiEventExtractionJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 15,
      include: { sourceChange: { include: { source: true } } },
    }),
    prisma.sourceChange.count({ where: { status: "pending_ai" } }),
  ]);

  const now = Date.now();
  const dueCount = allSources.filter((s) => isDue(s, now)).length;
  const agentConfig = readSacfamAgentConfig();
  const monitorAvailable = agentConfig.eventMonitorEnabled && agentConfig.hasOpenAiKey;

  let filtered = allSources;
  if (q) {
    filtered = filtered.filter((s) => {
      const haystack = `${s.name} ${s.sourceUrl} ${s.city ?? ""} ${
        s.county ?? ""
      } ${s.category ?? ""}`.toLowerCase();
      return haystack.includes(q);
    });
  }
  switch (status) {
    case "enabled":
      filtered = filtered.filter((s) => s.enabled);
      break;
    case "disabled":
      filtered = filtered.filter((s) => !s.enabled);
      break;
    case "failed":
      filtered = filtered.filter((s) => s.lastStatus === "failed");
      break;
    case "due":
      filtered = filtered.filter((s) => isDue(s, now));
      break;
    case "all":
      break;
  }

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="space-y-2">
          <h1 className="text-3xl font-semibold">Event sources admin</h1>
          <p className="text-sm text-muted-foreground">
            Manage upstream sources, trigger one-off discovery checks, and
            retry failed AI extraction jobs. Cron at{" "}
            <code>/api/cron/check-event-sources</code> runs the same pipeline
            on a schedule.
          </p>
        </div>
        <div className="max-w-xs space-y-1">
          <form action={runDiscoveryNowAction}>
            <GlossaryTitle
              term="Run discovery now"
              definition={glossaryDefinition("monitoring-actions", "Run discovery now")}
            >
              <button
                type="submit"
                className="w-full rounded-md border border-input bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 sm:w-auto"
              >
                Run discovery now
              </button>
            </GlossaryTitle>
          </form>
          <GlossaryHint
            term="Run discovery now"
            definition={glossaryDefinition("monitoring-actions", "Run discovery now")}
          />
        </div>
      </header>

      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <StatCard
          label="Total sources"
          value={totalCount}
          definition={glossaryDefinition("source-stats", "Total sources")}
        />
        <StatCard
          label="Enabled"
          value={enabledCount}
          definition={glossaryDefinition("source-stats", "Enabled")}
        />
        <StatCard
          label="Last status: failed"
          value={failedCount}
          tone="warn"
          definition={glossaryDefinition("source-stats", "Last status: failed")}
        />
        <StatCard
          label="Due for check"
          value={dueCount}
          tone="info"
          definition={glossaryDefinition("source-stats", "Due for check")}
        />
        <StatCard
          label="Pending AI extraction"
          value={pendingChanges}
          tone="info"
          definition={glossaryDefinition("source-stats", "Pending AI extraction")}
        />
      </section>

      <Card>
        <CardHeader className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-1">
            <CardTitle>Sources ({filtered.length} shown)</CardTitle>
            <CardDescription>
              Row actions and status badges are defined in the field guide above.
              Hover buttons for a short tooltip; see badge definitions below the
              filter.
            </CardDescription>
            <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1">
              {(["Enabled", "Due", "changed", "Check now", "AI monitor"] as const).map(
                (term) => (
                  <GlossaryHint key={term} term={term} className="max-w-[14rem]" />
                ),
              )}
            </div>
          </div>
          <form
            method="get"
            className="flex flex-wrap items-center gap-2"
            action="/admin/event-sources"
          >
            <Input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Search name, URL, city…"
              className="sm:w-64"
            />
            <select
              name="status"
              defaultValue={status}
              className="h-9 rounded-md border border-input bg-background px-3 text-sm"
            >
              {STATUS_FILTERS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
            <button
              type="submit"
              className="h-9 rounded-md border border-input bg-background px-3 text-sm hover:bg-accent"
            >
              Apply
            </button>
            <GlossaryHint
              term={status}
              definition={glossaryDefinition("source-filters", status)}
              className="w-full basis-full sm:w-auto"
            />
            {q || status !== "all" ? (
              <Link
                href="/admin/event-sources"
                className="text-xs text-muted-foreground underline"
              >
                Clear
              </Link>
            ) : null}
          </form>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Source</th>
                  <th className="px-3 py-2">Type / city</th>
                  <th className="px-3 py-2">Last status</th>
                  <th className="px-3 py-2">Last checked</th>
                  <th className="px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-6 text-muted-foreground">
                      No sources match those filters.
                    </td>
                  </tr>
                ) : (
                  filtered.map((s) => (
                    <tr key={s.id} className="border-t align-top">
                      <td className="px-3 py-2">
                        <div className="font-medium">{s.name}</div>
                        <div className="text-xs">
                          <a
                            href={s.sourceUrl}
                            className="text-primary underline"
                            target="_blank"
                            rel="noreferrer"
                          >
                            {s.sourceUrl}
                          </a>
                        </div>
                        {s.lastError ? (
                          <div className="mt-1 text-xs text-destructive">
                            {s.lastError.slice(0, 240)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2 text-xs">
                        {s.sourceType || "unknown"}
                        {s.city ? ` · ${s.city}` : ""}
                        <div className="text-muted-foreground">
                          every {s.checkFrequencyMinutes}m · {s.fetchStrategy}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <Badge
                            variant={s.enabled ? "default" : "secondary"}
                            title={
                              glossaryDefinition(
                                "source-badges",
                                s.enabled ? "Enabled" : "Disabled",
                              ) ?? undefined
                            }
                          >
                            {s.enabled ? "Enabled" : "Disabled"}
                          </Badge>
                          <Badge
                            variant={statusVariant(s.lastStatus)}
                            title={
                              glossaryDefinition(
                                "source-badges",
                                s.lastStatus ?? "never",
                              ) ?? undefined
                            }
                          >
                            {s.lastStatus ?? "never"}
                          </Badge>
                          {isDue(s, now) ? (
                            <Badge
                              variant="outline"
                              title={glossaryDefinition("source-badges", "Due") ?? undefined}
                            >
                              Due
                            </Badge>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2 text-xs">
                        <div>{formatRelative(s.lastCheckedAt)}</div>
                        {s.lastSuccessAt ? (
                          <div className="text-muted-foreground">
                            success {formatRelative(s.lastSuccessAt)}
                          </div>
                        ) : null}
                      </td>
                      <td className="px-3 py-2">
                        <div className="flex flex-col gap-1">
                          <form action={checkSourceNowAction}>
                            <input
                              type="hidden"
                              name="sourceId"
                              value={s.id}
                            />
                            <GlossaryTitle term="Check now">
                              <button
                                type="submit"
                                className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                              >
                                Check now
                              </button>
                            </GlossaryTitle>
                          </form>
                          <form action={toggleSourceAction}>
                            <input
                              type="hidden"
                              name="sourceId"
                              value={s.id}
                            />
                            <input
                              type="hidden"
                              name="enabled"
                              value={s.enabled ? "false" : "true"}
                            />
                            <GlossaryTitle term="Disable / Enable">
                              <button
                                type="submit"
                                className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                              >
                                {s.enabled ? "Disable" : "Enable"}
                              </button>
                            </GlossaryTitle>
                          </form>
                          {monitorAvailable ? (
                            <form action={runEventMonitorAction}>
                              <input
                                type="hidden"
                                name="sourceId"
                                value={s.id}
                              />
                              <GlossaryTitle term="AI monitor">
                                <button
                                  type="submit"
                                  className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                                >
                                  AI monitor
                                </button>
                              </GlossaryTitle>
                            </form>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent source changes</CardTitle>
            <CardDescription>
              Hash changed since the last check; AI extraction enqueued automatically.
            </CardDescription>
            <GlossaryHint term="changed" className="mt-1" />
          </CardHeader>
          <CardContent className="space-y-3">
            {recentChanges.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No source changes recorded yet.
              </p>
            ) : (
              recentChanges.map((c) => (
                <div
                  key={c.id}
                  className="rounded border p-3 text-sm"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{c.source.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelative(c.createdAt)} · {c.status}
                      </div>
                    </div>
                    <form action={retryAiExtractionAction}>
                      <input
                        type="hidden"
                        name="sourceChangeId"
                        value={c.id}
                      />
                      <GlossaryTitle term="Retry AI">
                        <button
                          type="submit"
                          className="rounded-md border border-input bg-background px-2 py-1 text-xs hover:bg-accent"
                        >
                          Retry AI
                        </button>
                      </GlossaryTitle>
                    </form>
                  </div>
                  {c.changedTextExcerpt ? (
                    <p className="mt-2 line-clamp-3 text-xs text-muted-foreground">
                      {c.changedTextExcerpt}
                    </p>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Recent AI extraction jobs</CardTitle>
            <CardDescription>
              Status of the OpenAI Responses jobs the cron pipeline created.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {recentJobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                No extraction jobs yet — run discovery to enqueue one.
              </p>
            ) : (
              recentJobs.map((j) => (
                <div key={j.id} className="rounded border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">
                        {j.sourceChange.source.name}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {formatRelative(j.createdAt)}
                      </div>
                    </div>
                    <Badge
                      variant={
                        j.status === "failed" ||
                        j.status === "incomplete" ||
                        j.status === "cancelled"
                          ? "destructive"
                          : j.status === "completed"
                            ? "default"
                            : "secondary"
                      }
                    >
                      {j.status}
                    </Badge>
                  </div>
                  <div className="mt-1 text-xs text-muted-foreground">
                    Response ID: {j.openaiResponseId ?? "n/a"}
                  </div>
                  {j.errorMessage ? (
                    <div className="mt-1 text-xs text-destructive">
                      {j.errorMessage.slice(0, 240)}
                    </div>
                  ) : null}
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone = "neutral",
  definition,
}: {
  label: string;
  value: number;
  tone?: "neutral" | "warn" | "info";
  definition?: string;
}) {
  const accent =
    tone === "warn"
      ? "text-destructive"
      : tone === "info"
        ? "text-primary"
        : "";
  return (
    <div className="rounded border p-3">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </div>
      {definition ? (
        <GlossaryHint
          term={label}
          definition={definition}
          className="mb-2 mt-0.5 normal-case"
        />
      ) : null}
      <div className={`text-2xl font-semibold ${accent}`}>{value}</div>
    </div>
  );
}
