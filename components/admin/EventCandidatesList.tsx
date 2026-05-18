"use client";

import {
  approveEventCandidateAction,
  bulkApproveEventCandidatesAction,
  bulkRejectEventCandidatesAction,
  rejectEventCandidateAction,
} from "@/app/admin/sacfamAgentActions";
import { BulkReviewBar } from "@/components/admin/BulkReviewBar";
import { useBulkSelection } from "@/components/admin/useBulkSelection";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";

export interface EventCandidateItem {
  id: string;
  eventTitle: string;
  sourceName: string;
  eventUrl?: string | null;
  reviewStatus: string;
  changeType: string;
  calendarReady: string;
  confidenceScore: number;
  adminReviewRequired: boolean;
  eventDate?: string | null;
  eventStartTime?: string | null;
  locationName?: string | null;
  city?: string | null;
  countyOrRegion?: string | null;
  familyAgeRange?: string | null;
  cost?: string | null;
  descriptionSummary?: string | null;
  whyRelevantForFamilies?: string | null;
  missingFields: string[];
  canApprove: boolean;
  canReject: boolean;
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

interface EventCandidatesListProps {
  candidates: EventCandidateItem[];
  dryRun: boolean;
}

export function EventCandidatesList({ candidates, dryRun }: EventCandidatesListProps) {
  const items = candidates.map((c) => ({
    id: c.id,
    canApprove: c.canApprove,
    canReject: c.canReject,
  }));

  const {
    selectableIds,
    approvableSelectedIds,
    rejectableSelectedIds,
    allSelectableSelected,
    someSelectableSelected,
    toggleOne,
    toggleSelectAll,
    isSelected,
    selectedIds,
  } = useBulkSelection(items);

  if (candidates.length === 0) {
    return <p className="text-sm text-muted-foreground">No candidates with this status.</p>;
  }

  return (
  <div className="space-y-3">
      <BulkReviewBar
        selectableCount={selectableIds.length}
        selectedCount={selectedIds.size}
        approvableCount={approvableSelectedIds.length}
        rejectableCount={rejectableSelectedIds.length}
        allSelected={allSelectableSelected}
        someSelected={someSelectableSelected}
        dryRunBlocksApprove={dryRun}
        onToggleSelectAll={toggleSelectAll}
        approveAction={bulkApproveEventCandidatesAction}
        rejectAction={bulkRejectEventCandidatesAction}
        approvableIds={approvableSelectedIds}
        rejectableIds={rejectableSelectedIds}
      />

      {candidates.map((c) => {
        const selectable = c.canApprove || c.canReject;
        return (
          <div key={c.id} className="rounded-lg border bg-card p-4 shadow-sm">
            <div className="flex flex-wrap items-start gap-3">
              {selectable ? (
                <Checkbox
                  checked={isSelected(c.id)}
                  onCheckedChange={() => toggleOne(c.id)}
                  aria-label={`Select ${c.eventTitle}`}
                  className="mt-1"
                />
              ) : (
                <span className="w-4" />
              )}
              <div className="min-w-0 flex-1">
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
                    <Badge variant={reviewBadgeVariant(c.reviewStatus)}>{c.reviewStatus}</Badge>
                    <Badge variant={changeTypeVariant(c.changeType)}>{c.changeType}</Badge>
                    <Badge variant="outline">cal: {c.calendarReady}</Badge>
                    <Badge variant="outline">conf {c.confidenceScore.toFixed(2)}</Badge>
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
                    <span className="font-medium text-foreground">Cost:</span> {c.cost ?? "—"}
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
                {c.missingFields.length > 0 ? (
                  <p className="mt-2 text-xs text-destructive">
                    Missing: {c.missingFields.join(", ")}
                  </p>
                ) : null}
                <div className="mt-3 flex flex-wrap gap-2">
                  <form action={approveEventCandidateAction}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button
                      type="submit"
                      disabled={!c.canApprove}
                      className="rounded-md border bg-primary px-3 py-1 text-xs font-medium text-primary-foreground disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Approve & promote
                    </button>
                  </form>
                  <form action={rejectEventCandidateAction}>
                    <input type="hidden" name="candidateId" value={c.id} />
                    <button
                      type="submit"
                      disabled={!c.canReject}
                      className="rounded-md border px-3 py-1 text-xs font-medium disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Reject
                    </button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}


