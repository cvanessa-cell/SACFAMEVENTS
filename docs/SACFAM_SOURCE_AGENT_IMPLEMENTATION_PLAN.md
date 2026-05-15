# SacFam AI Source Agent — Implementation Plan

This document describes the plan for adding an OpenAI-powered **source research** and **event monitoring** arm to the SacFam Events app, layered alongside (not replacing) the existing Prisma-based event extraction pipeline.

---

## 1. Current structure (inspected)

| Area | Finding |
|------|---------|
| Framework | Next.js 14.2 App Router, React 18, TypeScript 5 |
| Database | Prisma 5 + PostgreSQL (Supabase) |
| Core models | `EventSource`, `SourceFetchLog`, `SourceChange`, `AiEventExtractionJob`, `FamilyEvent`, `OpenAIWebhookTask`, Google Calendar models, `AppAutomationSettings` |
| OpenAI today | `lib/openai/client.ts` (throws if key missing), `lib/openai/createEventExtractionJob.ts` (uses `responses.create` + `zodTextFormat`), webhook `app/api/webhooks/openai/route.ts` |
| Admin UI | `app/admin/layout.tsx`, nav entries Monitoring / Sources / Review queue via `components/layout-shell.tsx` |
| Admin auth | HTTP Basic / cookie via `middleware.ts` when `ADMIN_PASSWORD` set; `/api/admin/*` route handlers use `Authorization: Bearer ${CRON_SECRET}` |
| Privileged ops | Server Actions in `app/admin/actions.ts` (no Bearer required from browser) |
| Tests | Vitest (`npm test`); no `typecheck` script in `package.json` |
| Feature flag pattern | Env-based flags (e.g. `SLACK_SIGNALS_ENABLED`, `ZAPIER_ENABLED`); no central env validator |

**Key constraint:** The spec's rich `EventSource` field list overlaps with the existing operational `EventSource` (unique `sourceUrl`, `fetchStrategy`, `checkFrequencyMinutes`, cron-driven). Approach: **new research/monitor tables** plus **candidate staging tables**; admin approval imports approved candidates into the existing `EventSource` / `FamilyEvent` tables.

---

## 2. Files to add

### Library code (`lib/ai/`, `lib/sources/`)
- `lib/ai/sacfamAgentEnv.ts` — feature-flag and config helpers
- `lib/ai/openaiClient.ts` — graceful OpenAI client wrapper
- `lib/ai/prompts/sacfamSourceResearchPrompt.ts`
- `lib/ai/prompts/sacfamEventMonitorPrompt.ts`
- `lib/ai/schemas/sourceResearchSchema.ts`
- `lib/ai/schemas/eventMonitorSchema.ts`
- `lib/sources/sourceDeduplication.ts`
- `lib/sources/sourceScoring.ts`
- `lib/sources/sourceResearchService.ts`
- `lib/sources/eventMonitorService.ts`

### Server actions
- `app/admin/sacfamAgentActions.ts` — `runSourceResearchAction`, `runEventMonitorAction`, candidate approve/reject actions

### API routes
- `app/api/admin/sources/research/route.ts` (POST)
- `app/api/admin/sources/research-runs/route.ts` (GET)
- `app/api/admin/sources/research-runs/[id]/route.ts` (GET)
- `app/api/admin/sources/candidates/[id]/approve/route.ts` (POST)
- `app/api/admin/sources/candidates/[id]/reject/route.ts` (POST)
- `app/api/admin/events/monitor/route.ts` (POST)
- `app/api/admin/events/monitor-runs/route.ts` (GET)
- `app/api/admin/events/candidates/route.ts` (GET)
- `app/api/admin/events/candidates/[id]/approve/route.ts` (POST)
- `app/api/admin/events/candidates/[id]/reject/route.ts` (POST)

### Admin UI pages
- `app/admin/sources/research/page.tsx`
- `app/admin/sources/research-runs/page.tsx`
- `app/admin/sources/research-runs/[id]/page.tsx`
- `app/admin/events/monitor-runs/page.tsx`
- `app/admin/events/candidates/page.tsx`

### Tests
- `tests/sacfam-source-research-schema.test.ts`
- `tests/sacfam-event-monitor-schema.test.ts`
- `tests/sacfam-source-dedupe.test.ts`
- `tests/sacfam-source-scoring.test.ts`
- `tests/sacfam-source-research-service.test.ts`
- `tests/sacfam-research-route-flag.test.ts`

