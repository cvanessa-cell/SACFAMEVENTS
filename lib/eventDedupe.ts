import type { FamilyEvent } from "@/lib/validation";
import { sourceTypeRank } from "@/lib/constants";

/** Deterministic fuzzy key powering duplicate grouping. */
export function buildNormalizedEventKey(ev: {
  eventName: string;
  date: string;
  venue?: string;
  address?: string;
  city?: string;
}): string {
  const name = ev.eventName.trim().toLowerCase();
  const day = ev.date.trim().slice(0, 10);
  const where = `${(ev.address ?? "").trim()}|${(ev.venue ?? "").trim()}|${(ev.city ?? "").trim()}`.toLowerCase();
  return `${name}§${day}§${where}`;
}

export function pickWinnerForDuplicates(
  group: FamilyEvent[],
): FamilyEvent | undefined {
  if (group.length === 0) return undefined;
  return [...group].sort((a, b) => {
    const sr = sourceTypeRank(a.sourceType ?? "") - sourceTypeRank(b.sourceType ?? "");
    if (sr !== 0) return sr;
    const cc = (b.confidenceScore ?? 0) - (a.confidenceScore ?? 0);
    if (cc !== 0) return cc;
    return (a.airtableRecordId ?? "").localeCompare(b.airtableRecordId ?? "");
  })[0];
}
