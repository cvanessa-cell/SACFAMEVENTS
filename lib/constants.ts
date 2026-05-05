export const EVENT_STATUS_OPTIONS = [
  "Need Review",
  "Confirmed",
  "Added to Calendar",
  "Expired",
  "Duplicate",
  "Rejected",
] as const;

export const SOURCE_PRIORITY_ORDER = [
  "official_city",
  "official_venue_library_school",
  "official_host",
  "regional_calendar",
  "facebook",
  "third_party",
] as const;

export type SourceTypePriority =
  | (typeof SOURCE_PRIORITY_ORDER)[number]
  | "unknown";

/** Order index: lower = more authoritative when deduping. */
export function sourceTypeRank(sourceTypeRaw: string): number {
  const s = sourceTypeRaw.toLowerCase();
  if (
    s.includes("city") ||
    s.includes("county") ||
    s.includes("parks") ||
    s.includes("csd") ||
    s.includes("district")
  ) {
    return 0;
  }
  if (
    s.includes("library") ||
    s.includes("school") ||
    s.includes("museum") ||
    s.includes("zoo") ||
    s.includes("venue")
  ) {
    return 1;
  }
  if (s.includes("host") || s.includes("organizer")) return 2;
  if (
    s.includes("calendar") ||
    s.includes("365") ||
    s.includes("macaroni") ||
    s.includes("visit")
  ) {
    return 3;
  }
  if (s.includes("facebook")) return 4;
  return 5;
}

export const STRUCTURED_BLOCK_START = "--- Family Event Finder ---";
export const STRUCTURED_BLOCK_END = "--- End Family Event Finder ---";
