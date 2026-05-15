# SacFam OpenAI + Airtable Source Workflow

This workflow helps SacFamEvents build and review a high-quality source database for Sacramento-area family events. OpenAI proposes structured source candidates, the server validates and deduplicates them, Airtable stores human-review records, and admins approve only trusted sources into the approved source catalog.

## What It Does

1. An admin starts source research from `/admin/sources/research` or `POST /api/admin/sources/research`.
2. The server calls OpenAI Responses API with structured output validation.
3. Valid source candidates are deduplicated against existing Prisma and Airtable sources.
4. Candidates are saved to Prisma as a local audit mirror and to Airtable `Source Candidates` when Airtable writes are enabled.
5. Admins review candidates in `/admin/sources/candidates`.
6. Approval promotes a candidate into Prisma `EventSource` and Airtable `Event Sources`.

The workflow never auto-approves candidates by default.

## Required Environment Variables

```env
OPENAI_API_KEY=
OPENAI_SOURCE_RESEARCH_MODEL=
AIRTABLE_API_KEY=
AIRTABLE_BASE_ID=
AIRTABLE_EVENT_SOURCES_TABLE="Event Sources"
AIRTABLE_SOURCE_RESEARCH_RUNS_TABLE="Source Research Runs"
AIRTABLE_SOURCE_CANDIDATES_TABLE="Source Candidates"
AIRTABLE_EVENT_CANDIDATES_TABLE="Event Candidates"
SACFAM_AI_SOURCE_AGENT_ENABLED=true
SACFAM_AIRTABLE_WRITE_ENABLED=true
SACFAM_SOURCE_AGENT_DRY_RUN=true
SACFAM_SOURCE_AGENT_MAX_SOURCES=125
SACFAM_SOURCE_RESEARCH_PRISMA_MIRROR=true
```

Missing OpenAI or Airtable credentials do not crash the app. Admin-facing pages and routes return clear disabled/configuration messages.

## Airtable Setup

Create a base named `SacFamEvents Source Database` with the tables and fields in `docs/SACFAM_AIRTABLE_SCHEMA.md`.

The important tables are:

- `Event Sources`: approved source catalog.
- `Source Research Runs`: audit trail for each AI run.
- `Source Candidates`: proposed sources awaiting admin review.
- `Event Candidates`: future event-monitoring review queue.

## How OpenAI Is Used

The source research service uses the OpenAI Responses API from server-side code only. It asks for structured JSON shaped like:

- `project`
- `purpose`
- `target_region`
- `source_count`
- `sources`
- `warnings`

Each source is validated before storage. Invalid source records are summarized on the run and skipped without failing otherwise valid records.

## How Airtable Is Used

The backend uses the Airtable Web API for reliable writes. Records are created in batches of 10 or fewer. `SACFAM_AIRTABLE_WRITE_ENABLED=false` disables Airtable writes while keeping the Prisma audit mirror available.

Airtable MCP is optional and documented in `docs/SACFAM_AIRTABLE_MCP_WORKFLOW.md`.

## Running Source Research

Admin UI:

1. Open `/admin/sources/research`.
2. Confirm the OpenAI and Airtable status badges.
3. Enter a source count, up to `SACFAM_SOURCE_AGENT_MAX_SOURCES`.
4. Click `Run AI source research`.

API:

```bash
curl -X POST "$APP_BASE_URL/api/admin/sources/research" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{"requestedSourceCount":125,"targetRegion":"Sacramento / Placer"}'
```

## Reviewing Candidates

Open `/admin/sources/candidates`. Filter by category, review priority, verification status, automation fit, or duplicate status.

Actions:

- Approve: blocked while `SACFAM_SOURCE_AGENT_DRY_RUN=true`.
- Reject: marks the candidate rejected in Prisma and Airtable.
- Open Source URL: manual verification.

## Approved Sources

Open `/admin/sources` to view Airtable `Event Sources`. The default view shows approved sources. The Automation Ready view highlights sources with `automation_fit` values of `excellent` or `good`.

## Dry-Run Mode

When `SACFAM_SOURCE_AGENT_DRY_RUN=true`:

- Research runs still save candidates.
- Candidates remain proposed or pending review.
- Approval/import into Prisma `EventSource` and Airtable `Event Sources` is blocked.

## Safety and Privacy Limits

- Do not invent fake URLs or organizations.
- Do not mark uncertain sources as verified.
- Avoid private groups, login-only sources, paywalled pages, and sources that cannot be reviewed publicly.
- Respect website terms, robots.txt, platform rules, and API limits.
- Store only the safe raw response preview needed for debugging.

## Future Event Monitoring

The event-monitoring prompt and schema are prepared for future use. Event candidates must list missing fields and should only be `calendar_ready=yes` when title, date/time, location, and source URL are sufficient for review/export.
