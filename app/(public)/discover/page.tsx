"use client";

import { useQuery } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { parseISO, addDays, isAfter, isBefore, startOfDay, endOfDay } from "date-fns";
import { CalendarDays, MapPin, Sparkles } from "lucide-react";

import { PublicEventCard } from "@/components/PublicEventCard";
import {
  PublicEventFilters,
  DEFAULT_FILTERS,
  type PublicFilters,
  type DatePreset,
} from "@/components/PublicEventFilters";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { rangeForPreset } from "@/lib/dateRangePresets";

interface PublicEvent {
  id: string;
  eventName: string;
  description?: string;
  eventLink?: string;
  city?: string;
  county?: string;
  venue?: string;
  address?: string;
  date: string;
  startTime?: string;
  endTime?: string;
  ageRange?: string;
  cost?: string;
  free?: boolean;
  category?: string;
  sourceName?: string;
  registrationRequired?: boolean;
  registrationUrl?: string;
  confidence?: number;
  toddlerRelevance?: number;
  dayOfWeek?: string;
  status: string;
  kidFriendlyNotes?: string;
  airtableRecordId?: string;
  indoorOutdoor?: string;
  googleMapsLink?: string;
}

function datePresetToRange(preset: DatePreset): { start: Date; end: Date } | null {
  if (preset === "all") return null;
  const mapped = preset as
    | "today"
    | "tomorrow"
    | "this_weekend"
    | "this_week"
    | "this_month";
  return rangeForPreset(mapped, new Date());
}

export default function DiscoverPage() {
  const [filters, setFilters] = useState<PublicFilters>(DEFAULT_FILTERS);

  const { data, isLoading, error } = useQuery<{
    events: PublicEvent[];
    count: number;
  }>({
    queryKey: ["public-events"],
    queryFn: async () => {
      const res = await fetch("/api/public/events");
      if (!res.ok) throw new Error("Failed to load events");
      return res.json();
    },
    staleTime: 60_000,
  });

  const publicEvents = data?.events ?? [];

  const cities = useMemo(() => {
    const set = new Set<string>();
    publicEvents.forEach((ev) => {
      if (ev.city?.trim()) set.add(ev.city.trim());
    });
    return Array.from(set).sort();
  }, [publicEvents]);

  const categories = useMemo(() => {
    const set = new Set<string>();
    publicEvents.forEach((ev) => {
      if (ev.category?.trim()) set.add(ev.category.trim());
    });
    return Array.from(set).sort();
  }, [publicEvents]);

  const filtered = useMemo(() => {
    let result = publicEvents;
    const today = startOfDay(new Date());

    const range =
      filters.datePreset === "all"
        ? { start: today, end: endOfDay(addDays(today, 14)) }
        : datePresetToRange(filters.datePreset) ?? {
            start: today,
            end: endOfDay(addDays(today, 14)),
          };

    result = result.filter((ev) => {
      try {
        const d = parseISO(ev.date);
        return !isBefore(d, range.start) && !isAfter(d, range.end);
      } catch {
        return false;
      }
    });

    if (filters.search.trim()) {
      const q = filters.search.toLowerCase();
      result = result.filter(
        (ev) =>
          ev.eventName.toLowerCase().includes(q) ||
          ev.venue?.toLowerCase().includes(q) ||
          ev.description?.toLowerCase().includes(q) ||
          ev.kidFriendlyNotes?.toLowerCase().includes(q) ||
          ev.city?.toLowerCase().includes(q),
      );
    }

    if (filters.city) {
      result = result.filter((ev) => ev.city === filters.city);
    }

    if (filters.category) {
      result = result.filter((ev) => ev.category === filters.category);
    }

    if (filters.freeOnly) {
      result = result.filter((ev) => ev.free === true);
    }

    if (filters.toddlerFriendlyOnly) {
      result = result.filter((ev) => (ev.toddlerRelevance ?? 0) >= 0.4);
    }

    result.sort((a, b) => {
      const toddlerDelta = (b.toddlerRelevance ?? 0) - (a.toddlerRelevance ?? 0);
      if (toddlerDelta !== 0) return toddlerDelta;
      try {
        return parseISO(a.date).getTime() - parseISO(b.date).getTime();
      } catch {
        return 0;
      }
    });

    return result;
  }, [publicEvents, filters]);

  return (
    <div className="mx-auto max-w-6xl space-y-10 px-4 py-10 sm:px-6 lg:py-14">
      <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/[0.09] via-card to-card shadow-sm">
        <CardHeader className="space-y-4 pb-2 text-center sm:pb-4">
          <div className="flex justify-center">
            <Badge
              variant="secondary"
              className="gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-3 py-1 text-xs font-medium text-primary"
            >
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Sacramento &amp; Placer County
            </Badge>
          </div>
          <CardTitle className="text-balance text-3xl font-bold tracking-tight sm:text-4xl lg:text-5xl">
            Family-friendly events near you
          </CardTitle>
          <CardDescription className="mx-auto max-w-2xl text-base text-muted-foreground sm:text-lg">
            Curated ideas for kids and caregivers—free outings, library programs, parks, and more.
            Filter by date, city, or what matters to your family.
          </CardDescription>
          <div className="flex flex-wrap items-center justify-center gap-2 pt-1 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-primary" aria-hidden />
              Local picks
            </span>
            <span className="inline-flex items-center gap-1 rounded-full border border-border/60 bg-background/80 px-2.5 py-1">
              Always free to browse
            </span>
          </div>
        </CardHeader>
        <CardContent className="pt-0">
          <PublicEventFilters
            filters={filters}
            onChange={setFilters}
            cities={cities}
            categories={categories}
          />
        </CardContent>
      </Card>

      <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        <CalendarDays className="h-4 w-4 shrink-0 text-primary" aria-hidden />
        {isLoading ? (
          <span>Loading events…</span>
        ) : (
          <span>
            <strong className="font-semibold text-foreground">{filtered.length}</strong>{" "}
            {filtered.length === 1 ? "event" : "events"} in this view
          </span>
        )}
      </div>

      {isLoading ? (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="h-52 animate-pulse rounded-xl border border-border/60 bg-muted/50"
            />
          ))}
        </div>
      ) : error ? (
        <Card className="border-destructive/30 bg-destructive/5 shadow-sm">
          <CardContent className="flex flex-col items-center gap-2 p-10 text-center">
            <p className="font-medium text-destructive">Unable to load events</p>
            <p className="max-w-md text-sm text-muted-foreground">
              Please check your connection and try again in a moment.
            </p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card className="border-dashed shadow-sm">
          <CardContent className="flex flex-col items-center gap-3 p-12 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-muted">
              <CalendarDays className="h-7 w-7 text-muted-foreground" aria-hidden />
            </div>
            <div className="space-y-1">
              <p className="text-lg font-semibold text-foreground">No events match</p>
              <p className="max-w-sm text-sm text-muted-foreground">
                {publicEvents.length === 0
                  ? "No approved upcoming events yet. Check back soon — new family-friendly picks are added after review."
                  : "Try a wider date range, another city, or clear filters to see more results."}
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-1 lg:grid-cols-2">
          {filtered.map((ev, i) => (
            <PublicEventCard
              key={ev.id ?? ev.airtableRecordId ?? `${ev.eventName}-${i}`}
              event={ev}
            />
          ))}
        </div>
      )}
    </div>
  );
}