### Docs
- `docs/SACFAM_SOURCE_AGENT.md`
- `docs/SACFAM_EVENT_MONITORING.md`
- `docs/SACFAM_SOURCE_AGENT_CHANGELOG.md`

### Prisma
- New migration adding `SourceResearchRun`, `SourceResearchCandidate`, `EventMonitorRun`, `EventCandidate`

---

## 3. Files to modify

| File | Change | Risk |
|------|--------|------|
| `.env.example` | Add new env vars | Low |
| `prisma/schema.prisma` | Add four new models | Medium (migration) |
| `components/layout-shell.tsx` | Extend `ADMIN_NAV` with two new entries | Low |

No existing files are removed or refactored.

---

## 4. Risk matrix

| Area | Risk | Mitigation |
|------|------|------------|
| Prisma migration | Medium | Additive only; rollback via revert migration + flags off |
| OpenAI cost / output size | Medium | Cap response size; respect `SACFAM_SOURCE_AGENT_MAX_SOURCES`; admin-triggered only |
| Duplicate event extraction with existing cron | Medium | New event monitor writes to `EventCandidate` staging; only admin approval promotes to `FamilyEvent` |
| Admin nav clutter | Low | Group under existing Sources / Review queue sections |
| New API routes mis-guarded | Medium | Mirror exact `isAllowed` pattern from existing admin routes |
| Missing OpenAI key | Low | Graceful wrapper returns `{ ok: false, reason }` |
| Feature flag off | Low | Early return in services and UI badges |

---

## 5. Rollback strategy

1. Set `SACFAM_AI_SOURCE_AGENT_ENABLED=false` and `SACFAM_AI_EVENT_MONITOR_ENABLED=false` in env.
2. Optional: revert latest Prisma migration (`prisma migrate resolve --rolled-back` or restore snapshot). New tables are additive, so leaving them present is harmless.
3. Existing cron-based check pipeline (`EventSource` -> `SourceChange` -> `AiEventExtractionJob` -> `FamilyEvent`) is untouched and continues to work.
4. No removal of existing routes, server actions, or admin pages — rollback only requires turning off flags.

---

## 6. Test plan (Vitest)

| Test | Asserts |
|------|---------|
| Source research schema — valid | Zod parses a representative valid payload |
| Source research schema — invalid enum | Zod rejects unknown `source_type` |
| Event monitor schema — valid | Zod parses a representative valid payload |
| Event monitor schema — missing field | Zod rejects missing required field |
| Deduplication — URL normalization | Same URL with tracking params -> duplicate |
| Scoring — official high freshness | Higher score than poor social |
| Service dry-run | No `prisma.eventSource.create` calls when dry-run true |
| Route handler — flag disabled | Returns JSON `{ ok: false }` not 500 |
| Route handler — missing OpenAI key | Returns safe JSON, no throw |
| Candidate approve (logic) | Builds correct `EventSource` defaults |

---

## 7. Build / lint / test commands

- `npm run lint`
- `npm test`
- `npm run build` (also runs Prisma generate)

`npm run typecheck` is not defined at the root; type validation happens via `npm run build`.

---

## 8. Acceptance criteria mapping

| Criterion | How met |
|-----------|---------|
| Existing app builds and runs | Additive Prisma, additive routes, no removed UI |
| Flags disable system cleanly | Services and UI check flags first |
| Missing OpenAI key does not crash | Wrapper returns `{ ok: false, reason }` |
| AI output validated before save | Zod parse precedes Prisma write; errors recorded on run row |
| Admin approves candidates | Approve action creates `EventSource` with sensible defaults |
| Dry-run does not auto-import | Services check flag and short-circuit |
| No verified fakes | `verificationStatus` defaults respect AI output; admin gate enforced |
| Tests cover schemas, dedupe, scoring, disabled state, missing key, dry-run | See Phase 7 |

---

## 9. Follow-ups (out of scope unless requested)

- OpenAI Responses API tools (web search / agentic browsing) for monitor
- Unify Airtable display sources with Prisma catalog
- Add `npm run typecheck` script
- Align `/api/admin/*` auth with `ADMIN_PASSWORD`
