"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { EventDetailFields } from "@/components/EventDetailFields";
import { EventTitleLink } from "@/components/EventTitleLink";
import { ensureMapsLink } from "@/lib/eventFormatting";
import { computeDayOfWeekForFamilyEvent } from "@/lib/eventLocation";
import type { FamilyEvent } from "@/lib/validation";
import { format, parseISO } from "date-fns";

export interface EventCardProps {
  ev: FamilyEvent;
  selected: boolean;
  onToggle: (id: string) => void;
  onSendViaZapier?: (id: string) => void;
  zapierSinglePending?: boolean;
}

export function EventCard({
  ev,
  selected,
  onToggle,
  onSendViaZapier,
  zapierSinglePending,
}: EventCardProps) {
  const id = ev.airtableRecordId ?? ev.eventName;
  const maps = ensureMapsLink(ev);
  let datePretty = ev.date;
  try {
    datePretty = format(parseISO(ev.date), "EEEE, MMM d, yyyy");
  } catch {
    /* keep raw */
  }
  const dow = ev.dayOfWeek?.trim() || computeDayOfWeekForFamilyEvent(ev.date);
  const when =
    ev.startTime && ev.endTime
      ? `${ev.startTime} – ${ev.endTime}`
      : ev.startTime ?? "";

  const descriptionPreview = ev.description?.trim()
    ? ev.description.length > 220
      ? `${ev.description.slice(0, 220)}…`
      : ev.description
    : null;

  return (
    <Card className="overflow-hidden border-border/60 shadow-sm transition-shadow hover:shadow-md">
      <CardHeader className="space-y-2">
        <div className="flex items-start gap-3">
          <Checkbox
            id={`ev-${id}`}
            checked={selected}
            onCheckedChange={() => onToggle(id)}
            aria-labelledby={`lbl-${id}`}
          />
          <div className="flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 id={`lbl-${id}`} className="text-lg">
                <EventTitleLink event={ev} />
              </h3>
              {ev.status === "Need Review" ? (
                <Badge variant="warning">Need Review</Badge>
              ) : null}
              {ev.free ? (
                <Badge variant="success">Free</Badge>
              ) : ev.cost ? (
                <Badge variant="secondary">{ev.cost}</Badge>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">
              {datePretty}
              {dow && !datePretty.toLowerCase().includes(dow.toLowerCase())
                ? ` · ${dow}`
                : ""}
            </div>
            {when ? (
              <div className="text-sm text-muted-foreground">{when}</div>
            ) : null}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        {descriptionPreview ? (
          <p className="text-sm text-muted-foreground">{descriptionPreview}</p>
        ) : null}
        <p className="text-sm">
          {[ev.venue, ev.address, ev.city].filter(Boolean).join(" · ") || "—"}
        </p>
        {maps ? (
          <a
            href={maps}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-primary underline underline-offset-4"
          >
            Open in Google Maps
          </a>
        ) : null}
        {ev.sourceLink ? (
          <a
            href={ev.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-primary underline underline-offset-4"
          >
            Source: {ev.sourceName ?? "View source"}
          </a>
        ) : null}
        {ev.screenshotUrl ? (
          <div className="aspect-video w-full max-w-xl overflow-hidden rounded-md border bg-muted">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={ev.screenshotUrl}
              alt=""
              className="h-full w-full object-cover"
              loading="lazy"
            />
          </div>
        ) : null}
        <EventDetailFields event={ev} compact />
        {onSendViaZapier ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={zapierSinglePending}
            onClick={() => onSendViaZapier(id)}
          >
            {zapierSinglePending ? "Sending…" : "Add via Zapier"}
          </Button>
        ) : null}
        <Separator />
        <div className="text-xs text-muted-foreground">
          On Google Calendar: {ev.addedToGoogleCalendar ? "Yes" : "No"}
          {ev.zapierWebhookStatus ? ` · Zapier: ${ev.zapierWebhookStatus}` : ""}
        </div>
      </CardContent>
    </Card>
  );
}
