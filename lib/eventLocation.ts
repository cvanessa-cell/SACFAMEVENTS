const DEFAULT_STATE = "CA";

export function buildGoogleMapsSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "";
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

/** Normalize region text to a US state abbreviation when possible. */
export function normalizeUsState(region?: string): string {
  const r = region?.trim() ?? "";
  if (!r) return DEFAULT_STATE;
  if (/^ca$/i.test(r) || /california/i.test(r)) return "CA";
  if (r.length === 2 && /^[A-Za-z]{2}$/.test(r)) return r.toUpperCase();
  return DEFAULT_STATE;
}

/**
 * Build a Google Maps search query using priority:
 * 1. street_address + city + state
 * 2. location_name + city + state
 * 3. city + state only
 */
export function buildGoogleMapsLocationQuery(parts: {
  street_address?: string;
  location_name?: string;
  city?: string;
  region?: string;
  state?: string;
}): string {
  const state = parts.state?.trim() || normalizeUsState(parts.region);
  const city = parts.city?.trim() ?? "";
  const street = parts.street_address?.trim() ?? "";
  const locationName = parts.location_name?.trim() ?? "";

  if (street && city) return `${street}, ${city}, ${state}`;
  if (locationName && city) return `${locationName}, ${city}, ${state}`;
  if (city) return `${city}, ${state}`;
  return "";
}

export function buildGoogleMapsUrlFromParts(parts: {
  street_address?: string;
  location_name?: string;
  city?: string;
  region?: string;
  state?: string;
}): string {
  const query = buildGoogleMapsLocationQuery(parts);
  return query ? buildGoogleMapsSearchUrl(query) : "";
}

/** Day name from YYYY-MM-DD in the app timezone (e.g. Saturday). */
export function computeDayOfWeekFromYmd(
  ymd: string,
  timeZone = "America/Los_Angeles",
): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(ymd.trim())) return "";
  const dt = new Date(`${ymd.trim()}T12:00:00`);
  if (Number.isNaN(dt.getTime())) return "";
  return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone }).format(dt);
}

/** Extract display time (e.g. 10:00 AM) from ISO datetime in local tz. */
export function extractDisplayTimeFromDatetime(
  isoLike: string,
  timeZone = "America/Los_Angeles",
): string {
  const s = isoLike?.trim() ?? "";
  if (!s) return "";
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  });
}

export function computeDayOfWeekForFamilyEvent(
  dateYmd: string,
  timeZone = "America/Los_Angeles",
): string {
  return computeDayOfWeekFromYmd(dateYmd, timeZone);
}
