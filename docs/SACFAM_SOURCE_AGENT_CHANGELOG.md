# SacFam AI Source Agent — Changelog

Initial implementation of the OpenAI-powered source research and event monitoring system.

---

## Files added

### Documentation
- `docs/SACFAM_SOURCE_AGENT_IMPLEMENTATION_PLAN.md`
- `docs/SACFAM_SOURCE_AGENT.md`
- `docs/SACFAM_EVENT_MONITORING.md`
- `docs/SACFAM_SOURCE_AGENT_CHANGELOG.md` (this file)

### Library code
- `lib/ai/sacfamAgentEnv.ts` — feature flag + config readers, availability helpers
- `lib/ai/openaiClient.ts` — graceful OpenAI client wrapper (returns `{ ok, reason }`)
- `lib/ai/prompts/sacfamSourceResearchPrompt.ts` — system + user prompt builders + PROMPT_VERSION
- `lib/ai/prompts/sacfamEventMonitorPrompt.ts` — system + user prompt builders + PROMPT_VERSION
- `lib/ai/schemas/sourceResearchSchema.ts` — Zod schema + enum constants for source research output
- `lib/ai/schemas/eventMonitorSchema.ts` — Zod schema + enum constants for event monitor output
- `lib/sources/sourceDeduplication.ts` — URL normalization + duplicate detection helpers
- `lib/sources/sourceScoring.ts` — deterministic structural score in [0, 1]
- `lib/sources/sourceAutoApproval.ts` — shared `> 0.5` auto-import rules for source and event candidates
- `lib/sources/sourceResearchService.ts` — `runSourceResearch`, `approveSourceCandidate`, `rejectSourceCandidate`
- `lib/sources/eventMonitorService.ts` — `runEventMonitorForSource`, `approveEventCandidate`, `rejectEventCandidate`

### Server Actions
- `app/admin/sacfamAgentActions.ts` — six actions:
  - `runSourceResearchAction`
  - `approveSourceCandidateAction`
  - `rejectSourceCandidateAction`
  - `runEventMonitorAction`
  - `approveEventCandidateAction`
  - `rejectEventCandidateAction`

### Admin API routes (all guarded by `Authorization: Bearer ${CRON_SECRET}`)
- `POST /api/admin/sources/research`
- `GET  /api/admin/sources/research-runs`
- `GET  /api/admin/sources/research-runs/[id]`
- `POST /api/admin/sources/candidates/[id]/approve`
- `POST /api/admin/sources/candidates/[id]/reject`
- `POST /api/admin/events/monitor`
- `GET  /api/admin/events/monitor-runs`
- `GET  /api/admin/events/candidates`
- `POST /api/admin/events/candidates/[id]/approve`
- `POST /api/admin/events/candidates/[id]/reject`

### Admin pages
- `/admin/sources/research` — run AI source research, view stats and recent runs
- `/admin/sources/research-runs` — full list of source research runs
- `/admin/sources/research-runs/[id]` — candidate review for one run
- `/admin/events/monitor-runs` — full list of event monitor runs
- `/admin/events/candidates` — event-candidate review queue with status filter tabs

### Tests (Vitest)
- `tests/sacfam-source-research-schema.test.ts` — 3 cases
- `tests/sacfam-event-monitor-schema.test.ts` — 3 cases
- `tests/sacfam-source-dedupe.test.ts` — 6 cases
- `tests/sacfam-source-scoring.test.ts` — 4 cases
- `tests/sacfam-source-research-service.test.ts` — flag off, dry-run, auto-import when score > 0.5, schema fail, manual approve paths
- `tests/sacfam-source-auto-approval.test.ts` — 0.5 threshold for source `deterministicScore` and event `confidence_score`
- `tests/sacfam-research-route-flag.test.ts` — 3 cases (unauthorized, key missing, flag off)

### Prisma migration
- `prisma/migrations/20260513000000_add_sacfam_ai_agent_tables/migration.sql` — creates four tables:
  - `SourceResearchRun`
  - `SourceResearchCandidate`
  - `EventMonitorRun`
  - `EventCandidate`

---

## Files modified

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Added 4 new models (additive only) |
| `.env.example` | Added 5 new env vars under a SacFam AI Source Agent section |
| `components/layout-shell.tsx` | Added 2 new admin nav links: "AI source research" and "AI event candidates" |
| `app/admin/event-sources/page.tsx` | Added per-source "AI monitor" button (hidden if flag off) |
| `components/PublicEventCard.tsx` | Pre-existing fix — removed unused `fullDate` variable that was blocking build |
| `app/(public)/discover/page.tsx` | Pre-existing fix — added missing optional fields (`kidFriendlyNotes`, `airtableRecordId`, `indoorOutdoor`, `googleMapsLink`) to local `PublicEvent` interface to match `PublicEventData` |

