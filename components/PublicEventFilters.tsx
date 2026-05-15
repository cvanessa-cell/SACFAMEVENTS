"use client";

import { Search, SlidersHorizontal, X } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type DatePreset =
  | "all"
  | "today"
  | "tomorrow"
  | "this_weekend"
  | "this_week"
  | "this_month";

export interface PublicFilters {
  search: string;
  city: string;
  category: string;
  freeOnly: boolean;
  datePreset: DatePreset;
}

export const DEFAULT_FILTERS: PublicFilters = {
  search: "",
  city: "",
  category: "",
  freeOnly: false,
  datePreset: "all",
};

const DATE_PRESETS: { value: DatePreset; label: string }[] = [
  { value: "all", label: "Next 2 weeks" },
  { value: "today", label: "Today" },
  { value: "tomorrow", label: "Tomorrow" },
  { value: "this_weekend", label: "This weekend" },
  { value: "this_week", label: "This week" },
  { value: "this_month", label: "This month" },
];

const selectClass =
  "flex h-10 min-w-[140px] rounded-md border border-input bg-background px-3 py-2 text-sm text-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

interface PublicEventFiltersProps {
  filters: PublicFilters;
  onChange: (filters: PublicFilters) => void;
  cities: string[];
  categories: string[];
}

export function PublicEventFilters({
  filters,
  onChange,
  cities,
  categories,
}: PublicEventFiltersProps) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const activeCount = [
    filters.search,
    filters.city,
    filters.category,
    filters.freeOnly,
  ].filter(Boolean).length;

  const update = (patch: Partial<PublicFilters>) => onChange({ ...filters, ...patch });

  const clearAll = () => onChange({ ...DEFAULT_FILTERS, datePreset: filters.datePreset });

  return (
    <Card className="border-border/60 bg-background/60 shadow-none">
      <CardContent className="space-y-4 p-4 sm:p-5">
        <div className="flex flex-wrap gap-2">
          {DATE_PRESETS.map((p) => (
            <Button
              key={p.value}
              type="button"
              variant={filters.datePreset === p.value ? "default" : "outline"}
              size="sm"
              className="rounded-full"
              onClick={() => update({ datePreset: p.value })}
            >
              {p.label}
            </Button>
          ))}
        </div>

        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden
            />
            <Input
              type="search"
              placeholder="Search by name, venue, or topic…"
              value={filters.search}
              onChange={(e) => update({ search: e.target.value })}
              className="pl-10 pr-10"
              autoComplete="off"
            />
            {filters.search ? (
              <button
                type="button"
                onClick={() => update({ search: "" })}
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Clear search"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="relative shrink-0 md:hidden">
            <Button
              type="button"
              variant={activeCount > 0 ? "secondary" : "outline"}
              size="sm"
              className="h-10 w-10 shrink-0 p-0 md:hidden"
              onClick={() => setMobileOpen(!mobileOpen)}
              aria-expanded={mobileOpen}
              aria-controls="public-filter-panel"
              aria-label={activeCount > 0 ? `Filters, ${activeCount} active` : "Filters"}
            >
              <SlidersHorizontal className="h-4 w-4" />
            </Button>
            {activeCount > 0 ? (
              <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold text-primary-foreground">
                {activeCount}
              </span>
            ) : null}
          </div>
        </div>

        <div
          id="public-filter-panel"
          className={cn(
            "flex flex-wrap items-center gap-3",
            mobileOpen ? "flex" : "hidden md:flex",
          )}
        >
          <select
            value={filters.city}
            onChange={(e) => update({ city: e.target.value })}
            className={selectClass}
            aria-label="City"
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={filters.category}
            onChange={(e) => update({ category: e.target.value })}
            className={selectClass}
            aria-label="Category"
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <label
            className={cn(
              "flex cursor-pointer items-center gap-2 rounded-md border px-3 py-2 text-sm transition-colors",
              filters.freeOnly
                ? "border-emerald-500/40 bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
                : "border-input bg-background hover:bg-muted/50",
            )}
          >
            <input
              type="checkbox"
              checked={filters.freeOnly}
              onChange={(e) => update({ freeOnly: e.target.checked })}
              className="sr-only"
            />
            <span
              className={cn(
                "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                filters.freeOnly
                  ? "border-emerald-600 bg-emerald-600 text-white"
                  : "border-input",
              )}
            >
              {filters.freeOnly ? (
                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : null}
            </span>
            Free only
          </label>

          {activeCount > 0 ? (
            <Button type="button" variant="ghost" size="sm" onClick={clearAll} className="text-muted-foreground">
              Clear filters
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
