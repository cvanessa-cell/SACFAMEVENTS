# SacFamEvents Daily Event Finder — MCP tools

App name: **SacFamEvents Daily Event Finder**

## Tools

### `discover_family_events`

Uses OpenAI web search to find family-friendly events. Returns ranked candidates with **clickable `event_url`** values and a **`discovery_run_id`** (stored in Postgres).

Does **not** write to Airtable.

### `save_discovered_events`

Requires:

- `discovery_run_id` from a prior discover call
- `eventIndexes` (1-based)
- `confirmSave: true`

Re-dedupes against Airtable, rejects missing URLs, writes **Need Review** only. Returns `saved`, `skipped`, `duplicate`, `rejected` buckets.

### `get_daily_event_discovery_status`

Returns configuration booleans and `mcpEndpointUrl` (no secrets).

### `list_recent_discovered_events`

Lists recent Airtable Family Events created by the daily automation (Notes marker).

## Required event fields

Discovery and Airtable mapping target:

- Event name/title, **event URL**, description
- Date, day of week, start/end time
- Location, address, city, **Google Maps URL**
- Source name, source URL
- Status: **Need Review**

## App UI

- **Grid/list:** clickable titles, date + day, times, description snippet, maps + source links, Need Review badge
- **Calendar:** month grid; titles open event URL; detail panel shows full fields

See `docs/DAILY_WEB_EVENT_DISCOVERY.md` for cron, admin API, and env vars.
