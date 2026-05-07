# Google Calendar export format

## Title pattern

```
[CATEGORY PREFIX] Event Name - City
```

Controlled by `calendarTitleForEvent()` in `lib/eventFormatting.ts`.

## Description anatomy

A short human-readable intro is followed by a structured block guarded by markers:

```
--- Family Event Finder ---
Event Name:
Category:
Age Range:
...
--- End Family Event Finder ---
```

`formatCalendarDescriptionStructured()` ensures parity between Airtable, Google descriptions, and the Chrome helper.

## Limits & transparency

Calendar’s hosted UI cannot show arbitrary branded fields—lean on the footer block + Chrome extension overlays for screenshots, Airtable IDs, reminders, maps, registration flags, etc.

## Reminders

Reminder preference values travel from Airtable → export payload (`calendarExportPayloadSchema`) → future Google inserts (Milestone 4).