The two "pre-existing fix" items were necessary to unblock `npm run build` so the agent implementation could be verified. They were not introduced by this changeset — they existed in `main` before the agent work.

---

## Env vars added

```
SACFAM_AI_SOURCE_AGENT_ENABLED="true"
SACFAM_AI_EVENT_MONITOR_ENABLED="true"
SACFAM_SOURCE_AGENT_MODEL=""
SACFAM_SOURCE_AGENT_MAX_SOURCES="125"
SACFAM_SOURCE_AGENT_DRY_RUN="true"
```

Reuses existing `OPENAI_API_KEY`, `OPENAI_MODEL`, `CRON_SECRET`, `EVENT_SOURCE_DEFAULT_CHECK_INTERVAL_MINUTES`.

---

## Database models added

| Model | Purpose |
|-------|---------|
| `SourceResearchRun` | Audit row per source-research invocation |
| `SourceResearchCandidate` | Proposed source rows; high `deterministicScore` rows auto-import when dry-run is off |
| `EventMonitorRun` | Audit row per event-monitor invocation |
| `EventCandidate` | Proposed event rows; high `confidence_score` rows auto-promote when dry-run is off |

Indexes added: `(status, createdAt)` on runs, `(runId, importStatus)` + `(normalizedUrl)` on source candidates, `(monitorRunId, reviewStatus)` + `(sourceId, createdAt)` + `(reviewStatus, createdAt)` on event candidates.

No existing models were modified.

---

## How to test manually

1. **Generate Prisma client** (already part of build): `npm run build`.
2. **Apply migration to dev DB**: `npm run prisma:migrate`. The migration is `20260513000000_add_sacfam_ai_agent_tables`.
3. **Set env vars**: copy from `.env.example`, ensure `OPENAI_API_KEY`, `CRON_SECRET`, `SACFAM_AI_SOURCE_AGENT_ENABLED=true`, `SACFAM_SOURCE_AGENT_DRY_RUN=true`.
4. **Start dev**: `npm run dev` (port 3333).
5. **Visit** `/admin/sources/research` and click **Run AI source research**. (If `ADMIN_PASSWORD` is set, sign in via HTTP Basic.)
6. After the run completes, click **View** to see candidates.
7. **Reject** at least one low-scoring candidate manually.
8. Set `SACFAM_SOURCE_AGENT_DRY_RUN=false` and restart; run research again — candidates with `deterministicScore > 0.5` should auto-import into `/admin/event-sources` without a manual approve click.
9. Click **AI monitor** on a source; event rows with `confidence_score > 0.5` should auto-promote to `FamilyEvent` (`needs_review`); lower scores remain in `/admin/events/candidates`.

---

## What was skipped / out of scope

- **OpenAI Responses tools (web_search, etc.)** — not enabled; the server fetches public URLs itself.
- **Per-candidate auto-import disable flag** — not added; use `SACFAM_SOURCE_AGENT_DRY_RUN=true` to force manual review for all candidates.
- **Dedup against existing `FamilyEvent` on event candidate promotion** — left to the existing review queue and `buildDuplicateKey` helper.
- **Unifying Airtable display sources with Prisma catalog** — the `/api/sources` route still reads Airtable; out of scope here.
- **Adding `npm run typecheck` script** — not added; the existing project relies on `npm run build` for type checking.

---

## Risks / follow-up recommendations

1. **Migration must run on prod DB** before deploying the new code; otherwise the new Prisma queries will fail. Run `prisma migrate deploy` in your deploy pipeline.
2. **OpenAI cost** — each research run consumes one large response (up to 125 structured candidates) and each monitor run consumes one moderate response. Monitor cost via OpenAI dashboards; consider lowering `SACFAM_SOURCE_AGENT_MAX_SOURCES` for daily testing.
3. **`/api/admin/*` auth** still uses `CRON_SECRET` Bearer; the broader recommendation in the project plan is to align it with `ADMIN_PASSWORD` — left for a separate PR.
4. **Prompts and structured schemas are versioned** (`PROMPT_VERSION` in each prompt module + saved on every run row). When tuning, bump the version and document the change here so audit trails stay coherent.
5. **Auto-import uses a fixed `> 0.5` threshold** (`lib/sources/sourceAutoApproval.ts`): source candidates use `deterministicScore`; event candidates use model `confidence_score`. Duplicates and already-decided rows are skipped. Manual approve/reject still works.
6. **Promotion of an event candidate creates a `FamilyEvent` with `status="needs_review"`**, so `/admin/event-review` remains the gate before public exposure even after auto-promotion.

---

## Commands run during implementation

- `npx prisma generate` — passed
- `npm test` — 67 passed (25 new + 42 existing)
- `npm run build` — passed (clean compile + static page generation)
- `npm run lint` — 3 pre-existing warnings remain in `app/(public)/discover/page.tsx`; not introduced by this changeset.
