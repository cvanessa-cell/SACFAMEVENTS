export const dynamic = "force-dynamic";

import Link from "next/link";

import {
  approveEventCandidateAction,
  rejectEventCandidateAction,
} from "@/app/admin/sacfamAgentActions";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { readSacfamAgentConfig } from "@/lib/ai/sacfamAgentEnv";
import { prisma } from "@/lib/prisma";

const REVIEW_FILTERS = ["pending", "approved", "rejected", "duplicate", "all"] as const;
type ReviewFilter = (typeof REVIEW_FILTERS)[number];

interface PageProps {
  searchParams?: { status?: string };
}

function reviewBadgeVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "approved") return "default";
  if (s === "rejected") return "destructive";
  if (s === "duplicate") return "outline";
  return "secondary";
}

function changeTypeVariant(
  s: string,
): "default" | "secondary" | "destructive" | "outline" {
  if (s === "new_event") return "default";
  if (s === "canceled_event") return "destructive";
  if (s === "needs_manual_review") return "secondary";
  return "outline";
}

export default async function EventCandidatesPage({ searchParams }: PageProps) {
  const filter = (searchParams?.status as ReviewFilter) ?? "pending";
  const status: ReviewFilter = REVIEW_FILTERS.includes(filter) ? filter : "pending";

  const where = status === "all" ? undefined : { reviewStatus: status };
  const config = readSacfamAgentConfig();

  const [candidates, pending, approved, rejected] = await Promise.all([
    prisma.eventCandidate.findMany({
      where,
      orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
      take: 100,
    }),
    prisma.eventCandidate.count({ where: { reviewStatus: "pending" } }),
    prisma.eventCandidate.count({ where: { reviewStatus: "approved" } }),
    prisma.eventCandidate.count({ where: { reviewStatus: "rejected" } }),
  ]);

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader>
            <CardDescription>Pending review</CardDescription>
            <CardTitle className="text-3xl">{pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Approved</CardDescription>
            <CardTitle className="text-3xl">{approved}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Rejected</CardDescription>
            <CardTitle className="text-3xl">{rejected}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>AI event candidates</CardTitle>
          <CardDescription>
            Approve to promote into the FamilyEvent table for the public site.{" "}
            {config.dryRun
              ? "Dry-run is ON — approval is blocked until SACFAM_SOURCE_AGENT_DRY_RUN=false."
              : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4 flex flex-wrap gap-2 text-xs">
            {REVIEW_FILTERS.map((f) => (
              <Link
                key={f}
                href={`/admin/events/candidates?status=${f}`}
                className={`rounded-full border px-3 py-1 ${
                  status === f ? "bg-primary text-primary-foreground" : "hover:bg-muted"
                }`}
              >
                {f}
              </Link>
            ))}
          </div>

          {candidates.length === 0 ? (
            <p className="text-sm text-muted-foreground">No candidates with this status.</p>
          ) : (
            <div className="space-y-3">
              {candidates.map((c) => {
                const missingFields: string[] = (() => {
                  try {
                    const parsed = JSON.parse(c.missingFieldsJson || "[]");
                    return Array.isArray(parsed) ? parsed.map(String) : [];
                  } catch {
                    return [];
                  }
                })();
                return (
                  <div key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-semibold">{c.eventTitle}</p>
                        <p className="text-xs text-muted-foreground">
                          {c.sourceName}
                          {c.eventUrl ? (
                            <>
                              {" · "}
                              <a
                                href={c.eventUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary underline"
                              >
                                event link
                              </a>
                            </>
                          ) : null}
                        </p>
                      </div>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={reviewBadgeVariant(c.reviewStatus)}>
                          {c.reviewStatus}
                        </Badge>
                        <Badge variant={changeTypeVariant(c.changeType)}>
                          {c.changeType}
                        </Badge>
                        <Badge variant="outline">cal: {c.calendarReady}</Badge>
                        <Badge variant="outline">
                          conf {c.confidenceScore.toFixed(2)}
                        </Badge>
                        {c.adminReviewRequired ? (
                          <Badge variant="secondary">admin review</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="mt-2 grid gap-1 text-xs text-muted-foreground sm:grid-cols-2">
                      <p>
                        <span className="font-medium text-foreground">When:</span>{" "}
                        {c.eventDate ?? "—"} {c.eventStartTime ?? ""}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Where:</span>{" "}
                        {[c.locationName, c.city, c.countyOrRegion].filter(Boolean).join(", ") || "—"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Audience:</span>{" "}
                        {c.familyAgeRange ?? "—"}
                      </p>
                      <p>
                        <span className="font-medium text-foreground">Cost:</span>{" "}
                        {c.cost ?? "—"}
                      </p>
                    </div>
                    {c.descriptionSummary ? (
                      <p className="mt-2 text-sm">{c.descriptionSummary}</p>
                    ) : null}
                    {c.whyRelevantForFamilies ? (
                      <p className="mt-1 text-xs italic text-muted-foreground">
                        {c.whyRelevantForFamilies}
                      </p>
                    ) : null}
                    {missingFields.length > 0 ? (
                      <p className="mt-2 text-xs text-destructive">
                        Missing: {missingFields.join(", ")}
                      </p>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={approveEventCandidateAction}>
                        <input type="hidden" name="candidateId" value={c.id} />
                        <button
                          type="submit"
                          disabled={c.reviewStatus === "approved" || c.reviewStatus === "rejected"}
                          className="rounded-md border bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Approve & promote
                        </button>
                      </form>
                      <form action={rejectEventCandidateAction}>
                        <input type="hidden" name="candidateId" value={c.id} />
                        <button
                          type="submit"
                          disabled={c.reviewStatus === "rejected"}
                          className="rounded-md border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Reject
                        </button>
                      </form>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
