export const dynamic = "force-dynamic";

import Link from "next/link";
import { Activity, CheckCircle2, Clock3, XCircle } from "lucide-react";

import { OpenInAirtableLinks } from "@/components/admin/OpenInAirtableLinks";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { prisma } from "@/lib/prisma";

function statusVariant(
  status: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (status === "completed") return "default";
  if (status === "failed") return "destructive";
  if (status === "running") return "secondary";
  return "outline";
}

export default async function ResearchRunsPage() {
  const runs = await prisma.sourceResearchRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { candidates: true } } },
  });
  const runningCount = runs.filter((run) => run.status === "running").length;
  const completedCount = runs.filter((run) => run.status === "completed").length;
  const failedCount = runs.filter((run) => run.status === "failed").length;
  const pendingCount = runs.filter((run) => run.status === "pending").length;

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.07] to-background">
        <CardHeader>
          <CardTitle className="text-2xl">Source research runs</CardTitle>
          <CardDescription>Audit trail of every AI source-research invocation.</CardDescription>
          <OpenInAirtableLinks table="sourceResearchRuns" showInterface />
        </CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Activity className="h-4 w-4" />
              Running
            </p>
            <p className="mt-1 text-2xl font-semibold">{runningCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <CheckCircle2 className="h-4 w-4" />
              Completed
            </p>
            <p className="mt-1 text-2xl font-semibold">{completedCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <XCircle className="h-4 w-4" />
              Failed
            </p>
            <p className="mt-1 text-2xl font-semibold">{failedCount}</p>
          </div>
          <div className="rounded-lg border border-border/60 bg-background/80 p-3">
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Clock3 className="h-4 w-4" />
              Pending
            </p>
            <p className="mt-1 text-2xl font-semibold">{pendingCount}</p>
          </div>
        </CardContent>
      </Card>

      <Card className="shadow-sm">
        <CardHeader>
          <CardTitle>Run history ({runs.length})</CardTitle>
          <CardDescription>Sorted by most recent run first.</CardDescription>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <p className="text-sm text-muted-foreground">No runs yet.</p>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-border/60">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
                    <th className="px-3 py-2.5">Created</th>
                    <th className="px-3 py-2.5">Status</th>
                    <th className="px-3 py-2.5">Region</th>
                    <th className="px-3 py-2.5">Requested</th>
                    <th className="px-3 py-2.5">Parsed</th>
                    <th className="px-3 py-2.5">Candidates</th>
                    <th className="px-3 py-2.5">Prompt</th>
                    <th className="px-3 py-2.5">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {runs.map((r) => (
                    <tr key={r.id} className="border-b transition-colors hover:bg-muted/20 last:border-b-0">
                      <td className="px-3 py-2.5">{new Date(r.createdAt).toLocaleString()}</td>
                      <td className="px-3 py-2.5">
                        <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                      </td>
                      <td className="px-3 py-2.5">{r.targetRegion}</td>
                      <td className="px-3 py-2.5">{r.requestedSourceCount}</td>
                      <td className="px-3 py-2.5">{r.parsedSourceCount}</td>
                      <td className="px-3 py-2.5">{r._count.candidates}</td>
                      <td className="px-3 py-2.5 font-mono text-xs">{r.promptVersion}</td>
                      <td className="px-3 py-2.5">
                        <Button asChild variant="ghost" size="sm" className="h-auto p-0 text-primary underline-offset-4 hover:text-primary hover:underline">
                          <Link href={`/admin/sources/research-runs/${r.id}`}>Open run</Link>
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
