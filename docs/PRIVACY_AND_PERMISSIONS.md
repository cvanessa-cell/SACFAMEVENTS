# Privacy & least privilege

Principles reinforced across the codebase:

| Surface | Principle |
| --- | --- |
| Airtable | Store event metadata—not child personally identifiable information. |
| Google OAuth | Request `calendar.events` insert scope only; never sync entire personal history into Airtable. |
| OpenAI | Treat completions as probabilistic drafts; persist raw excerpts + citations. |
| Chrome extension | Host permissions pinned to Calendar + optional scripting pages; clipboard access avoided in MVP popup. |

## Storage model

Secrets stay server-side in `.env`/SQLite OAuth tables. Tokens never ship to browsers or Airtable public views.

### Screenshot etiquette

Screenshots capture marketing collateral, not attendee faces. Warn organizers before storing sensitive imagery.
