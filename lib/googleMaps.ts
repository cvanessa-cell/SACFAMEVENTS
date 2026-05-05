/**
 * Builds a Google Maps search URL suitable for calendars and browsers.
 */
export function buildGoogleMapsSearchUrl(query: string): string {
  const q = query.trim();
  if (!q) return "";
  const encoded = encodeURIComponent(q);
  return `https://www.google.com/maps/search/?api=1&query=${encoded}`;
}

export function mapsLinkFromEventParts(parts: {
  address?: string;
  venue?: string;
  city?: string;
}): string {
  const line = [parts.address, parts.venue, parts.city].filter(Boolean).join(" ");
  if (!line.trim()) return "";
  return buildGoogleMapsSearchUrl(line);
}
