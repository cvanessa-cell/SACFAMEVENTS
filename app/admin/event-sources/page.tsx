export const dynamic = "force-dynamic";

import { prisma } from "@/lib/prisma";

export default async function EventSourcesAdminPage() {
  const [sources, changes, jobs] = await Promise.all([
    prisma.eventSource.findMany({ orderBy: [{ enabled: "desc" }, { updatedAt: "desc" }] }),
    prisma.sourceChange.findMany({ orderBy: { createdAt: "desc" }, take: 20, include: { source: true } }),
    prisma.aiEventExtractionJob.findMany({
      orderBy: { createdAt: "desc" },
      take: 20,
      include: { sourceChange: { include: { source: true } } },
    }),
  ]);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-semibold">Event Sources Admin</h1>
      <p className="text-sm text-muted-foreground">Use check-now for manual pulls and retry AI for failed/incomplete jobs.</p>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Sources</h2>
        {sources.map((s) => (
          <div key={s.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{s.name}</div>
            <div>{s.sourceUrl}</div>
            <div>Enabled: {String(s.enabled)} · Last status: {s.lastStatus ?? "never checked"}</div>
            <div>Last checked: {s.lastCheckedAt?.toISOString() ?? "never"}</div>
            <form action={`/api/admin/event-sources/${s.id}/check-now`} method="post">
              <button className="mt-2 rounded border px-2 py-1" type="submit">Check now</button>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Recent Source Changes</h2>
        {changes.map((c) => (
          <div key={c.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{c.source.name}</div>
            <div>Status: {c.status}</div>
            <div>Created: {c.createdAt.toISOString()}</div>
            <form action={`/api/admin/source-changes/${c.id}/retry-ai`} method="post">
              <button className="mt-2 rounded border px-2 py-1" type="submit">Retry AI extraction</button>
            </form>
          </div>
        ))}
      </section>

      <section className="space-y-2">
        <h2 className="text-xl font-medium">Recent AI Jobs</h2>
        {jobs.map((j) => (
          <div key={j.id} className="rounded border p-3 text-sm">
            <div className="font-medium">{j.sourceChange.source.name}</div>
            <div>Status: {j.status}</div>
            <div>Response ID: {j.openaiResponseId ?? "n/a"}</div>
          </div>
        ))}
      </section>
    </div>
  );
}
