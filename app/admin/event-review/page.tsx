import { prisma } from "@/lib/prisma";

export default async function EventReviewPage() {
  const events = await prisma.familyEvent.findMany({
    where: { status: { in: ["needs_review", "approved", "duplicate"] } },
    orderBy: { updatedAt: "desc" },
    include: { source: true },
    take: 100,
  });

  return (
    <div className="space-y-4">
      <h1 className="text-3xl font-semibold">Event Review Queue</h1>
      <p className="text-sm text-muted-foreground">
        Approve/reject manually; uncertain extractions should stay in needs_review.
      </p>
      {events.map((e) => (
        <div key={e.id} className="rounded border p-3 text-sm">
          <div className="font-medium">{e.title}</div>
          <div>Status: {e.status}</div>
          <div>Source: {e.source?.name ?? "n/a"}</div>
          <div>Confidence: {e.confidence ?? "n/a"}</div>
          <div className="mt-2 flex gap-2">
            <form action={`/api/admin/events/${e.id}/review`} method="post">
              <input type="hidden" name="status" value="approved" />
              <button className="rounded border px-2 py-1" type="submit">Approve</button>
            </form>
            <form action={`/api/admin/events/${e.id}/review`} method="post">
              <input type="hidden" name="status" value="rejected" />
              <button className="rounded border px-2 py-1" type="submit">Reject</button>
            </form>
            <form action={`/api/admin/events/${e.id}/review`} method="post">
              <input type="hidden" name="status" value="duplicate" />
              <button className="rounded border px-2 py-1" type="submit">Mark duplicate</button>
            </form>
          </div>
          <div className="mt-2 text-xs text-muted-foreground">
            Export approved to Google Calendar: placeholder. Send to Airtable: placeholder.
          </div>
        </div>
      ))}
    </div>
  );
}
