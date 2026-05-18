/**
 * @vitest-environment jsdom
 */
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { EventTitleLink } from "@/components/EventTitleLink";
import { EventDetailFields } from "@/components/EventDetailFields";
import type { FamilyEvent } from "@/lib/validation";

const baseEvent: FamilyEvent = {
  eventName: "Storytime at the Library",
  date: "2026-05-20",
  dayOfWeek: "Wednesday",
  startTime: "10:00 AM",
  endTime: "11:00 AM",
  city: "Sacramento",
  venue: "Central Library",
  address: "828 I St",
  description: "Stories and songs for preschoolers.",
  eventLink: "https://saclibrary.org/events/storytime",
  sourceName: "Sacramento Public Library",
  sourceLink: "https://saclibrary.org/events",
  googleMapsLink:
    "https://www.google.com/maps/search/?api=1&query=828%20I%20St%2C%20Sacramento%2C%20CA",
  status: "Need Review",
};

describe("Event UI links", () => {
  it("renders clickable event title when event_url exists", () => {
    render(<EventTitleLink event={baseEvent} />);
    const link = screen.getByRole("link", { name: baseEvent.eventName });
    expect(link).toHaveAttribute("href", baseEvent.eventLink);
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });

  it("shows URL missing indicator when no event link", () => {
    render(<EventTitleLink event={{ ...baseEvent, eventLink: "" }} />);
    expect(screen.getByText(/URL missing/i)).toBeTruthy();
  });

  it("renders event website and Google Maps in detail fields", () => {
    render(<EventDetailFields event={baseEvent} compact />);
    expect(
      screen.getByRole("link", { name: /Open in Google Maps/i }),
    ).toHaveAttribute("href", baseEvent.googleMapsLink);
    expect(
      screen.getByRole("link", { name: baseEvent.eventLink! }),
    ).toHaveAttribute("href", baseEvent.eventLink);
    expect(screen.getAllByText(/Need Review/i).length).toBeGreaterThan(0);
  });
});
