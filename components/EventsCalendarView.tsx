"use client";

import { useMemo, useState } from "react";
import {
  addDays,
  eachDayOfInterval,
  endOfMonth,
  endOfWeek,
  format,
  isSameMonth,
  startOfMonth,
  startOfWeek,
} from "date-fns";

import { EventDetailFields } from "@/components/EventDetailFields";
import { EventTitleLink } from "@/components/EventTitleLink";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import type { FamilyEvent } from "@/lib/validation";

export interface EventsCalendarViewProps {
  events: FamilyEvent[];
}

export function EventsCalendarView({ events }: EventsCalendarViewProps) {
  const [month, setMonth] = useState(() => startOfMonth(new Date()));
  const [selected, setSelected] = useState<FamilyEvent | null>(null);

  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month));
    const end = endOfWeek(endOfMonth(month));
    return eachDayOfInterval({ start, end });
  }, [month]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, FamilyEvent[]>();
    for (const ev of events) {
      const key = ev.date.slice(0, 10);
      const bucket = map.get(key) ?? [];
      bucket.push(ev);
      map.set(key, bucket);
    }
    return map;
  }, [events]);

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-2">
          <div>
            <CardTitle>{format(month, "MMMM yyyy")}</CardTitle>
            <CardDescription>
              Event titles link to the event website. Select a day entry for full details.
            </CardDescription>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMonth((m) => addDays(m, -30))}
            >
              Prev
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMonth(startOfMonth(new Date()))}
            >
              Today
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setMonth((m) => addDays(m, 30))}
            >
              Next
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-7 gap-1 text-center text-xs font-medium text-muted-foreground">
            {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((d) => (
              <div key={d} className="py-1">
                {d}
              </div>
            ))}
          </div>
          <div className="mt-1 grid grid-cols-7 gap-1">
            {days.map((day) => {
              const key = format(day, "yyyy-MM-dd");
              const dayEvents = eventsByDay.get(key) ?? [];
              const inMonth = isSameMonth(day, month);
              return (
                <div
                  key={key}
                  className={`min-h-[88px] rounded-md border p-1 text-left ${
                    inMonth ? "bg-card" : "bg-muted/40 text-muted-foreground"
                  }`}
                >
                  <div className="text-xs font-medium">
                    {format(day, "d")}
                  </div>
                  <ul className="mt-1 space-y-1">
                    {dayEvents.slice(0, 3).map((ev) => {
                      const id = ev.airtableRecordId ?? ev.eventName;
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className="w-full rounded px-0.5 text-left text-[11px] leading-tight hover:bg-muted/60"
                            onClick={() => setSelected(ev)}
                          >
                            <span className="block truncate font-medium">
                              {ev.eventLink ? (
                                <a
                                  href={ev.eventLink}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-primary underline underline-offset-2"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  {ev.eventName}
                                </a>
                              ) : (
                                <span>{ev.eventName}</span>
                              )}
                            </span>
                          </button>
                        </li>
                      );
                    })}
                    {dayEvents.length > 3 ? (
                      <li className="text-[10px] text-muted-foreground">
                        +{dayEvents.length - 3} more
                      </li>
                    ) : null}
                  </ul>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="text-lg">Event details</CardTitle>
          <CardDescription>
            {selected
              ? "Description, schedule, maps, and source links."
              : "Select an event on the calendar."}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {selected ? (
            <div className="space-y-3">
              <EventTitleLink event={selected} className="text-lg" />
              {selected.status === "Need Review" ? (
                <Badge variant="warning">Need Review</Badge>
              ) : null}
              <EventDetailFields event={selected} compact />
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">No event selected.</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
