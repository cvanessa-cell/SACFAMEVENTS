# Daily Web Event Discovery

SacFamEvents uses **OpenAI web search** (Responses API `web_search` tool) to discover new family-friendly events across the Sacramento / Placer region. Airtable is used for source preferences, deduplication, and storage — not as the only URL list to fetch.

## ChatGPT connector (MCP)

Deploy the app and connect ChatGPT to **`https://YOUR_DOMAIN/mcp`**. See:

- [SACFAM_OPENAI_APP_ACCOUNT_SETUP.md](./SACFAM_OPENAI_APP_ACCOUNT_SETUP.md)
- [SACFAM_OPENAI_APP_EVENT_FINDER.md](./SACFAM_OPENAI_APP_EVENT_FINDER.md)
- Run `npm run openai-app:setup` for the MCP URL and env checklist

## Event URLs and review UI

- Every saved event must include a real **event URL** and **source URL**; events without URLs are rejected.
- In the app **grid/list** and **calendar** views, the event title links to the event page (`target="_blank"`, `rel="noopener noreferrer"`). Missing URLs show a “URL missing — needs review” indicator.
- Event details show description, date, day of week, start/end time, location, **Google Maps** link, website URL, source URL, and status.
- All new records are **Need Review** — not auto-published and not added to Google Calendar from this workflow.

## How it works

1. Read high-priority rows from **Family Event Sources** (names, domains, cities).
2. Build a search plan and call OpenAI with structured JSON output (Zod schema).
3. Validate candidates (source URL required, date within today → +14 days).
4. Deduplicate against existing **Family Events** in the same window.
5. Rank by family relevance, official sources, date proximity, and completeness.
6. Select the best **9** events.
7. Write to Airtable with **Status = Need Review** (unless dry run).

Events are **not** auto-published and **not** added to Google Calendar.

## Environment variables

| Variable | Default | Purpose |
| --- | --- | --- |
| `SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED` | `false` | Master switch |
| `SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN` | `true` | Preview only; no Airtable writes |
| `SACFAM_DAILY_EVENT_LIMIT` | `9` | Max events per run (capped at 9) |
| `SACFAM_DAILY_EVENT_LOOKAHEAD_DAYS` | `14` | Forward date window |
| `OPENAI_DAILY_EVENT_MODEL` | `gpt-5.5` | Model for web search |
| `OPENAI_API_KEY` | — | Required when enabled |
| `AIRTABLE_API_KEY` / `AIRTABLE_BASE_ID` | — | Required when enabled |
| `AIRTABLE_FAMILY_EVENTS_TABLE` | `Family Events` | Write target |
| `AIRTABLE_FAMILY_EVENT_SOURCES_TABLE` | `Family Event Sources` | Preference read |
| `CRON_SECRET` | — | Protects cron + admin POST API |

## Dry run

When `SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN=true`:

- OpenAI still runs (cost applies).
- Summary JSON includes `selectedEvents`.
- **No** Airtable records are created.

Use the admin page **Run Web Discovery Dry Run** or:

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"dryRun":true}' \
  https://your-app.vercel.app/api/admin/events/discover-web-daily
```

## Deploy with Vercel Cron

`vercel.json` schedules:

```json
{ "path": "/api/cron/discover-web-events", "schedule": "0 14 * * *" }
```

`0 14 * * *` UTC is approximately **6:00 AM Pacific** during standard time and **7:00 AM** during daylight saving time. Adjust the schedule if you need a fixed local time year-round.

Set `CRON_SECRET` in Vercel project settings. Vercel sends `Authorization: Bearer <CRON_SECRET>` automatically.

## Disable

Set `SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED=false` and redeploy, or remove the cron entry from `vercel.json`.

## Review new records

1. Open Airtable **Family Events** or admin **Review queue** (`/admin/event-review`).
2. Filter **Status = Need Review**.
3. Notes include: `Added by daily OpenAI web event discovery automation…`
4. Verify event URL, date/time, location, and cost before setting **Confirmed** or exporting to Google Calendar.

## Admin UI

`/admin/events/web-discovery` — status, dry-run controls, manual run buttons, last summary.

## API routes

| Route | Method | Auth |
| --- | --- | --- |
| `/api/admin/events/discover-web-daily` | GET | None (config only) |
| `/api/admin/events/discover-web-daily` | POST | `Bearer CRON_SECRET` |
| `/api/cron/discover-web-events` | GET/POST | `Bearer CRON_SECRET` |

## Why not auto-publish?

Web search can surface stale, duplicate, or loosely family-related listings. Human review keeps the public calendar trustworthy and avoids incorrect Google Calendar entries.
