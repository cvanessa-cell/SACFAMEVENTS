export const dynamic = "force-dynamic";

import Link from "next/link";

import { EventCandidatesList } from "@/components/admin/EventCandidatesList";
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
            Approve to promote into the FamilyEvent table for the public site. Use Select all to
            approve or reject multiple candidates at once.{" "}
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

          <EventCandidatesList
            dryRun={config.dryRun}
            candidates={candidates.map((c) => {
              const missingFields: string[] = (() => {
                try {
                  const parsed = JSON.parse(c.missingFieldsJson || "[]");
                  return Array.isArray(parsed) ? parsed.map(String) : [];
                } catch {
                  return [];
                }
              })();
              return {
                id: c.id,
                eventTitle: c.eventTitle,
                sourceName: c.sourceName,
                eventUrl: c.eventUrl,
                reviewStatus: c.reviewStatus,
                changeType: c.changeType,
                calendarReady: c.calendarReady,
                confidenceScore: c.confidenceScore,
                adminReviewRequired: c.adminReviewRequired,
                eventDate: c.eventDate,
                eventStartTime: c.eventStartTime,
                locationName: c.locationName,
                city: c.city,
                countyOrRegion: c.countyOrRegion,
                familyAgeRange: c.familyAgeRange,
                cost: c.cost,
                descriptionSummary: c.descriptionSummary,
                whyRelevantForFamilies: c.whyRelevantForFamilies,
                missingFields,
                canApprove:
                  c.reviewStatus !== "approved" &&
                  c.reviewStatus !== "rejected" &&
                  !config.dryRun,
                canReject: c.reviewStatus !== "rejected",
              };
            })}
          />
        </CardContent>
      </Card>
    </div>
  );
}




