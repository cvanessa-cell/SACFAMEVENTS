/**
 * Facebook public-page URL helpers.
 *
 * Facebook actively blocks direct HTTP scraping (returns 400 to any non-browser
 * client and shows an unsupported-browser interstitial on mbasic). We rely on
 * Firecrawl's headless browser API to fetch the content — see
 * `lib/events/firecrawlFetcher.ts`.
 *
 * This module just normalizes Facebook URLs into the "/events" listing URL
 * before handing them to Firecrawl.
 */

const PAGE_URL_RE =
  /^https?:\/\/(?:www\.|m\.|web\.|mbasic\.)?facebook\.com\/([A-Za-z0-9.\-_]+)\/?(?:\?.*)?$/i;

const EVENTS_PATH_RE =
  /^https?:\/\/(?:www\.|m\.|web\.|mbasic\.)?facebook\.com\/(.+?)\/(events|upcoming_hosted_events)\/?(?:\?.*)?$/i;

const PROFILE_ID_RE =
  /^https?:\/\/(?:www\.|m\.|web\.|mbasic\.)?facebook\.com\/profile\.php\?id=(\d+)/i;

/**
 * Returns the best `www.facebook.com/{handle}/events` URL for a given Facebook
 * page URL. Returns `null` if the input doesn't look like a Facebook page.
 */
export function toFacebookEventsUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  const eventsMatch = trimmed.match(EVENTS_PATH_RE);
  if (eventsMatch) {
    const handle = eventsMatch[1];
    return `https://www.facebook.com/${handle}/events`;
  }

  const profileMatch = trimmed.match(PROFILE_ID_RE);
  if (profileMatch) {
    return `https://www.facebook.com/profile.php?id=${profileMatch[1]}&sk=events`;
  }

  const pageMatch = trimmed.match(PAGE_URL_RE);
  if (pageMatch) {
    const handle = pageMatch[1];
    if (handle === "profile.php" || handle === "events") return null;
    return `https://www.facebook.com/${handle}/events`;
  }

  return null;
}
