"use client";

import { useFormStatus } from "react-dom";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface RunSourceResearchFormProps {
  action: (formData: FormData) => void | Promise<void>;
  maxSources: number;
  defaultSourceCount: number;
  defaultTargetRegion: string;
}

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <div className="flex min-w-[220px] flex-col gap-2">
      <Button type="submit" disabled={pending} className="w-full sm:self-end">
        <span
          aria-hidden
          className={cn(
            "mr-2 inline-block h-3.5 w-3.5 rounded-full border-2 border-current border-r-transparent",
            pending ? "animate-spin" : "hidden",
          )}
        />
        {pending ? "Running AI source research..." : "Run AI source research"}
      </Button>
      {pending ? (
        <p className="text-xs text-muted-foreground">
          Run started. This can take 30-90 seconds.
        </p>
      ) : null}
    </div>
  );
}

export function RunSourceResearchForm({
  action,
  maxSources,
  defaultSourceCount,
  defaultTargetRegion,
}: RunSourceResearchFormProps) {
  return (
    <form
      action={action}
      className="rounded-xl border border-border/60 bg-muted/30 p-4 shadow-sm backdrop-blur sm:p-5"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="requestedSourceCount">
          Requested source count (1–{maxSources})
        </label>
        <Input
          id="requestedSourceCount"
          name="requestedSourceCount"
          type="number"
          min={1}
          max={maxSources}
          defaultValue={defaultSourceCount}
        />
      </div>
      <div className="flex-1 space-y-1">
        <label className="text-xs font-medium text-muted-foreground" htmlFor="targetRegion">
          Target region (optional)
        </label>
        <Input id="targetRegion" name="targetRegion" defaultValue={defaultTargetRegion} />
      </div>
      <SubmitButton />
      </div>
      <p className="mt-3 text-xs text-muted-foreground">
        Runs save candidate sources for admin review only. No auto-import happens here.
      </p>
    </form>
  );
}
