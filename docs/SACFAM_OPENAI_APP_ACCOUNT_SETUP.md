# SacFamEvents Daily Event Finder — ChatGPT account setup

Cursor can build and deploy the MCP server. **Cursor cannot create the connector inside your OpenAI account** unless OpenAI ships an official API/CLI for connector creation (none documented as of the Apps SDK quickstart).

## Prerequisites

1. Deploy this repo to Vercel (or similar) with HTTPS.
2. Set environment variables (see `.env.example`), including:
   - `SACFAM_OPENAI_APP_ENABLED=true`
   - `SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED=true`
   - `OPENAI_API_KEY`, `AIRTABLE_API_KEY`, `AIRTABLE_BASE_ID=app0tfryJgq6BAUJJ`
   - `PUBLIC_APP_BASE_URL=https://your-production-domain` (no trailing slash)
   - `DATABASE_URL` (for `OpenAiAppDiscoveryRun` persistence)
3. Run database migration for `OpenAiAppDiscoveryRun`.
4. Run locally: `npm run openai-app:setup` to print your MCP URL and checklist.

## MCP URL

```text
https://YOUR_DOMAIN/mcp
```

Example after deploy: `https://sacramento-family-event-finder.vercel.app/mcp`

## Manual connector steps (required)

1. Open [ChatGPT](https://chatgpt.com/) → **Settings** → **Apps & Connectors** → **Advanced** → enable **Developer mode**.
2. Go to **Settings** → **Connectors** → **Create** (or Developer Mode → **Create app**).
3. Paste your HTTPS MCP URL: `https://YOUR_DOMAIN/mcp`
4. **Name:** `SacFamEvents Daily Event Finder`
5. **Description:** `Finds Sacramento-area family events using OpenAI web search and saves reviewed candidates to Airtable.`
6. Save and open a **new chat**.
7. Add the connector from the **More** menu (+).
8. Test:
   - `discover_family_events` with `dryRun: true` for Sacramento
   - Note the `discovery_run_id` in the response
   - `save_discovered_events` with that id, `eventIndexes: [1,2,3]`, `confirmSave: true`

## Security notes

- The MCP endpoint must be reachable on the public internet for ChatGPT.
- **v1:** Anyone with the URL could invoke tools. Mitigations: `confirmSave`, `discovery_run_id`, feature flags, save-time dedupe, Need Review only.
- **v2:** Add OAuth or bearer auth if you share the connector beyond your personal account.

## Event quality rules

- Every saved event must have a real **event URL** and **source URL**.
- Events are stored as **Need Review** — verify in Airtable before publishing or calendar export.
- In the app, event titles link to the event page; locations link to Google Maps.
