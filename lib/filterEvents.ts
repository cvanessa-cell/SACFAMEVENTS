import { format } from "date-fns";

import type { LocalDateRange } from "@/lib/dateRangePresets";
import type { EventFiltersState } from "@/lib/eventFiltersState";
import type { FamilyEvent } from "@/lib/validation";

export function envelopeDates(range: LocalDateRange): { startS: string; endS: string } {
  return {
    startS: format(range.start, "yyyy-MM-dd"),
    endS: format(range.end, "yyyy-MM-dd"),
  };
}

export function passesDateEnvelope(
  evDate: string,
  startS: string,
  endS: string,
): boolean {
  const d = evDate.trim().slice(0, 10);
  return d >= startS && d <= endS;
}

export function applyEventFilters(
  ev: FamilyEvent,
  filters: EventFiltersState,
  range: LocalDateRange,
): boolean {
  const { startS, endS } = envelopeDates(range);
  if (!passesDateEnvelope(ev.date, startS, endS)) return false;

  const q = filters.query.trim().toLowerCase();
  if (q) {
    const blob = `${ev.eventName} ${ev.venue ?? ""} ${ev.address ?? ""} ${ev.description ?? ""} ${ev.kidFriendlyNotes ?? ""}`.toLowerCase();
    if (!blob.includes(q)) return false;
  }

  if (filters.city && ev.city?.trim() !== filters.city.trim()) return false;
  if (filters.category && ev.category?.trim() !== filters.category.trim()) {
    return false;
  }
  if (filters.freeOnly && !ev.free) return false;

  if (filters.ageKeyword.trim()) {
    const needle = filters.ageKeyword.trim().toLowerCase();
    const hay = `${ev.ageRange ?? ""}`.toLowerCase();
    if (!hay.includes(needle)) return false;
  }

  if (filters.indoorOutdoor) {
    if ((ev.indoorOutdoor ?? "").toLowerCase() !== filters.indoorOutdoor.toLowerCase()) {
      return false;
    }
  }

  if (filters.registrationRequired === "yes" && !ev.registrationRequired) {
    return false;
  }
  if (filters.registrationRequired === "no" && ev.registrationRequired) {
    return false;
  }

  if (filters.status && ev.status !== filters.status) return false;

  if (filters.sourceType && ev.sourceType?.trim() !== filters.sourceType.trim()) {
    return false;
  }

  if (filters.calendarAdded === "yes" && !ev.addedToGoogleCalendar) return false;
  if (filters.calendarAdded === "no" && ev.addedToGoogleCalendar) return false;

  return true;
}
