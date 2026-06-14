"use client";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { format, parseISO } from "date-fns";
import {
  MapPin,
  Clock,
  ExternalLink,
  Tag,
  Users,
  Navigation,
} from "lucide-react";

import { cn } from "@/lib/utils";

const CATEGORY_COLORS: Record<string, string> = {
  "story time": "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  storytime: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
  stem: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  science: "bg-sky-100 text-sky-800 dark:bg-sky-950/60 dark:text-sky-200",
  arts: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-200",
  music: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-200",
  theater: "bg-pink-100 text-pink-800 dark:bg-pink-950/60 dark:text-pink-200",
  festival: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  market: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  community: "bg-teal-100 text-teal-800 dark:bg-teal-950/60 dark:text-teal-200",
  outdoor: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200",
  nature: "bg-green-100 text-green-800 dark:bg-green-950/60 dark:text-green-200",
  sports: "bg-orange-100 text-orange-800 dark:bg-orange-950/60 dark:text-orange-200",
  movie: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950/60 dark:text-indigo-200",
  swim: "bg-cyan-100 text-cyan-800 dark:bg-cyan-950/60 dark:text-cyan-200",
  library: "bg-violet-100 text-violet-800 dark:bg-violet-950/60 dark:text-violet-200",
};

function categoryColor(category?: string): string {
  if (!category) return "bg-muted text-muted-foreground";
  const lower = category.toLowerCase();
  for (const [key, color] of Object.entries(CATEGORY_COLORS)) {
    if (lower.includes(key)) return color;
  }
  return "bg-muted text-muted-foreground";
}

export interface PublicEventData {
  eventName: string;
  date: string;
  startTime?: string;
  endTime?: string;
  city?: string;
  venue?: string;
  address?: string;
  category?: string;
  ageRange?: string;
  cost?: string;
  free?: boolean;
  indoorOutdoor?: string;
  registrationRequired?: boolean;
  toddlerRelevance?: number;
  dayOfWeek?: string;
  description?: string;
  kidFriendlyNotes?: string;
  eventLink?: string;
  googleMapsLink?: string;
  sourceName?: string;
}

export interface PublicEventCardProps {
  event: PublicEventData;
}

function buildMapsLink(event: PublicEventData): string {
  if (event.googleMapsLink?.trim()) return event.googleMapsLink;
  const parts = [event.address, event.venue, event.city].filter(Boolean).join(", ");
  if (!parts) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(parts)}`;
}

export function PublicEventCard({ event }: PublicEventCardProps) {
  const maps = buildMapsLink(event);

  let dayOfWeek = event.dayOfWeek ?? "";
  let monthDay = "";
  try {
    const d = parseISO(event.date);
    if (!dayOfWeek) dayOfWeek = format(d, "EEE");
    monthDay = format(d, "MMM d");
  } catch {
    /* keep raw */
  }

  const timeDisplay =
    event.startTime && event.endTime
      ? `${event.startTime} – ${event.endTime}`
      : event.startTime || "";

  return (
    <article
      className={cn(
        "group relative flex overflow-hidden rounded-xl border border-border/70 bg-card shadow-sm",
        "transition-all duration-200 hover:border-primary/25 hover:shadow-md",
      )}
    >
      <div className="flex w-[4.75rem] shrink-0 flex-col items-center justify-center bg-primary px-2 py-4 text-primary-foreground">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-primary-foreground/90">
          {dayOfWeek}
        </span>
        <span className="text-lg font-bold leading-tight">{monthDay}</span>
      </div>

      <div className="flex min-w-0 flex-1 flex-col gap-2.5 p-4 sm:p-5">
        <div className="flex flex-wrap items-start gap-2">
          {event.eventLink ? (
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug">
              <a
                href={event.eventLink}
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground transition-colors hover:text-primary"
              >
                {event.eventName}
              </a>
            </h3>
          ) : (
            <h3 className="min-w-0 flex-1 text-base font-semibold leading-snug text-foreground">
              {event.eventName}
            </h3>
          )}
          {event.toddlerRelevance != null && event.toddlerRelevance >= 0.4 ? (
            <Badge variant="secondary" className="shrink-0">
              Ages 2–6 friendly
            </Badge>
          ) : null}
          {event.free ? (
            <Badge variant="success" className="shrink-0">
              Free
            </Badge>
          ) : null}
          {!event.free && event.cost ? (
            <Badge variant="secondary" className="shrink-0">
              {event.cost}
            </Badge>
          ) : null}
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          {timeDisplay ? (
            <span className="inline-flex items-center gap-1.5">
              <Clock className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {timeDisplay}
            </span>
          ) : null}
          {event.venue ? (
            <span className="inline-flex min-w-0 items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              <span className="truncate">{event.venue}</span>
            </span>
          ) : null}
          {event.city ? (
            <span className="inline-flex items-center gap-1.5">
              <Navigation className="h-3.5 w-3.5 shrink-0 opacity-70" aria-hidden />
              {event.city}
            </span>
          ) : null}
        </div>

        {(event.description || event.kidFriendlyNotes) ? (
          <p className="line-clamp-2 text-sm leading-relaxed text-muted-foreground">
            {event.description || event.kidFriendlyNotes}
          </p>
        ) : null}

        <div className="flex flex-wrap items-center gap-2">
          {event.category ? (
            <span
              className={cn(
                "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium",
                categoryColor(event.category),
              )}
            >
              <Tag className="h-3 w-3 shrink-0" aria-hidden />
              {event.category}
            </span>
          ) : null}
          {event.ageRange ? (
            <span className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              <Users className="h-3 w-3 shrink-0" aria-hidden />
              {event.ageRange}
            </span>
          ) : null}
          {event.indoorOutdoor ? (
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-medium text-muted-foreground">
              {event.indoorOutdoor}
            </span>
          ) : null}
          {event.registrationRequired ? (
            <Badge variant="warning" className="text-xs">
              Registration
            </Badge>
          ) : null}
        </div>

        <div className="mt-auto flex flex-wrap items-center justify-between gap-2 pt-1">
          <div className="flex flex-wrap items-center gap-2">
          {event.eventLink ? (
            <Button variant="default" size="sm" className="h-8" asChild>
              <a href={event.eventLink} target="_blank" rel="noopener noreferrer">
                Details
                <ExternalLink className="ml-1 h-3.5 w-3.5" aria-hidden />
              </a>
            </Button>
          ) : null}
          {maps ? (
            <Button variant="outline" size="sm" className="h-8" asChild>
              <a href={maps} target="_blank" rel="noopener noreferrer">
                <MapPin className="mr-1 h-3.5 w-3.5" aria-hidden />
                Map
              </a>
            </Button>
          ) : null}
          </div>
          {event.sourceName ? (
            <span className="text-xs text-muted-foreground">
              via {event.sourceName}
            </span>
          ) : null}
        </div>
      </div>
    </article>
  );
}
