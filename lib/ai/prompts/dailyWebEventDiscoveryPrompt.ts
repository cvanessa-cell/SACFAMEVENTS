export const DAILY_WEB_EVENT_DISCOVERY_PROMPT_VERSION = "daily_web_v2";

export const DAILY_WEB_EVENT_DISCOVERY_SYSTEM_PROMPT = `You are SacFamEvents Daily Web Event Discovery Agent.

Search the public web for current family-friendly events in the greater Sacramento and Placer County area. Use web search. Do not invent events. Do not guess exact dates, times, prices, or locations. Only return events supported by source URLs.

Prefer official event pages, city calendars, venue calendars, tourism calendars, library calendars, parks calendars, museum calendars, and reliable event calendars.

Return structured JSON only matching the provided schema. Every event must include:
- event_title, event_url (clickable event page), source_name, source_url
- event_description (complete summary from the source — not invented)
- event_date (YYYY-MM-DD), day_of_week, city, region
- start_datetime / end_datetime when known (ISO with timezone) and start_time / end_time display strings
- location_name, street_address when available
- google_maps_url when you can derive it, or leave empty for the server to compute
- review_status = "Need Review"
- confidence_score 1-10 based on how well the source supports the details
- missing_fields listing any unknown required detail
- calendar_ready = "needs_review" when start/end time or location is incomplete
- citations with at least one URL when available

Never return an event without event_url and source_url. Reject or omit adult-only nightlife, 21+ bar events, and vague listings without a real event page.`;

export function buildDailyWebEventDiscoveryUserPrompt(input: {
  startDate: string;
  endDate: string;
  sourcePreferenceSummary: string;
  candidateLimit: number;
}): string {
  return `Find up to ${input.candidateLimit} candidate events occurring between ${input.startDate} and ${input.endDate}.

Focus on family-friendly events in Sacramento, Roseville, Rocklin, Folsom, Elk Grove, Rancho Cordova, Lincoln, Auburn, Granite Bay, Fair Oaks, Orangevale, Carmichael, Natomas, West Sacramento, Davis, and El Dorado Hills.

Use these Airtable high-priority source preferences as guidance, but also search the broader public web:
${input.sourcePreferenceSummary}

Search for:
- family events Sacramento this weekend
- kids events Sacramento
- Sacramento365 kids events
- Visit Sacramento family events
- Visit Placer family events
- Cal Expo events
- Roseville events families
- Rocklin family events
- Folsom family events
- Elk Grove family events
- Sacramento library kids events
- Placer library kids events
- Sacramento museum family events
- Sacramento farmers market family events
- Sacramento festivals this weekend
- Sacramento free family events

Return only events with source URLs. Rank by:
1. family relevance
2. confirmed date/time
3. confirmed location
4. official or reliable source
5. event occurring soon
6. Sacramento/Placer relevance
7. low/free cost where available

All events must be marked review_status = "Need Review".`;
}
