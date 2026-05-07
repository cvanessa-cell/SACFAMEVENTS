"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { ensureMapsLink } from "@/lib/eventFormatting";
import type { FamilyEvent } from "@/lib/validation";
import { format } from "date-fns";
import { parseISO } from "date-fns";

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
  const when =
    ev.startTime && ev.endTime
      ? `${ev.startTime} – ${ev.endTime}`
      : ev.startTime ?? "";

  return (
    <Card className="overflow-hidden">
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
              <CardTitle id={`lbl-${id}`} className="text-lg">
                {ev.eventName}
              </CardTitle>
              {ev.free ? (
                <Badge variant="success">Free</Badge>
              ) : (
                <Badge variant="secondary">{ev.cost ?? "Paid"}</Badge>
              )}
              {ev.registrationRequired ? (
                <Badge variant="warning">Registration</Badge>
              ) : null}
            </div>
            <div className="text-sm text-muted-foreground">{datePretty}</div>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
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
        <dl className="grid gap-2 text-sm sm:grid-cols-2">
          <div>
            <dt className="text-muted-foreground">When</dt>
            <dd>{when || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">City</dt>
            <dd>{ev.city ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Where</dt>
            <dd>{[ev.venue, ev.address].filter(Boolean).join(" · ") || "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Category</dt>
            <dd>{ev.category ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Indoor/outdoor</dt>
            <dd>{ev.indoorOutdoor ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Age</dt>
            <dd>{ev.ageRange ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Source</dt>
            <dd>{ev.sourceName ?? ev.sourceType ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Status</dt>
            <dd>{ev.status}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">On Google Calendar</dt>
            <dd>{ev.addedToGoogleCalendar ? "Yes" : "No"}</dd>
          </div>
          {ev.zapierWebhookStatus ? (
            <div className="sm:col-span-2">
              <dt className="text-muted-foreground">Zapier webhook</dt>
              <dd className="break-words">{ev.zapierWebhookStatus}</dd>
              {ev.zapierLastSentAt ? (
                <dd className="text-xs text-muted-foreground">
                  Last sent: {ev.zapierLastSentAt}
                </dd>
              ) : null}
            </div>
          ) : null}
          {typeof ev.confidenceScore === "number" ? (
            <div>
              <dt className="text-muted-foreground">Confidence</dt>
              <dd>{Math.round(ev.confidenceScore * 100)}%</dd>
            </div>
          ) : null}
        </dl>
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
        {ev.eventLink ? (
          <a
            className="text-sm font-medium text-primary underline underline-offset-4"
            href={ev.eventLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Event page
          </a>
        ) : null}{" "}
        {ev.sourceLink ? (
          <a
            className="text-sm font-medium text-primary underline underline-offset-4"
            href={ev.sourceLink}
            target="_blank"
            rel="noopener noreferrer"
          >
            Source page
          </a>
        ) : null}
        {maps ? (
          <div>
            <Label className="text-muted-foreground">Maps</Label>
            <a
              className="block text-sm text-primary underline underline-offset-4"
              href={maps}
              target="_blank"
              rel="noopener noreferrer"
            >
              Open in Google Maps
            </a>
          </div>
        ) : null}
        {ev.kidFriendlyNotes ? (
          <>
            <Separator />
            <p className="text-sm">{ev.kidFriendlyNotes}</p>
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
