"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";

interface BulkReviewBarProps {
  selectableCount: number;
  selectedCount: number;
  approvableCount: number;
  rejectableCount: number;
  allSelected: boolean;
  someSelected: boolean;
  dryRunBlocksApprove?: boolean;
  onToggleSelectAll: () => void;
  approveAction: (formData: FormData) => void | Promise<void>;
  rejectAction: (formData: FormData) => void | Promise<void>;
  approvableIds: string[];
  rejectableIds: string[];
}

function BulkSubmitButton({
  label,
  variant = "default",
  disabled,
}: {
  label: string;
  variant?: "default" | "outline" | "secondary" | "ghost";
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <Button type="submit" size="sm" variant={variant} disabled={disabled || pending}>
      {pending ? "Working…" : label}
    </Button>
  );
}

export function BulkReviewBar({
  selectableCount,
  selectedCount,
  approvableCount,
  rejectableCount,
  allSelected,
  someSelected,
  dryRunBlocksApprove,
  onToggleSelectAll,
  approveAction,
  rejectAction,
  approvableIds,
  rejectableIds,
}: BulkReviewBarProps) {
  if (selectableCount === 0) return null;

  return (
    <div className="mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-border/60 bg-muted/30 px-3 py-2">
      <label className="flex cursor-pointer items-center gap-2 text-sm">
        <Checkbox
          checked={allSelected ? true : someSelected ? "indeterminate" : false}
          onCheckedChange={onToggleSelectAll}
          aria-label="Select all"
        />
        <span>
          Select all
          <span className="ml-1 text-muted-foreground">({selectableCount})</span>
        </span>
      </label>

      {selectedCount > 0 ? (
        <span className="text-xs text-muted-foreground">{selectedCount} selected</span>
      ) : null}

      <form action={approveAction} className="inline-flex">
        {approvableIds.map((id) => (
          <input key={id} type="hidden" name="candidateIds" value={id} />
        ))}
        <BulkSubmitButton
          label={`Approve selected (${approvableCount})`}
          disabled={approvableCount === 0 || dryRunBlocksApprove}
        />
      </form>

      <form action={rejectAction} className="inline-flex">
        {rejectableIds.map((id) => (
          <input key={id} type="hidden" name="candidateIds" value={id} />
        ))}
        <BulkSubmitButton
          label={`Reject selected (${rejectableCount})`}
          variant="outline"
          disabled={rejectableCount === 0}
        />
      </form>

      {dryRunBlocksApprove ? (
        <span className="text-xs text-muted-foreground">Dry-run blocks bulk approve</span>
      ) : null}
    </div>
  );
}


