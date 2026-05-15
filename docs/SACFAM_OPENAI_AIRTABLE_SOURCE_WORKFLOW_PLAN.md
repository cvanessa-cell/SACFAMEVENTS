# SacFam OpenAI + Airtable Source Workflow Plan

## Current Structure Found

SacFamEvents is a Next.js 14 App Router application using React 18, TypeScript, Prisma 5, and PostgreSQL. Local app state, operational event-source monitoring, OpenAI extraction jobs, Google Calendar connections, and admin review state live in Prisma. Master event data and public source display already have Airtable support through `lib/airtable.ts` and `app/api/sources/route.ts`.

Existing relevant areas:

- Framework/router: Next.js App Router under `app/`.
- Database: Prisma/PostgreSQL in `prisma/schema.prisma`.
- Airtable: `lib/airtable.ts` reads/writes existing family-event tables; `app/api/sources/route.ts` reads a legacy sources table shape.
- OpenAI: `lib/ai/openaiClient.ts`, `lib/sources/sourceResearchService.ts`, and `lib/openai/createEventExtractionJob.ts`.
- Admin: `app/admin/` pages with HTTP Basic protection through `middleware.ts`; admin API routes use `CRON_SECRET` Bearer auth.
- Event models: `EventSource`, `SourceChange`, `AiEventExtractionJob`, `FamilyEvent`, `SourceResearchRun`, `SourceResearchCandidate`, `EventMonitorRun`, and `EventCandidate`.
- Google Calendar: `lib/googleCalendar.ts`, calendar API routes, account models, and export records.
- Tests: Vitest via `npm test`; no root `typecheck` script exists, so `npm run build` is the TypeScript validation gate.
- Env handling: module-local `process.env` reads with graceful fallback; no central runtime env validator.

This implementation is additive. It keeps the existing Prisma-backed source-monitoring pipeline as the operational path and adds Airtable as the review/catalog workflow required for source research.

## Existing Source, Event, and Admin Functionality

- Operational sources are stored as Prisma `EventSource` rows and checked by the event monitoring/discovery pipeline.
- Source research already creates Prisma `SourceResearchRun` and `SourceResearchCandidate` rows.
- Candidate approval currently promotes candidates into Prisma `EventSource`.
- Public `/api/sources` reads Airtable when configured, otherwise mock source data.
- Admin pages already exist for event sources, source research, research runs, event monitoring, event review, and AI event candidates.

## Proposed Files to Add

- `lib/airtable/airtableClient.ts`
- `lib/airtable/sourceResearchRunRepository.ts`
- `lib/airtable/sourceCandidateRepository.ts`
- `lib/airtable/eventSourceCatalogRepository.ts`
- `app/api/admin/sources/candidates/route.ts`
- `app/api/admin/sources/route.ts`
- `app/api/admin/sources/[id]/route.ts`
- `app/admin/sources/page.tsx`
- `app/admin/sources/candidates/page.tsx`
- `docs/SACFAM_AIRTABLE_SCHEMA.md`
- `docs/SACFAM_AIRTABLE_MCP_WORKFLOW.md`
- `docs/SACFAM_OPENAI_AIRTABLE_SOURCE_WORKFLOW.md`
- `docs/SACFAM_SOURCE_WORKFLOW_CHANGELOG.md`
- Focused Vitest coverage for Airtable batching and updated schemas/services.

## Proposed Files to Modify

| File | Risk | Planned Change |
|------|------|----------------|
| `.env.example` | Low | Add OpenAI source-research alias, Airtable table names, write flag, and mirror flag. |
| `lib/ai/sacfamAgentEnv.ts` | Low | Extend server-only env parsing with Airtable and source workflow config. |
| `lib/ai/prompts/sacfamSourceResearchPrompt.ts` | Medium | Align prompt with Airtable-friendly fields and existing-source duplicate hints. |
| `lib/ai/schemas/sourceResearchSchema.ts` | Medium | Align structured output schema with required JSON shape, 1-10 scores, and per-record validation helpers. |
| `lib/ai/prompts/sacfamEventMonitorPrompt.ts` | Low | Clarify event-monitoring foundation rules. |
| `lib/ai/schemas/eventMonitorSchema.ts` | Low | Align event candidate review status/options with Airtable documentation. |
| `lib/sources/sourceDeduplication.ts` | Low | Add duplicate-key helper using normalized domain, name, and area. |
| `lib/sources/sourceScoring.ts` | Low | Support 1-10 model relevance while preserving deterministic scoring. |
| `lib/sources/sourceResearchService.ts` | Medium | Add Airtable run/candidate writes, richer summary, per-record validation, and approval sync to Airtable Event Sources. |
| `app/admin/sacfamAgentActions.ts` | Low | Revalidate new admin source pages. |
| `components/layout-shell.tsx` | Low | Add navigation to Airtable catalog/candidate review pages. |
| Existing tests | Low-Medium | Update old 0-1 score assumptions and add Airtable workflow coverage. |

## Feature Flags

- `SACFAM_AI_SOURCE_AGENT_ENABLED`: enables/disables source research.
- `SACFAM_AIRTABLE_WRITE_ENABLED`: enables/disables backend Airtable writes.
- `SACFAM_SOURCE_AGENT_DRY_RUN`: keeps candidates proposed/pending and blocks approval import.
- `SACFAM_SOURCE_RESEARCH_PRISMA_MIRROR`: documents that Prisma remains the local audit mirror for existing admin UI; default on.
- `SACFAM_SOURCE_AGENT_MAX_SOURCES`: caps requested source count.

## Rollback Plan

1. Set `SACFAM_AIRTABLE_WRITE_ENABLED=false`.
2. Set `SACFAM_AI_SOURCE_AGENT_ENABLED=false` if source research should stop entirely.
3. Keep Prisma operational monitoring unchanged; no Prisma migration is required for the Airtable workflow.
4. Revert the additive route/page/doc changes if needed. Existing event discovery, event review, Google Calendar, and source monitoring continue to use their prior code paths.

## Test Plan

- Schema accepts a valid source-research payload with Airtable-friendly fields.
- Schema rejects invalid enum values and invalid relevance scores.
- Per-record parsing keeps valid records and reports invalid records.
- URL normalization and duplicate-key generation are deterministic.
- Deduplication catches exact normalized URL matches and similar source/name/area matches.
- Scoring favors official local event calendars and penalizes uncertain manual-only social sources.
- Source research returns clear disabled and missing-config messages.
- Airtable repository batches create requests in groups of 10 or fewer.
- Dry-run blocks approval/import while still allowing proposed candidates to be stored.
- Candidate approval maps source fields to Airtable Event Sources and Prisma `EventSource`.

## Assumptions

- Code should follow the repository’s root `lib/` convention, not `src/lib/`.
- Airtable Web API is the backend automation path; Airtable MCP is documented for human/Cursor/ChatGPT review workflows only.
- The production event monitor continues to use approved Prisma `EventSource` rows until a later explicit migration unifies source truth.
- Public/login-only/paywalled scraping is not encouraged. AI-generated sources remain proposed until reviewed.
