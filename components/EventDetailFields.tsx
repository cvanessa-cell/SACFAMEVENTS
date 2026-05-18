"use client";

import { format, parseISO } from "date-fns";

import { Badge } from "@/components/ui/badge";
import { ensureMapsLink } from "@/lib/eventFormatting";
import { computeDayOfWeekForFamilyEvent } from "@/lib/eventLocation";
import type { FamilyEvent } from "@/lib/validation";

export interface EventDetailFieldsProps {
  event: FamilyEvent;
  compact?: boolean;
}

function formatDateLine(ev: FamilyEvent): string {
  let datePretty = ev.date;
  try {
    datePretty = format(parseISO(ev.date), "EEEE, MMM d, yyyy");
  } catch {
    /* keep raw */
  }
  const dow =
    ev.dayOfWeek?.trim() || computeDayOfWeekForFamilyEvent(ev.date);
  return dow && !datePretty.toLowerCase().includes(dow.toLowerCase())
    ? `${datePretty} (${dow})`
    : datePretty;
}

function DetailRow({
  label,
  children,
  className = "",
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={className}>
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export function EventDetailFields({ event, compact = false }: EventDetailFieldsProps) {
  const maps = ensureMapsLink(event);
  const when =
    event.startTime && event.endTime
      ? `${event.startTime} – ${event.endTime}`
      : event.startTime ?? "—";
  const spanClass = compact ? "" : "sm:col-span-2";

  return (
    <dl className={`grid gap-2 text-sm ${compact ? "" : "sm:grid-cols-2"}`}>
      {event.description ? (
        <DetailRow label="Description" className={spanClass}>
          <span className="whitespace-pre-wrap">{event.description}</span>
        </DetailRow>
      ) : null}
      <DetailRow label="Date">{formatDateLine(event)}</DetailRow>
      <DetailRow label="Time">{when}</DetailRow>
      <DetailRow label="Location">
        {[event.venue, event.address, event.city].filter(Boolean).join(" · ") ||
          "—"}
      </DetailRow>
      {maps ? (
        <DetailRow label="Google Maps" className={spanClass}>
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            Open in Google Maps
          </a>
        </DetailRow>
      ) : null}
      <DetailRow label="Event website" className={spanClass}>
        {event.eventLink ? (
          <a
            href={event.eventLink}
            target="_blank"
            rel="noopener noreferrer"
            className="break-all text-primary underline underline-offset-4"
          >
            {event.eventLink}
          </a>
        ) : (
          <span className="text-amber-700 dark:text-amber-300">
            URL missing — needs review
          </span>
        )}
      </DetailRow>
      <DetailRow label="Source">
        {event.sourceLink ? (
          <a
            href={event.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary underline underline-offset-4"
          >
            {event.sourceName ?? event.sourceLink}
          </a>
        ) : (
          (event.sourceName ?? "—")
        )}
      </DetailRow>
      <DetailRow label="Status">
        <span className="inline-flex flex-wrap items-center gap-2">
          {event.status}
          {event.status === "Need Review" ? (
            <Badge variant="warning">Need Review</Badge>
          ) : null}
        </span>
      </DetailRow>
    </dl>
  );
}
