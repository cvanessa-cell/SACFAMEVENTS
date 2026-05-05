"use client";

import * as React from "react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { EVENT_STATUS_OPTIONS } from "@/lib/constants";
import {
  defaultEventFilters,
  type EventFiltersState,
} from "@/lib/eventFiltersState";
import type { FamilyEvent } from "@/lib/validation";

export type { EventFiltersState };
export { defaultEventFilters as defaultEventFiltersState };

export interface EventFiltersProps {
  filters: EventFiltersState;
  onChange: (next: EventFiltersState) => void;
  events: FamilyEvent[];
}

export function EventFilters({ filters, onChange, events }: EventFiltersProps) {
  const cities = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of events) {
      if (e.city?.trim()) s.add(e.city.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const categories = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of events) {
      if (e.category?.trim()) s.add(e.category.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const sourceTypes = React.useMemo(() => {
    const s = new Set<string>();
    for (const e of events) {
      if (e.sourceType?.trim()) s.add(e.sourceType.trim());
    }
    return Array.from(s).sort((a, b) => a.localeCompare(b));
  }, [events]);

  const selClass =
    "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm";

  function patch(patch: Partial<EventFiltersState>) {
    onChange({ ...filters, ...patch });
  }

  return (
    <div className="grid gap-4 rounded-lg border bg-card p-4">
      <div className="space-y-2">
        <Label htmlFor="search">Search</Label>
        <Input
          id="search"
          placeholder="Title, venue, notes…"
          value={filters.query}
          onChange={(e) => patch({ query: e.target.value })}
        />
      </div>
      <Separator />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <FilterField label="City">
          <select
            className={selClass}
            value={filters.city}
            onChange={(e) => patch({ city: e.target.value })}
          >
            <option value="">All cities</option>
            {cities.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Category">
          <select
            className={selClass}
            value={filters.category}
            onChange={(e) => patch({ category: e.target.value })}
          >
            <option value="">All categories</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Free only">
          <button
            type="button"
            onClick={() => patch({ freeOnly: !filters.freeOnly })}
            className={`rounded-md border px-3 py-2 text-sm ${filters.freeOnly ? "border-primary bg-primary/10" : ""}`}
          >
            {filters.freeOnly ? "Showing free events only" : "Include paid events"}
          </button>
        </FilterField>
        <FilterField label="Age / keyword">
          <Input
            value={filters.ageKeyword}
            onChange={(e) => patch({ ageKeyword: e.target.value })}
            placeholder="e.g. toddler, 5-12…"
          />
        </FilterField>
        <FilterField label="Indoor / Outdoor">
          <select
            className={selClass}
            value={filters.indoorOutdoor}
            onChange={(e) =>
              patch({
                indoorOutdoor: e.target.value as EventFiltersState["indoorOutdoor"],
              })
            }
          >
            <option value="">Any</option>
            <option value="Indoor">Indoor</option>
            <option value="Outdoor">Outdoor</option>
          </select>
        </FilterField>
        <FilterField label="Registration">
          <select
            className={selClass}
            value={filters.registrationRequired}
            onChange={(e) =>
              patch({
                registrationRequired: e.target
                  .value as EventFiltersState["registrationRequired"],
              })
            }
          >
            <option value="">Any</option>
            <option value="yes">Registration required</option>
            <option value="no">No registration</option>
          </select>
        </FilterField>
        <FilterField label="Status">
          <select
            className={selClass}
            value={filters.status}
            onChange={(e) =>
              patch({
                status: e.target.value as EventFiltersState["status"],
              })
            }
          >
            <option value="">Any</option>
            {EVENT_STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Source type">
          <select
            className={selClass}
            value={filters.sourceType}
            onChange={(e) => patch({ sourceType: e.target.value })}
          >
            <option value="">Any</option>
            {sourceTypes.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Google Calendar">
          <select
            className={selClass}
            value={filters.calendarAdded}
            onChange={(e) =>
              patch({
                calendarAdded: e.target
                  .value as EventFiltersState["calendarAdded"],
              })
            }
          >
            <option value="">Any</option>
            <option value="no">Not added yet</option>
            <option value="yes">Already added</option>
          </select>
        </FilterField>
      </div>
    </div>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-2">
      <Label className="text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}
