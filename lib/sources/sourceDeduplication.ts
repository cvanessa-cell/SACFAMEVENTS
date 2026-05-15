/**
 * Source deduplication helpers.
 *
 * Normalize URL + name, then compare against a list of existing operational
 * EventSource rows. Returns whether a candidate is a likely duplicate and an
 * optional `existingSourceId` to link with.
 */

const TRACKING_PARAM_PREFIXES = ["utm_", "mc_", "fb_"];
const TRACKING_PARAM_NAMES = new Set([
  "gclid",
  "fbclid",
  "igshid",
  "ref",
  "ref_src",
  "ref_url",
  "share",
  "share_id",
]);

export function normalizeUrl(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    // Fall back to a best-effort lowercase + strip trailing slashes
    return trimmed.toLowerCase().replace(/\/+$/, "");
  }
  parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
  parsed.hash = "";
  const keepParams: Array<[string, string]> = [];
  parsed.searchParams.forEach((value, key) => {
    const lower = key.toLowerCase();
    if (TRACKING_PARAM_NAMES.has(lower)) return;
    if (TRACKING_PARAM_PREFIXES.some((p) => lower.startsWith(p))) return;
    keepParams.push([key, value]);
  });
  parsed.search = "";
  keepParams.forEach(([key, value]) => {
    parsed.searchParams.append(key, value);
  });
  let pathname = parsed.pathname.replace(/\/+$/, "");
  if (pathname === "") pathname = "/";
  parsed.pathname = pathname;
  return parsed.toString().toLowerCase().replace(/\/$/, "");
}

export function normalizeSourceName(input: string): string {
  return (input ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizedDomain(input: string): string {
  const trimmed = (input ?? "").trim();
  if (!trimmed) return "";
  try {
    return new URL(trimmed).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return trimmed
      .toLowerCase()
      .replace(/^https?:\/\//, "")
      .split("/")[0]
      .replace(/^www\./, "");
  }
}

export function createDuplicateCheckKey(input: {
  sourceUrl: string;
  sourceName: string;
  cityOrAreaServed?: string | null;
}): string {
  const domain = normalizedDomain(input.sourceUrl);
  const name = normalizeSourceName(input.sourceName);
  const city = normalizeSourceName(input.cityOrAreaServed ?? "");
  return `${domain}|${name}|${city}`.toLowerCase();
}

export interface ExistingSourceForDedupe {
  id: string;
  name: string;
  sourceUrl: string;
  city?: string | null;
  category?: string | null;
}

export interface CandidateForDedupe {
  sourceName: string;
  sourceUrl: string;
  cityOrAreaServed?: string | null;
  sourceCategory?: string | null;
}

export type DedupeStrength = "none" | "weak" | "strong";

export interface DedupeResult {
  strength: DedupeStrength;
  existingSourceId?: string;
  reason?: string;
}

export function findLikelyDuplicate(
  candidate: CandidateForDedupe,
  existing: ExistingSourceForDedupe[],
): DedupeResult {
  const candidateUrl = normalizeUrl(candidate.sourceUrl);
  const candidateName = normalizeSourceName(candidate.sourceName);
  if (!candidateUrl && !candidateName) {
    return { strength: "none" };
  }
  for (const row of existing) {
    if (candidateUrl && normalizeUrl(row.sourceUrl) === candidateUrl) {
      return {
        strength: "strong",
        existingSourceId: row.id,
        reason: "matching_normalized_url",
      };
    }
  }
  const candidateKey = createDuplicateCheckKey({
    sourceUrl: candidate.sourceUrl,
    sourceName: candidate.sourceName,
    cityOrAreaServed: candidate.cityOrAreaServed,
  });
  for (const row of existing) {
    const rowKey = createDuplicateCheckKey({
      sourceUrl: row.sourceUrl,
      sourceName: row.name,
      cityOrAreaServed: row.city,
    });
    if (candidateKey && rowKey === candidateKey) {
      return {
        strength: "strong",
        existingSourceId: row.id,
        reason: "matching_duplicate_check_key",
      };
    }
  }
  for (const row of existing) {
    const rowName = normalizeSourceName(row.name);
    if (!rowName || !candidateName) continue;
    if (rowName === candidateName) {
      const sameCity =
        (candidate.cityOrAreaServed ?? "").toLowerCase().trim() ===
        (row.city ?? "").toLowerCase().trim();
      return {
        strength: sameCity ? "strong" : "weak",
        existingSourceId: row.id,
        reason: sameCity ? "matching_name_and_city" : "matching_name",
      };
    }
  }
  return { strength: "none" };
}
