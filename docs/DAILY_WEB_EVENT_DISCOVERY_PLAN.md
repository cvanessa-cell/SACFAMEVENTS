# Daily Web Event Discovery — Implementation Plan

## Existing project structure found

- **Framework:** Next.js 14 App Router (`app/` directory), TypeScript, Zod 4, Vitest.
- **Path alias:** `@/*` maps to repo root (code lives in `lib/`, not `src/lib/`).
- **Dual surfaces:** Public dashboard (`app/(dashboard)/`, port 3333) and admin operations console (`app/admin/`, port 3111).
- **Database:** Supabase Postgres via Prisma for ingestion jobs, source research runs, event candidates.
- **Canonical event store (human review):** Airtable base `FAMILY EVENTS` — tables documented in `docs/AIRTABLE_SCHEMA.md`.

## Existing Airtable integration found

| Module | Role |
| --- | --- |
| `lib/airtable.ts` | Core fetch/list/create for **Family Events** + `getAirtableConfig()` |
| `lib/airtable/airtableClient.ts` | Batched writes (10 records), workflow tables for AI source research |
| `lib/sources.ts` | Maps **Family Event Sources** rows to UI shape |
| `lib/airtable/eventSourceCatalogRepository.ts` | Newer "Event Sources" workflow table (separate from legacy Family Event Sources) |

**Family Events field mapping** (from `mapAirtableEventRecord` in `lib/airtable.ts`):

| Airtable column | App field |
| --- | --- |
| Event Name | eventName |
| Date / Start Date | date |
| Start Date / Time | startTime (derived) |
| End Date / Time | endTime |
| City | city |
| Venue / Location / Venue Text | venue |
| Address | address |
| Source Name | sourceName |
| Source Link / Source URL | sourceLink |
| Event Link / Event URL | eventLink |
| Age Range | ageRange |
| Cost | cost |
| Category | category |
| Description | description |
| Status | status (`Need Review`, etc.) |
| Confidence Score | confidenceScore |
| Kid-Friendly Notes | kidFriendlyNotes |

**Family Event Sources** (from `lib/sources.ts`): Source Name, Source Type, City/Area, Website, Source Link, Priority, Active, Notes.

## Existing OpenAI integration found

| Module | Pattern |
| --- | --- |
| `lib/ai/openaiClient.ts` | Graceful `tryGetAgentOpenAIClient()` — no throw when key missing |
| `lib/sources/sourceResearchService.ts` | `responses.create` + `zodTextFormat` structured output |
| `lib/sources/eventMonitorService.ts` | Same Responses API pattern (fetches source URL text, no web search) |
| `lib/openai/createEventExtractionJob.ts` | Background Responses jobs for source-change pipeline |

**OpenAI SDK:** `openai@^6.35.0` — supports `client.responses.create` with `tools: [{ type: "web_search" }]`.

## Existing admin pages

- `/admin/event-monitoring` — discovery health, run source checker
- `/admin/event-review` — Airtable Need Review queue
- `/admin/sources/research` — AI source research (OpenAI, no web search)
- Server actions in `app/admin/sacfamAgentActions.ts`

## Existing cron setup

- `vercel.json` crons: `check-event-sources`, `slack-daily-digest`, `process-openai-webhook-tasks`, `auto-review`
- Auth pattern: `Authorization: Bearer ${CRON_SECRET}` (`app/api/cron/auto-review/route.ts`)
- Legacy discover: `POST /api/events/discover` runs `checkDueSources` (Prisma sources, not OpenAI web search)

## Existing tests

- Vitest in `tests/` — service tests mock Prisma + OpenAI (`tests/sacfam-source-research-service.test.ts`)
- Pattern: env toggles, mock `responses.create`, assert graceful disabled paths

## Design change from previous source-fetching approach

| Before | After (this feature) |
| --- | --- |
| Fetch known source URLs from Airtable / Prisma | **OpenAI `web_search` tool** discovers events across the public web |
| Airtable sources as ingestion targets | Airtable sources as **search guidance only** |
| Source checker / monitor per URL | Daily batch: up to 20 candidates → rank → best 9 |
| May auto-approve high confidence | **Always `Need Review`** — no auto-publish, no calendar |

## Files to add

| Path | Purpose |
| --- | --- |
| `lib/events/dailyWebEventDiscoverySchema.ts` | Zod schema + window/URL validation |
| `lib/events/dailyWebEventDiscoveryEnv.ts` | Feature flags + config |
| `lib/airtable/client.ts` | Daily-discovery Airtable config helper |
| `lib/airtable/familyEventSourcesRepository.ts` | High-priority source preferences |
| `lib/airtable/familyEventsRepository.ts` | Read window, batch create, duplicate keys |
| `lib/ai/prompts/dailyWebEventDiscoveryPrompt.ts` | System + user prompts |
| `lib/ai/dailyWebEventDiscoveryClient.ts` | OpenAI Responses + web_search |
| `lib/events/eventDeduper.ts` | Title/date/city/domain dedupe |
| `lib/events/eventRanker.ts` | Family relevance ranking |
| `lib/events/dailyWebEventDiscoveryService.ts` | Orchestrator |
| `app/api/admin/events/discover-web-daily/route.ts` | Admin GET/POST |
| `app/api/cron/discover-web-events/route.ts` | Vercel cron |
| `app/admin/events/web-discovery/page.tsx` | Admin UI |
| `app/admin/events/web-discovery/actions.ts` | Server actions |
| `tests/daily-web-event-discovery*.test.ts` | Unit tests |
| `docs/DAILY_WEB_EVENT_DISCOVERY.md` | Operator guide |

## Files to modify

| Path | Change |
| --- | --- |
| `.env.example` | New env vars |
| `vercel.json` | Cron + function `maxDuration` |
| `components/layout-shell.tsx` | Admin nav link |
| `app/admin/sacfamAgentActions.ts` | Revalidate paths (optional) |

## Risks

1. **OpenAI web_search latency/cost** — 60s function timeout; may need `maxDuration` increase on Vercel Pro.
2. **Hallucinated events** — mitigated by requiring source URLs + human Need Review.
3. **Airtable column drift** — writes use documented column names; missing columns fail batch with clear error.
4. **Duplicate false negatives/positives** — normalized key is heuristic; admins still review.
5. **Two sources tables** — legacy Family Event Sources vs Event Sources workflow; this feature reads **Family Event Sources** per env `AIRTABLE_FAMILY_EVENT_SOURCES_TABLE`.

## Rollback plan

1. Set `SACFAM_DAILY_WEB_EVENT_DISCOVERY_ENABLED=false`.
2. Remove cron entry from `vercel.json` and redeploy.
3. Delete errant Airtable rows (Status = Need Review, Notes contains automation marker).
4. Revert git commit if needed — no DB migrations required.

## Test plan

1. Unit: schema, deduper, ranker, env disabled, dry run no writes, cron auth, batch size ≤ 10.
2. Integration (manual): `SACFAM_DAILY_WEB_EVENT_DISCOVERY_DRY_RUN=true`, POST admin route, verify JSON summary.
3. Integration (manual): dry run false on staging, confirm 9 Airtable rows with Status Need Review.
4. Cron: `curl -H "Authorization: Bearer $CRON_SECRET" https://…/api/cron/discover-web-events`
5. `npm test` — all Vitest suites green.
