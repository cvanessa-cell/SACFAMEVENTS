export const dynamic = "force-dynamic";

import Link from "next/link";
import { ArrowUpRight, Bot, CheckCircle2, Clock3, Sparkles } from "lucide-react";

import { OpenInAirtableLinks } from "@/components/admin/OpenInAirtableLinks";
import { runSourceResearchAction } from "@/app/admin/sacfamAgentActions";
import { RunSourceResearchForm } from "@/app/admin/sources/research/RunSourceResearchForm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { readSacfamAgentConfig } from "@/lib/ai/sacfamAgentEnv";
import { prisma } from "@/lib/prisma";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "secondary";
  return "outline";
}

function formatRelative(date: Date | null): string {
  if (!date) return "—";
  const diffMs = Date.now() - date.getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 48) return `${hr}h ago`;
  const days = Math.round(hr / 24);
  return `${days}d ago`;
}

export default async function SourceResearchPage() {
  const config = readSacfamAgentConfig();
  const disabledReason = !config.sourceAgentEnabled
    ? "Source research is disabled (SACFAM_AI_SOURCE_AGENT_ENABLED=false)."
    : !config.hasOpenAiKey
      ? "OPENAI_API_KEY is not configured."
      : null;

  const [recentRuns, totalCandidates, pendingCandidates, importedCount, activeRun] = await Promise.all(
    [
      prisma.sourceResearchRun.findMany({
        orderBy: { createdAt: "desc" },
        take: 10,
        include: { _count: { select: { candidates: true } } },
      }),
      prisma.sourceResearchCandidate.count(),
      prisma.sourceResearchCandidate.count({ where: { importStatus: "pending_review" } }),
      prisma.sourceResearchCandidate.count({ where: { importStatus: "imported" } }),
      prisma.sourceResearchRun.findFirst({
        where: { status: "running" },
        orderBy: { createdAt: "desc" },
      }),
    ],
  );

  return (
    <div className="space-y-8">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] via-background to-background">
        <CardHeader className="space-y-4 pb-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
                <Sparkles className="h-3.5 w-3.5" />
                AI Source Discovery
              </div>
              <CardTitle className="text-2xl sm:text-3xl">Research New Family Event Sources</CardTitle>
              <CardDescription className="max-w-2xl text-sm sm:text-base">
                Use the SacFam AI agent to find high-value local source candidates. Sources scoring
                above 0.5 are auto-approved into the Airtable catalog and operational event-source
                table after each run (when dry-run is off).
              </CardDescription>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <OpenInAirtableLinks table="sourceResearchRuns" showInterface />
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/sources/candidates">
                  Review candidates
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
              <Button asChild variant="outline" size="sm">
                <Link href="/admin/sources/research-runs">
                  Run history
                  <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                </Link>
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Feature flag</p>
              <Badge variant={config.sourceAgentEnabled ? "default" : "secondary"} className="mt-1">
                {config.sourceAgentEnabled ? "enabled" : "disabled"}
              </Badge>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Model</p>
              <p className="mt-1 font-mono text-sm">{config.model}</p>
            </div>
            <div className="rounded-lg border border-border/60 bg-background/80 p-3">
              <p className="text-xs text-muted-foreground">Dry-run</p>
              <Badge variant={config.dryRun ? "outline" : "default"} className="mt-1">
                {config.dryRun ? "on (no auto-import)" : "off"}
              </Badge>
            </div>
          </div>

          {disabledReason ? (
            <p className="rounded-lg border border-dashed border-muted-foreground/30 bg-muted/40 p-3 text-sm text-muted-foreground">
              {disabledReason}
            </p>
          ) : (
            <RunSourceResearchForm
              action={runSourceResearchAction}
              maxSources={config.maxSources}
              defaultSourceCount={Math.min(50, config.maxSources)}
              defaultTargetRegion="Sacramento / Placer"
            />
          )}
        </CardContent>
      </Card>

      {activeRun ? (
        <Card className="border-primary/30 bg-primary/5 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <span className="inline-flex h-2 w-2 animate-pulse rounded-full bg-primary" />
              Source research is currently running
            </CardTitle>
            <CardDescription>
              Started {formatRelative(activeRun.startedAt ?? activeRun.createdAt)}. You can leave this
              page and come back.
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-0">
            <Button asChild size="sm" variant="outline">
              <Link href={`/admin/sources/research-runs/${activeRun.id}`}>Open active run details</Link>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-3">
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <Bot className="h-4 w-4" />
              Total candidates
            </CardDescription>
            <CardTitle className="text-3xl">{totalCandidates}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <Clock3 className="h-4 w-4" />
              Pending review
            </CardDescription>
            <CardTitle className="text-3xl">{pendingCandidates}</CardTitle>
          </CardHeader>
        </Card>
        <Card className="shadow-sm">
          <CardHeader className="space-y-1">
            <CardDescription className="flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4" />
              Imported into catalog
            </CardDescription>
            <CardTitle className="text-3xl">{importedCount}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card className="shadow-sm">
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle>Recent research runs</CardTitle>
          <Button asChild variant="ghost" size="sm">
            <Link href="/admin/sources/research-runs">View all runs</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recentRuns.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Started</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Requested</th>
                    <th className="px-3 py-2.5">Parsed</th>
                    <th className="px-3 py-2.5">Candidates</th>
                    <th className="px-3 py-2.5">Model</th>
                    <th className="px-3 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {recentRuns.map((r) => (
                    <tr key={r.id} className="border-b transition-colors hover:bg-muted/20 last:border-b-0">
                      <td className="px-3 py-2.5">{formatRelative(r.startedAt ?? r.createdAt)}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5">{r.requestedSourceCount}</td>
                      <td className="px-3 py-2.5">{r.parsedSourceCount}</td>
                      <td className="px-3 py-2.5">{r._count.candidates}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.model}</td>
                      <td className="px-3 py-2.5">
                        <Button asChild variant="ghost" size="sm" className="h-auto p-0 text-primary underline-offset-4 hover:text-primary hover:underline">
                          <Link href={`/admin/sources/research-runs/${r.id}`}>View details</Link>
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
