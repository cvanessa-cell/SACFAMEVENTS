import { eventExtractionSchema } from "@/lib/events/eventExtractionSchema";

const sample = {
  source_summary: "Sample source update",
  new_events: [
    {
      title: "Kids Story Time",
      description: null,
      venue_name: "Main Library",
      address: "123 Main St",
      city: "Sacramento",
      county: "Sacramento",
      start_datetime: "2026-06-01T17:00:00-07:00",
      end_datetime: "2026-06-01T18:00:00-07:00",
      timezone: "America/Los_Angeles",
      age_range: "3-8",
      price_text: "Free",
      registration_url: null,
      source_event_url: "https://example.com/event/1",
      family_friendly_score: 0.95,
      confidence: 0.91,
      needs_human_review: false,
      reasoning_summary: "All major fields present.",
    },
  ],
  updated_events: [],
  cancelled_events: [],
  irrelevant_content: [],
  warnings: [],
};

function main() {
  const parsed = eventExtractionSchema.parse(sample);
  console.log(`Schema validation passed for ${parsed.new_events.length} sample event(s).`);
}

main();
