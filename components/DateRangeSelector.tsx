"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import type { PeriodPreset } from "@/lib/dateRangePresets";

const PRESETS: { id: PeriodPreset; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "tomorrow", label: "Tomorrow" },
  { id: "this_weekend", label: "This weekend" },
  { id: "this_week", label: "This week" },
  { id: "next_week", label: "Next week" },
  { id: "this_month", label: "This month" },
  { id: "custom", label: "Custom" },
];

export interface DateRangeSelectorProps {
  preset: PeriodPreset;
  onPresetChange: (p: PeriodPreset) => void;
  customStart: string;
  customEnd: string;
  onCustomStartChange: (v: string) => void;
  onCustomEndChange: (v: string) => void;
}

export function DateRangeSelector({
  preset,
  onPresetChange,
  customStart,
  customEnd,
  onCustomStartChange,
  onCustomEndChange,
}: DateRangeSelectorProps) {
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {PRESETS.map((p) => (
          <Button
            key={p.id}
            type="button"
            size="sm"
            variant={preset === p.id ? "default" : "outline"}
            onClick={() => onPresetChange(p.id)}
          >
            {p.label}
          </Button>
        ))}
      </div>
      {preset === "custom" && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="custom-start">Start date</Label>
            <Input
              id="custom-start"
              type="date"
              value={customStart}
              onChange={(e) => onCustomStartChange(e.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="custom-end">End date</Label>
            <Input
              id="custom-end"
              type="date"
              value={customEnd}
              onChange={(e) => onCustomEndChange(e.target.value)}
            />
          </div>
        </div>
      )}
    </div>
  );
}
