export const dynamic = "force-dynamic";

import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";

import {
  approveSourceCandidateAction,
  rejectSourceCandidateAction,
} from "@/app/admin/sacfamAgentActions";
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

function importStatusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "imported") return "default";
  if (status === "duplicate") return "outline";
  if (status === "rejected") return "destructive";
  if (status === "needs_verification") return "secondary";
  return "secondary";
}

interface PageProps {
  params: { id: string };
}

export default async function ResearchRunDetailPage({ params }: PageProps) {
  const run = await prisma.sourceResearchRun.findUnique({
    where: { id: params.id },
    include: {
      candidates: { orderBy: { deterministicScore: "desc" } },
    },
  });
  if (!run) return notFound();
  const config = readSacfamAgentConfig();
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/sources/research-runs">
            <ArrowLeft className="mr-1 h-4 w-4" />
            Back to runs
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href="/admin/sources/candidates">Open all candidates</Link>
        </Button>
      </div>

      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.08] to-background">
        <CardHeader className="space-y-2">
          <CardTitle>Run {run.id}</CardTitle>
          <CardDescription>
            {new Date(run.createdAt).toLocaleString()} · model {run.model} · prompt {run.promptVersion}
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm sm:grid-cols-4">
          <div>
            <p className="text-xs text-muted-foreground">Status</p>
            <Badge className="mt-1">{run.status}</Badge>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Requested</p>
            <p>{run.requestedSourceCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Parsed</p>
            <p>{run.parsedSourceCount}</p>
          </div>
          <div>
            <p className="text-xs text-muted-foreground">Region</p>
            <p>{run.targetRegion}</p>
          </div>
          {run.errorMessage ? (
            <div className="sm:col-span-4">
              <p className="text-xs text-muted-foreground">Error</p>
              <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-destructive/10 p-2 text-xs text-destructive">
                {run.errorMessage}
              </pre>
            </div>
          ) : null}
          {run.rawResponsePreview ? (
            <div className="sm:col-span-4">
              <p className="text-xs text-muted-foreground">Raw response preview</p>
              <pre className="mt-1 max-h-64 overflow-auto whitespace-pre-wrap rounded-lg bg-muted p-2 text-xs">
                {run.rawResponsePreview}
              </pre>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Candidates ({run.candidates.length})</CardTitle>
          <CardDescription>
            Approve to add to the operational source catalog. {config.dryRun ? "Dry-run is ON — approve will be blocked." : "Dry-run is off."}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {run.candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates were saved for this run.</p>
          ) : (
            run.candidates.map((c) => {
              const eventTypes: string[] = (() => {
                try {
                  const parsed = JSON.parse(c.eventTypesJson || "[]");
                  return Array.isArray(parsed) ? parsed.map(String) : [];
                } catch {
                  return [];
                }
              })();
              return (
                <div
                  key={c.id}
                  className="rounded-xl border border-border/70 bg-card p-4 shadow-sm transition-colors hover:bg-muted/10"
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold">{c.sourceName}</p>
                      <a
                        href={c.sourceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-1 inline-flex break-all text-xs text-primary underline"
                      >
                        {c.sourceUrl}
                        <ExternalLink className="ml-1 h-3 w-3 shrink-0" />
                      </a>
                    </div>
                    <div className="flex flex-wrap gap-1">
                      <Badge variant={importStatusVariant(c.importStatus)}>{c.importStatus}</Badge>
                      <Badge variant="outline">{c.reviewPriority} priority</Badge>
                      <Badge variant="outline">fit: {c.automationFit}</Badge>
                      <Badge variant="outline">fresh: {c.freshnessLikelihood}</Badge>
                      <Badge variant="outline">{c.verificationStatus}</Badge>
                    </div>
                  </div>
                  <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                    <p><span className="font-medium text-foreground">Category:</span> {c.sourceCategory}</p>
                    <p><span className="font-medium text-foreground">Type:</span> {c.sourceType}</p>
                    <p><span className="font-medium text-foreground">City/area:</span> {c.cityOrAreaServed ?? "—"}</p>
                    <p><span className="font-medium text-foreground">County:</span> {c.countyOrRegion ?? "—"}</p>
                    <p><span className="font-medium text-foreground">Ingestion:</span> {c.recommendedIngestionMethod}</p>
                    <p><span className="font-medium text-foreground">Update freq:</span> {c.estimatedUpdateFrequency ?? "—"}</p>
                    <p><span className="font-medium text-foreground">Model score:</span> {c.relevanceScore.toFixed(2)}</p>
                    <p><span className="font-medium text-foreground">Deterministic score:</span> {c.deterministicScore.toFixed(2)}</p>
                  </div>
                  {eventTypes.length > 0 ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      <span className="font-medium text-foreground">Event types:</span> {eventTypes.join(", ")}
                    </p>
                  ) : null}
                  {c.familyRelevance ? (
                    <p className="mt-2 text-xs">{c.familyRelevance}</p>
                  ) : null}
                  {c.whyUsefulForSacfamEvents ? (
                    <p className="mt-1 text-xs italic text-muted-foreground">
                      {c.whyUsefulForSacfamEvents}
                    </p>
                  ) : null}
                  <div className="mt-3 flex flex-wrap gap-2">
                    <form action={approveSourceCandidateAction}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <Button
                        type="submit"
                        disabled={c.importStatus === "imported" || c.importStatus === "rejected"}
                        size="sm"
                      >
                        Approve & import
                      </Button>
                    </form>
                    <form action={rejectSourceCandidateAction}>
                      <input type="hidden" name="candidateId" value={c.id} />
                      <Button
                        type="submit"
                        disabled={c.importStatus === "rejected"}
                        size="sm"
                        variant="outline"
                      >
                        Reject
                      </Button>
                    </form>
                  </div>
                </div>
              );
            })
          )}
        </CardContent>
      </Card>
    </div>
  );
}
