import {
  buildGoogleMapsLocationQuery,
  buildGoogleMapsSearchUrl,
  buildGoogleMapsUrlFromParts,
} from "@/lib/eventLocation";

export { buildGoogleMapsSearchUrl, buildGoogleMapsLocationQuery, buildGoogleMapsUrlFromParts };

export function mapsLinkFromEventParts(parts: {
  address?: string;
  venue?: string;
  city?: string;
  region?: string;
}): string {
  return buildGoogleMapsUrlFromParts({
    street_address: parts.address,
    location_name: parts.venue,
    city: parts.city,
    region: parts.region,
  });
}
