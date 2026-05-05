"use client";

import { EventCard } from "@/components/EventCard";
import {
  groupKeyForEvent,
  groupLabel,
  sortEventsByDateTime,
} from "@/lib/eventGrouping";
import type { GroupMode } from "@/lib/eventGrouping";
import type { FamilyEvent } from "@/lib/validation";

export interface EventListProps {
  events: FamilyEvent[];
  groupMode: GroupMode;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onSendViaZapier?: (id: string) => void;
  zapierSinglePending?: boolean;
}

export function EventList({
  events,
  groupMode,
  selectedIds,
  onToggle,
  onSendViaZapier,
  zapierSinglePending,
}: EventListProps) {
  const sorted = [...events].sort(sortEventsByDateTime);
  const groups = new Map<string, FamilyEvent[]>();
  for (const ev of sorted) {
    const key = groupKeyForEvent(ev, groupMode);
    const bucket = groups.get(key) ?? [];
    bucket.push(ev);
    groups.set(key, bucket);
  }

  const keys = Array.from(groups.keys()).sort((a, b) => a.localeCompare(b));

  return (
    <div className="space-y-10">
      {keys.map((key) => {
        const bucket = groups.get(key) ?? [];
        return (
          <section key={key} className="space-y-4">
            <h2 className="text-xl font-semibold tracking-tight">
              {groupLabel(key, groupMode)}
            </h2>
            <div className="grid gap-4 lg:grid-cols-2">
              {bucket.map((ev) => {
                const id = ev.airtableRecordId ?? ev.eventName;
                return (
                  <EventCard
                    key={id}
                    ev={ev}
                    selected={selectedIds.has(id)}
                    onToggle={onToggle}
                    onSendViaZapier={onSendViaZapier}
                    zapierSinglePending={zapierSinglePending}
                  />
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
