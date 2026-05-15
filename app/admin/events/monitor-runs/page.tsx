export const dynamic = "force-dynamic";

import { Badge } from "@/components/ui/badge";
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

export default async function MonitorRunsPage() {
  const runs = await prisma.eventMonitorRun.findMany({
    orderBy: { createdAt: "desc" },
    take: 100,
    include: { _count: { select: { candidates: true } } },
  });
  const sourceIds = Array.from(
    new Set(runs.map((r) => r.sourceId).filter((s): s is string => Boolean(s))),
  );
  const sources = sourceIds.length
    ? await prisma.eventSource.findMany({
        where: { id: { in: sourceIds } },
        select: { id: true, name: true },
      })
    : [];
  const sourceById = new Map(sources.map((s) => [s.id, s.name]));

  return (
    <Card>
      <CardHeader>
        <CardTitle>Event monitor runs</CardTitle>
        <CardDescription>
          Audit trail of admin-triggered AI event monitor runs. Candidates from each run
          appear in the AI event candidates queue.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {runs.length === 0 ? (
          <p className="text-sm text-muted-foreground">No monitor runs yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs uppercase tracking-wide text-muted-foreground">
                  <th className="py-2">Created</th>
                  <th className="py-2">Status</th>
                  <th className="py-2">Source</th>
                  <th className="py-2">New</th>
                  <th className="py-2">Updated</th>
                  <th className="py-2">Needs review</th>
                  <th className="py-2">Candidates</th>
                  <th className="py-2">Error</th>
                </tr>
              </thead>
              <tbody>
                {runs.map((r) => (
                  <tr key={r.id} className="border-b last:border-b-0">
                    <td className="py-2">{new Date(r.createdAt).toLocaleString()}</td>
                    <td className="py-2">
                      <Badge variant={statusVariant(r.status)}>{r.status}</Badge>
                    </td>
                    <td className="py-2">
                      {r.sourceId ? sourceById.get(r.sourceId) ?? r.sourceId : "—"}
                    </td>
                    <td className="py-2">{r.newEventsFound}</td>
                    <td className="py-2">{r.updatedEventsFound}</td>
                    <td className="py-2">{r.eventsNeedingReview}</td>
                    <td className="py-2">{r._count.candidates}</td>
                    <td className="py-2 max-w-md truncate text-xs text-destructive">
                      {r.errorMessage ?? ""}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
