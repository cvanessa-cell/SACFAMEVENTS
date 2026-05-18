# OpenAI App Automation Plan — SacFamEvents Daily Event Finder

## What can be automated

- MCP server at `/mcp` with four tools (discover, save, status, list recent)
- OpenAI Responses API web search + structured JSON discovery
- Postgres-backed `discovery_run_id` for serverless discover→save (no in-memory sessions)
- Airtable writes as **Need Review** only (no publish, no Google Calendar)
- Vercel cron + admin API/UI for daily discovery
- Setup script: `npm run openai-app:setup`
- Event UI: clickable titles, Google Maps links, full detail fields

## What cannot be automated

- Creating the ChatGPT connector inside your OpenAI account (UI-only per [Apps SDK quickstart](https://developers.openai.com/apps-sdk/quickstart))
- Browser automation of ChatGPT settings

## Persistence: discover → save

**Do not use in-memory session stores on Vercel.**

`discover_family_events` creates a row in `OpenAiAppDiscoveryRun` (Prisma/Postgres) and returns `discovery_run_id`.

`save_discovered_events` requires `discovery_run_id`, `eventIndexes`, and `confirmSave: true`.

## MCP security (v1 / v2)

**v1:** `/mcp` is public HTTPS for ChatGPT. Writes require `confirmSave`, valid `discovery_run_id`, feature flags, and save-time re-validation. Treat the MCP URL like a secret capability link.

**v2 (follow-up):** MCP OAuth, optional bearer token, rate limits, `readOnlyHint` on read tools — see `docs/SACFAM_OPENAI_APP_ACCOUNT_SETUP.md`.

## Event URL and UI requirements

Every saved event must include `event_url` and `source_url`. The app shows:

- Clickable event titles (`target="_blank"`, `rel="noopener noreferrer"`)
- Google Maps links from address/venue/city priority
- Full detail: description, date, day of week, times, location, source, status

## Files added

- `app/mcp/route.ts`
- `lib/openai-app/*` (env, MCP tools, discovery run repo, register tools)
- `lib/eventLocation.ts`, `lib/events/dailyWebEventEnrichment.ts`
- `components/EventTitleLink.tsx`, `components/EventDetailFields.tsx`, `components/EventsCalendarView.tsx`
- `prisma/migrations/20260517120000_openai_app_discovery_run/`
- `scripts/print-openai-app-setup.ts`
- `docs/SACFAM_OPENAI_APP_ACCOUNT_SETUP.md`, `docs/SACFAM_OPENAI_APP_EVENT_FINDER.md`

## Rollback

1. Set `SACFAM_OPENAI_APP_ENABLED=false`
2. Remove/disable connector in ChatGPT
3. Revert `app/mcp` and `lib/openai-app` if needed (cron/admin discovery unaffected)

## Testing

- `npm test` — schema, maps, save guards, UI links, MCP status
- `npm run lint`
- `npm run build`
- Manual: MCP Inspector → deploy → ChatGPT connector
