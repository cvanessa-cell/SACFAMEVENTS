# SacFam Source Workflow Changelog

## Files Added

- `docs/SACFAM_OPENAI_AIRTABLE_SOURCE_WORKFLOW_PLAN.md`
- `docs/SACFAM_AIRTABLE_SCHEMA.md`
- `docs/SACFAM_AIRTABLE_MCP_WORKFLOW.md`
- `docs/SACFAM_OPENAI_AIRTABLE_SOURCE_WORKFLOW.md`
- `lib/airtable/airtableClient.ts`
- `lib/airtable/sourceResearchRunRepository.ts`
- `lib/airtable/sourceCandidateRepository.ts`
- `lib/airtable/eventSourceCatalogRepository.ts`
- `app/api/admin/sources/candidates/route.ts`
- `app/api/admin/sources/route.ts`
- `app/api/admin/sources/[id]/route.ts`
- `app/admin/sources/page.tsx`
- `app/admin/sources/candidates/page.tsx`
- `tests/airtable-source-workflow.test.ts`

## Files Modified

- `.env.example`
- `docs/AIRTABLE_SCHEMA.md`
- `lib/ai/sacfamAgentEnv.ts`
- `lib/ai/prompts/sacfamSourceResearchPrompt.ts`
- `lib/ai/prompts/sacfamEventMonitorPrompt.ts`
- `lib/ai/schemas/sourceResearchSchema.ts`
- `lib/ai/schemas/eventMonitorSchema.ts`
- `lib/sources/sourceDeduplication.ts`
- `lib/sources/sourceScoring.ts`
- `lib/sources/sourceResearchService.ts`
- `app/admin/sacfamAgentActions.ts`
- `components/layout-shell.tsx`
- `tests/sacfam-source-research-schema.test.ts`
- `tests/sacfam-source-scoring.test.ts`
- `tests/sacfam-source-dedupe.test.ts`
- `tests/sacfam-source-research-service.test.ts`
- `tests/sacfam-research-route-flag.test.ts`

## API Routes Added

- `GET /api/admin/sources/candidates`
- `GET /api/admin/sources`
- `PATCH /api/admin/sources/[id]`

## Environment Variables Added

- `OPENAI_SOURCE_RESEARCH_MODEL`
- `SACFAM_AIRTABLE_WRITE_ENABLED`
- `SACFAM_SOURCE_RESEARCH_PRISMA_MIRROR`
- `AIRTABLE_EVENT_SOURCES_TABLE`
- `AIRTABLE_SOURCE_RESEARCH_RUNS_TABLE`
- `AIRTABLE_SOURCE_CANDIDATES_TABLE`
- `AIRTABLE_EVENT_CANDIDATES_TABLE`

## Tests Added or Updated

- Source research schema now validates Airtable-friendly select labels and 1-10 scores.
- Partial candidate parsing keeps valid records and reports invalid records.
- Deduplication includes `Duplicate Check Key`.
- Scoring normalizes 1-10 AI relevance scores.
- Airtable source candidate writes are tested for 10-record batching.
- Source research service tests were updated for per-candidate creates and richer summaries.

## Commands Run

- `npm run lint`: passed. Existing warnings remain in `app/(public)/discover/page.tsx` about `publicEvents` hook dependencies.
- `npm test`: passed, 26 files and 70 tests.
- `npm run build`: passed. Build also reports the same existing `app/(public)/discover/page.tsx` hook warnings.

## Skipped Features

- No Airtable MCP production write path was added. MCP remains documented for human review only.
- No auto-import flag was added. Admin approval remains required.
- No migration was added. The Airtable workflow is additive and server-side.

## Follow-Up Recommendations

- Add an Airtable field-ID synchronization script if table/field names drift.
- Add a later cutover plan if Airtable should become the single source of truth for public source display.
- Add event-monitoring Airtable writes once the event-monitoring workflow is activated.
