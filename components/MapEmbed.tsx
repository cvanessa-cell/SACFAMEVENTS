import * as React from "react";

interface MapEmbedProps {
  /** Address-style query (street + city, or venue + city). */
  query: string;
  className?: string;
  height?: number;
  /** Open in a new tab on Google Maps. Always rendered. */
  openText?: string;
}

/**
 * Renders a Google Maps embed for an event location.
 *
 * Uses the public Maps Embed API key (`NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY`).
 * If the key isn't set we fall back to a plain "Open in Google Maps" link so the
 * UI degrades gracefully.
 */
export function MapEmbed({
  query,
  className,
  height = 200,
  openText = "Open in Google Maps",
}: MapEmbedProps) {
  const trimmed = query.trim();
  if (!trimmed) return null;
  const encoded = encodeURIComponent(trimmed);
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY?.trim();
  const externalLink = `https://www.google.com/maps/search/?api=1&query=${encoded}`;

  return (
    <div className={className}>
      {apiKey ? (
        <iframe
          title={`Map of ${trimmed}`}
          src={`https://www.google.com/maps/embed/v1/place?key=${apiKey}&q=${encoded}`}
          width="100%"
          height={height}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          allowFullScreen
          className="w-full rounded-md border"
          style={{ border: 0 }}
        />
      ) : (
        <div className="flex items-center justify-between gap-3 rounded-md border bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
          <span>
            Map preview unavailable — set{" "}
            <code>NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY</code> in <code>.env</code>.
          </span>
        </div>
      )}
      <div className="mt-1 text-xs">
        <a
          href={externalLink}
          target="_blank"
          rel="noreferrer"
          className="text-primary underline"
        >
          {openText}
        </a>
      </div>
    </div>
  );
}
