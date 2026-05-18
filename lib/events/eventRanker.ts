import type { DailyWebEvent } from "@/lib/events/dailyWebEventDiscoverySchema";
import { extractSourceDomain } from "@/lib/events/eventDeduper";

const OFFICIAL_DOMAINS = new Set([
  "sacramento365.com",
  "visitsacramento.com",
  "visitplacer.com",
  "calexpo.com",
  "cityofsacramento.gov",
  "roseville.ca.us",
  "rocklin.ca.us",
  "folsom.ca.us",
  "elkgrovecity.org",
  "library.cityofsacramento.org",
  "saclibrary.org",
  "placer.ca.gov",
  "eventbrite.com",
]);

const FAMILY_TERMS = [
  "family",
  "kid",
  "kids",
  "children",
  "child",
  "storytime",
  "toddler",
  "youth",
  "teen",
  "festival",
  "farmers market",
  "museum",
  "library",
  "free",
];

const VAGUE_TITLE = ["event", "festival", "show", "activities"];

function daysUntil(eventDate: string, todayYmd: string): number {
  const e = new Date(`${eventDate}T12:00:00Z`).getTime();
  const t = new Date(`${todayYmd}T12:00:00Z`).getTime();
  return Math.round((e - t) / 86_400_000);
}

function hasConfirmedTime(event: DailyWebEvent): boolean {
  return Boolean(event.start_datetime?.trim());
}

function hasConfirmedLocation(event: DailyWebEvent): boolean {
  return Boolean(
    event.location_name?.trim() ||
      event.street_address?.trim() ||
      (event.city?.trim() && event.region?.trim()),
  );
}

function isOfficialSource(event: DailyWebEvent): boolean {
  const domain =
    extractSourceDomain(event.source_url) || extractSourceDomain(event.event_url);
  if (OFFICIAL_DOMAINS.has(domain)) return true;
  return (
    event.source_name.toLowerCase().includes("official") ||
    domain.endsWith(".gov") ||
    domain.endsWith(".org")
  );
}

function familyRelevanceScore(event: DailyWebEvent): number {
  const text = `${event.event_title} ${event.event_description} ${event.why_family_friendly} ${event.event_category}`.toLowerCase();
  let score = 0;
  for (const term of FAMILY_TERMS) {
    if (text.includes(term)) score += 1;
  }
  if (event.why_family_friendly.trim().length > 20) score += 2;
  return score;
}

function isFreeOrLowCost(event: DailyWebEvent): boolean {
  const cost = event.cost.toLowerCase();
  return (
    cost.includes("free") ||
    cost === "$0" ||
    cost.includes("no cost") ||
    cost.includes("donation")
  );
}

export function scoreDailyWebEvent(
  event: DailyWebEvent,
  todayYmd: string,
): number {
  let score = event.confidence_score * 10;

  score += familyRelevanceScore(event) * 8;

  if (hasConfirmedTime(event)) score += 25;
  else score -= 20;

  if (hasConfirmedLocation(event)) score += 25;
  else score -= 25;

  if (isOfficialSource(event)) score += 30;

  const days = daysUntil(event.event_date, todayYmd);
  if (days <= 0) score += 20;
  else if (days <= 1) score += 18;
  else if (days <= 3) score += 12;
  else if (days <= 7) score += 6;

  if (isFreeOrLowCost(event)) score += 10;

  if (event.calendar_ready === "yes") score += 15;
  else if (event.calendar_ready === "needs_review") score += 5;
  else score -= 10;

  const titleWords = event.event_title.trim().split(/\s+/).length;
  if (titleWords <= 2 && VAGUE_TITLE.some((v) => event.event_title.toLowerCase() === v)) {
    score -= 25;
  }

  if (event.missing_fields.length > 4) score -= event.missing_fields.length * 3;

  if (event.confidence_score >= 8) score += 10;

  return score;
}

export function rankDailyWebEvents(
  events: DailyWebEvent[],
  todayYmd: string,
): DailyWebEvent[] {
  return [...events].sort(
    (a, b) => scoreDailyWebEvent(b, todayYmd) - scoreDailyWebEvent(a, todayYmd),
  );
}

export const __testing = {
  scoreDailyWebEvent,
  isOfficialSource,
  hasConfirmedTime,
  hasConfirmedLocation,
};
