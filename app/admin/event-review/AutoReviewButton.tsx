"use client";

import { useState } from "react";

import { runAutoReviewAction } from "@/app/admin/actions";

export function AutoReviewButton({
  needsReviewCount,
}: {
  needsReviewCount: number;
}) {
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<{
    processed: number;
    approved: number;
    rejected: number;
  } | null>(null);

  if (needsReviewCount === 0) return null;

  async function handleClick() {
    setPending(true);
    setResult(null);
    try {
      const r = await runAutoReviewAction();
      setResult(r);
    } finally {
      setPending(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        onClick={handleClick}
        disabled={pending}
        className="h-9 rounded-md border border-blue-300 bg-blue-50 px-4 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-50"
      >
        {pending ? "Reviewing…" : `Auto-Review ${needsReviewCount} Events`}
      </button>
      {result && (
        <span className="text-sm text-muted-foreground">
          {result.approved} approved, {result.rejected} rejected
        </span>
      )}
    </div>
  );
}
