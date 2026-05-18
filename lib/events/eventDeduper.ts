import type { DailyWebEvent } from "@/lib/events/dailyWebEventDiscoverySchema";

export interface DuplicateKeyInput {
  event_title: string;
  event_date: string;
  city: string;
  source_url: string;
  event_url?: string;
}

const ADULT_NIGHTLIFE = [
  "21+",
  "bar crawl",
  "nightclub",
  "night club",
  "cocktail",
  "wine tasting",
  "brewery tour",
  "casino",
];

function normalizeText(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSourceDomain(url: string): string {
  const trimmed = url.trim();
  if (!trimmed) return "";
  try {
    const host = new URL(trimmed.startsWith("http") ? trimmed : `https://${trimmed}`)
      .hostname;
    return host.replace(/^www\./, "").toLowerCase();
  } catch {
    return "";
  }
}

export function buildDuplicateKey(input: DuplicateKeyInput): string {
  const title = normalizeText(input.event_title);
  const day = input.event_date.trim().slice(0, 10);
  const city = normalizeText(input.city || "");
  const domain =
    extractSourceDomain(input.source_url) ||
    extractSourceDomain(input.event_url ?? "");
  return `${title}|${day}|${city}|${domain}`;
}

export function isLikelyAdultOnly(event: DailyWebEvent): boolean {
  const haystack = `${event.event_title} ${event.event_description} ${event.event_category}`.toLowerCase();
  return ADULT_NIGHTLIFE.some((term) => haystack.includes(term));
}

export function dedupeEvents(
  candidates: DailyWebEvent[],
  existingKeys: Set<string>,
): {
  unique: DailyWebEvent[];
  duplicatesSkipped: Array<{ event: DailyWebEvent; reason: string; key: string }>;
} {
  const seen = new Set(existingKeys);
  const unique: DailyWebEvent[] = [];
  const duplicatesSkipped: Array<{
    event: DailyWebEvent;
    reason: string;
    key: string;
  }> = [];

  for (const event of candidates) {
    const key = buildDuplicateKey(event);
    if (seen.has(key)) {
      duplicatesSkipped.push({
        event,
        reason: seen.has(key) && existingKeys.has(key) ? "existing_airtable" : "duplicate_candidate",
        key,
      });
      continue;
    }
    if (isLikelyAdultOnly(event)) {
      duplicatesSkipped.push({ event, reason: "adult_only", key });
      continue;
    }
    seen.add(key);
    unique.push(event);
  }

  return { unique, duplicatesSkipped };
}
