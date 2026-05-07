"use client";

import { useMutation, useQuery } from "@tanstack/react-query";
import { addMonths, format, parseISO } from "date-fns";
import * as React from "react";

import {
  AddToCalendarButton,
  SendToZapierButton,
} from "@/components/AddToCalendarButton";
import { DateRangeSelector } from "@/components/DateRangeSelector";
import type { PeriodPreset } from "@/lib/dateRangePresets";
import { rangeForPreset } from "@/lib/dateRangePresets";
import { EventFilters } from "@/components/EventFilters";
import { EventList } from "@/components/EventList";
import type { EventFiltersState } from "@/lib/eventFiltersState";
import { defaultEventFilters } from "@/lib/eventFiltersState";
import { applyEventFilters } from "@/lib/filterEvents";
import type { GroupMode } from "@/lib/eventGrouping";
import type { FamilyEvent } from "@/lib/validation";
import { Button } from "@/components/ui/button";

type EventsPayload = {
  source: "mock" | "airtable" | string;
  events: FamilyEvent[];
  warning?: string;
  airtableError?: boolean;
};

async function fetchEvents(): Promise<EventsPayload> {
  const res = await fetch("/api/events");
  const body = (await res.json()) as EventsPayload;
  if (!res.ok && !body.events) throw new Error("Failed to load events");
  return body;
}

export function EventsExplorer() {
  const { data, error, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["events-list"],
    queryFn: fetchEvents,
  });

  const [preset, setPreset] = React.useState<PeriodPreset>("this_month");
  const [customStart, setCustomStart] = React.useState(() =>
    format(new Date(), "yyyy-MM-dd"),
  );
  const [customEnd, setCustomEnd] = React.useState(() =>
    format(addMonths(new Date(), 1), "yyyy-MM-dd"),
  );

  const range = React.useMemo(() => {
    if (preset === "custom") {
      return rangeForPreset("custom", new Date(), {
        start: parseISO(`${customStart}T12:00:00`),
        end: parseISO(`${customEnd}T12:00:00`),
      });
    }
    return rangeForPreset(preset, new Date());
  }, [preset, customStart, customEnd]);

  const [filters, setFilters] = React.useState<EventFiltersState>(() => ({
    ...defaultEventFilters,
  }));

  const [groupMode, setGroupMode] = React.useState<GroupMode>("day");

  const [selected, setSelected] = React.useState<Set<string>>(new Set());

  function toggleSelection(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  const events = React.useMemo(
    () => data?.events ?? [],
    [data?.events],
  );

  const filtered = React.useMemo(
    () => events.filter((e) => applyEventFilters(e, filters, range)),
    [events, filters, range],
  );

  const selectedIdsArr = Array.from(selected);

  const zapierSingle = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch("/api/events/send-to-zapier", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ eventIds: [id] }),
      });
      const body = (await res.json()) as {
        ok?: boolean;
        message?: string;
        results?: { ok: boolean; message?: string }[];
      };
      if (!res.ok) {
        throw new Error(body.message ?? "Failed to send to Zapier");
      }
      const row = body.results?.[0];
      if (row && !row.ok) {
        throw new Error(row.message ?? "Zapier webhook failed for this event.");
      }
      if (body.ok === false) {
        throw new Error(body.message ?? "Zapier export failed.");
      }
      return body;
    },
    onSuccess: () => {
      void refetch();
    },
  });

  const warning = data?.warning;

  return (
    <div className="space-y-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">
          Family events ({filtered.length} shown)
        </h1>
        <p className="text-muted-foreground">
          Browse events from your Airtable base &quot;FAMILY EVENTS&quot; (or demo
          data).
        </p>
        {(warning || error) ? (
          <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950">
            {warning ||
              (error instanceof Error ? error.message : String(error))}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button
            variant="outline"
            type="button"
            onClick={() => refetch()}
            disabled={isFetching}
          >
            {isFetching ? "Refreshing…" : "Reload from API"}
          </Button>
          <Button variant="outline" type="button" asChild>
            <a href="/api/events?mock=1">View mock JSON</a>
          </Button>
        </div>
      </header>

      <section className="space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 className="text-lg font-medium">When</h2>
          <div className="inline-flex rounded-lg border bg-muted p-1 text-sm shadow-sm">
            {(["day", "week", "month"] satisfies GroupMode[]).map((m) => (
              <Button
                key={m}
                type="button"
                variant={groupMode === m ? "default" : "ghost"}
                size="sm"
                className="px-4"
                onClick={() => setGroupMode(m)}
              >
                {m === "day" ? "By day" : m === "week" ? "By week" : "By month"}
              </Button>
            ))}
          </div>
        </div>
        <DateRangeSelector
          preset={preset}
          onPresetChange={setPreset}
          customStart={customStart}
          customEnd={customEnd}
          onCustomStartChange={setCustomStart}
          onCustomEndChange={setCustomEnd}
        />
      </section>

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Filters</h2>
        <EventFilters
          filters={filters}
          onChange={setFilters}
          events={events}
        />
      </section>

      <section className="flex flex-col gap-4 rounded-lg border bg-muted/40 p-4 sm:flex-row sm:flex-wrap sm:items-start sm:justify-between">
        <div className="text-sm">
          <span className="font-medium">{selectedIdsArr.length}</span> selected
          {filtered.length !== events.length
            ? ` · ${filtered.length}/${events.length} in range/filter`
            : null}
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-start">
          <AddToCalendarButton ids={selectedIdsArr} />
          <SendToZapierButton
            ids={selectedIdsArr}
            onSettled={() => {
              void refetch();
            }}
          />
        </div>
      </section>

      {isLoading ? (
        <p className="text-muted-foreground">Loading events…</p>
      ) : filtered.length === 0 ? (
        <p className="text-muted-foreground">
          No events in this window. Expand the date range or clear filters.
        </p>
      ) : (
        <EventList
          events={filtered}
          groupMode={groupMode}
          selectedIds={selected}
          onToggle={toggleSelection}
          onSendViaZapier={(id) => zapierSingle.mutate(id)}
          zapierSinglePending={zapierSingle.isPending}
        />
      )}
    </div>
  );
}
