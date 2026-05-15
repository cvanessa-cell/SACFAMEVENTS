/**
 * Minimal iCalendar (.ics) parser. Extracts VEVENT components
 * into structured text without requiring a third-party dependency.
 */

export interface ICalEvent {
  uid: string;
  summary: string;
  description: string;
  dtstart: string;
  dtend: string;
  location: string;
  url: string;
  status: string;
}

export interface ICalResult {
  calendarName: string;
  events: ICalEvent[];
}

function unfoldLines(raw: string): string {
  return raw.replace(/\r\n[ \t]/g, "").replace(/\r/g, "");
}

function extractProperty(block: string, prop: string): string {
  const regex = new RegExp(
    `^${prop}(?:;[^:]*)?:(.*)$`,
    "mi",
  );
  const match = regex.exec(block);
  if (!match) return "";
  return match[1]
    .replace(/\\n/g, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\\\/g, "\\")
    .trim();
}

function extractVEvents(ical: string): string[] {
  const events: string[] = [];
  const regex = /BEGIN:VEVENT([\s\S]*?)END:VEVENT/gi;
  let match;
  while ((match = regex.exec(ical)) !== null) {
    events.push(match[1]);
  }
  return events;
}

function formatICalDate(raw: string): string {
  if (!raw) return "";
  const cleaned = raw.replace(/^TZID=[^:]*:/i, "");
  // 20260515T100000Z or 20260515T100000 or 20260515
  const m = /^(\d{4})(\d{2})(\d{2})(?:T(\d{2})(\d{2})(\d{2}))?/.exec(
    cleaned,
  );
  if (!m) return raw;
  const [, y, mo, d, h, mi, s] = m;
  if (h) return `${y}-${mo}-${d}T${h}:${mi}:${s}`;
  return `${y}-${mo}-${d}`;
}

function parseVEvent(block: string): ICalEvent {
  return {
    uid: extractProperty(block, "UID"),
    summary: extractProperty(block, "SUMMARY"),
    description: extractProperty(block, "DESCRIPTION"),
    dtstart: formatICalDate(extractProperty(block, "DTSTART")),
    dtend: formatICalDate(extractProperty(block, "DTEND")),
    location: extractProperty(block, "LOCATION"),
    url: extractProperty(block, "URL"),
    status: extractProperty(block, "STATUS") || "CONFIRMED",
  };
}

export function parseICal(raw: string): ICalResult {
  const unfolded = unfoldLines(raw);
  const calendarName =
    extractProperty(unfolded, "X-WR-CALNAME") || "Untitled Calendar";
  const veventBlocks = extractVEvents(unfolded);
  const events = veventBlocks.map(parseVEvent);

  return { calendarName, events };
}

export function icalEventsToText(result: ICalResult): string {
  const lines: string[] = [`Calendar: ${result.calendarName}`, ""];
  for (const ev of result.events) {
    lines.push(`Title: ${ev.summary}`);
    if (ev.dtstart) lines.push(`Start: ${ev.dtstart}`);
    if (ev.dtend) lines.push(`End: ${ev.dtend}`);
    if (ev.location) lines.push(`Location: ${ev.location}`);
    if (ev.url) lines.push(`URL: ${ev.url}`);
    if (ev.description)
      lines.push(`Description: ${ev.description.slice(0, 1000)}`);
    if (ev.status && ev.status !== "CONFIRMED")
      lines.push(`Status: ${ev.status}`);
    lines.push("---");
  }
  return lines.join("\n");
}
