import { EventsExplorer } from "@/components/EventsExplorer";
import type { Metadata } from "next";

export const metadata: Metadata = {
  description:
    "Browse family-friendly events from Airtable, export to Google Calendar, or forward selections via Zapier.",
};

export default function EventsPage() {
  return <EventsExplorer />;
}
