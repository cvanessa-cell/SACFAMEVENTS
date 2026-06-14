/**
 * Heuristic scoring for toddler / preschool relevance (roughly ages 2–6).
 * Used for ranking and public display — never fabricates age data.
 */

const TODDLER_TERMS = [
  "toddler",
  "toddlers",
  "preschool",
  "pre-k",
  "prek",
  "ages 2",
  "ages 3",
  "ages 4",
  "ages 5",
  "ages 6",
  "2-5",
  "2-6",
  "3-5",
  "3-6",
  "0-5",
  "baby lapsit",
  "lapsit",
  "storytime",
  "story time",
  "little ones",
  "young children",
  "early childhood",
];

const PRIORITY_FAMILY_EVENT_TERMS = [
  "live music",
  "concert",
  "bounce house",
  "inflatable",
  "carnival",
  "fair",
  "rides",
  "carousel",
  "train ride",
  "petting zoo",
  "block party",
  "neighborhood party",
  "game",
  "games",
  "festival",
  "parade",
  "farmers market",
  "movie in the park",
  "touch a truck",
];

const LATE_NIGHT_FAMILY_TERMS = [
  "movie night",
  "movie in the park",
  "evening",
  "night at the museum",
  "glow",
  "fireworks",
  "sunset",
];

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

function normalize(text: string): string {
  return text.trim().toLowerCase();
}

function haystack(input: {
  title?: string | null;
  description?: string | null;
  ageRange?: string | null;
  category?: string | null;
}): string {
  return normalize(
    [input.title, input.description, input.ageRange, input.category]
      .filter(Boolean)
      .join(" "),
  );
}

/** 0–1 score for ages ~2–6 relevance. Higher = better toddler/preschool fit. */
export function scoreToddlerRelevance(input: {
  title?: string | null;
  description?: string | null;
  ageRange?: string | null;
  category?: string | null;
}): number {
  const text = haystack(input);
  if (!text) return 0;

  let hits = 0;
  for (const term of TODDLER_TERMS) {
    if (text.includes(term)) hits += 1;
  }

  if (hits === 0) return 0;
  return Math.min(1, 0.25 + hits * 0.15);
}

/** Boost for priority SacFam event types (music, rides, festivals, etc.). */
export function scorePriorityEventTypes(input: {
  title?: string | null;
  description?: string | null;
  category?: string | null;
}): number {
  const text = haystack(input);
  if (!text) return 0;

  let hits = 0;
  for (const term of PRIORITY_FAMILY_EVENT_TERMS) {
    if (text.includes(term)) hits += 1;
  }
  return hits;
}

/** True when event looks like family-friendly evening programming (not adult nightlife). */
export function isLateNightFamilyFriendly(input: {
  title?: string | null;
  description?: string | null;
  startHourLocal?: number | null;
}): boolean {
  const text = haystack(input);
  if (ADULT_NIGHTLIFE.some((term) => text.includes(term))) return false;

  const eveningByText = LATE_NIGHT_FAMILY_TERMS.some((term) => text.includes(term));
  const eveningByHour =
    typeof input.startHourLocal === "number" && input.startHourLocal >= 17;

  return eveningByText || eveningByHour;
}

export function isLikelyAdultOnly(input: {
  title?: string | null;
  description?: string | null;
  category?: string | null;
}): boolean {
  const text = haystack(input);
  return ADULT_NIGHTLIFE.some((term) => text.includes(term));
}

export const __testing = {
  TODDLER_TERMS,
  PRIORITY_FAMILY_EVENT_TERMS,
};
