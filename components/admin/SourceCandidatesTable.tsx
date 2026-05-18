"use client";

import {
  approveSourceCandidateAction,
  bulkApproveSourceCandidatesAction,
  bulkRejectSourceCandidatesAction,
  rejectSourceCandidateAction,
} from "@/app/admin/sacfamAgentActions";
import { BulkReviewBar } from "@/components/admin/BulkReviewBar";
import { useBulkSelection } from "@/components/admin/useBulkSelection";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

export interface SourceCandidateRow {
  recordId: string;
  candidateId: string | null;
  sourceName: string;
  notes?: string;
  websiteUrl?: string;
  sourceCategory?: string;
  cityOrArea?: string;
  eventTypes?: string;
  automationFit?: string;
  reviewPriority?: string;
  relevanceScore?: number;
  importStatus?: string;
  verificationStatus?: string;
  isDuplicate: boolean;
  canApprove: boolean;
  canReject: boolean;
}

function statusVariant(status?: string): "default" | "secondary" | "destructive" | "outline" {
  if (status === "pending_review") return "default";
  if (status === "imported") return "secondary";
  if (status === "rejected" || status === "duplicate") return "destructive";
  return "outline";
}

interface SourceCandidatesTableProps {
  rows: SourceCandidateRow[];
  dryRun: boolean;
}

export function SourceCandidatesTable({ rows, dryRun }: SourceCandidatesTableProps) {
  const items = rows
    .filter((row) => row.candidateId)
    .map((row) => ({
      id: row.candidateId as string,
      canApprove: row.canApprove,
      canReject: row.canReject,
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

  return (
    <>
      <BulkReviewBar
        selectableCount={selectableIds.length}
        selectedCount={selectedIds.size}
        approvableCount={approvableSelectedIds.length}
        rejectableCount={rejectableSelectedIds.length}
        allSelected={allSelectableSelected}
        someSelected={someSelectableSelected}
        dryRunBlocksApprove={dryRun}
        onToggleSelectAll={toggleSelectAll}
        approveAction={bulkApproveSourceCandidatesAction}
        rejectAction={bulkRejectSourceCandidatesAction}
        approvableIds={approvableSelectedIds}
        rejectableIds={rejectableSelectedIds}
      />

      <div className="overflow-x-auto rounded-xl border border-border/60">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-muted/40 text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="w-10 px-3 py-2.5" aria-label="Select" />
              <th className="px-3 py-2.5">Source</th>
              <th className="px-3 py-2.5">Category</th>
              <th className="px-3 py-2.5">Area</th>
              <th className="px-3 py-2.5">Event types</th>
              <th className="px-3 py-2.5">Fit</th>
              <th className="px-3 py-2.5">Priority</th>
              <th className="px-3 py-2.5">Score</th>
              <th className="px-3 py-2.5">Status</th>
              <th className="px-3 py-2.5">Actions</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selectable = row.canApprove || row.canReject;
              return (
                <tr
                  key={row.recordId}
                  className="border-b align-top transition-colors hover:bg-muted/20 last:border-b-0"
                >
                  <td className="px-3 py-2.5">
                    {row.candidateId && selectable ? (
                      <Checkbox
                        checked={isSelected(row.candidateId)}
                        onCheckedChange={() => toggleOne(row.candidateId!)}
                        aria-label={`Select ${row.sourceName}`}
                      />
                    ) : null}
                  </td>
                  <td className="max-w-xs px-3 py-2.5">
                    <p className="font-medium">{row.sourceName}</p>
                    {row.notes ? (
                      <p className="text-xs text-muted-foreground">{row.notes}</p>
                    ) : null}
                    {row.websiteUrl ? (
                      <a
                        href={row.websiteUrl}
                        className="text-xs text-primary underline"
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open Source URL
                      </a>
                    ) : null}
                  </td>
                  <td className="px-3 py-2.5">{row.sourceCategory}</td>
                  <td className="px-3 py-2.5">{row.cityOrArea}</td>
                  <td className="max-w-xs px-3 py-2.5">{row.eventTypes}</td>
                  <td className="px-3 py-2.5">{row.automationFit}</td>
                  <td className="px-3 py-2.5">{row.reviewPriority}</td>
                  <td className="px-3 py-2.5">{row.relevanceScore}</td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-1">
                      <Badge variant={statusVariant(row.importStatus)}>{row.importStatus}</Badge>
                      {row.isDuplicate ? (
                        <span className="text-[11px] font-medium text-destructive">
                          duplicate match
                        </span>
                      ) : null}
                      <span className="text-xs text-muted-foreground">
                        {row.verificationStatus}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2.5">
                    <div className="flex flex-col gap-2">
                      <form action={approveSourceCandidateAction}>
                        <input type="hidden" name="candidateId" value={row.candidateId ?? ""} />
                        <Button type="submit" size="sm" disabled={!row.canApprove}>
                          Approve
                        </Button>
                      </form>
                      <form action={rejectSourceCandidateAction}>
                        <input type="hidden" name="candidateId" value={row.candidateId ?? ""} />
                        <Button
                          type="submit"
                          size="sm"
                          variant="outline"
                          disabled={!row.canReject}
                        >
                          Reject
                        </Button>
                      </form>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

