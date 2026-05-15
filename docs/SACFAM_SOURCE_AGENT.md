# SacFam AI Source Research Agent

An admin-triggered OpenAI-powered tool that **proposes** new family-event sources for the Sacramento / Placer region. Candidates are written to a staging table and require admin approval before they are promoted into the operational `EventSource` catalog used by the cron-driven ingestion pipeline.

This system is **additive** — it does not replace the existing cron pipeline (`EventSource` -> `SourceChange` -> `AiEventExtractionJob` -> `FamilyEvent`).

---

## What it does

1. Admin clicks **Run AI source research** from `/admin/sources/research`.
2. The service calls the OpenAI Responses API with the SacFam source-research prompt and a Zod-defined JSON schema.
3. The model returns a structured list of proposed sources (up to `SACFAM_SOURCE_AGENT_MAX_SOURCES`).
4. The service validates the response, runs deduplication against existing `EventSource` rows, computes a deterministic supplemental score, and persists candidates into `SourceResearchCandidate` rows (linked to a `SourceResearchRun`).
5. Admin reviews the candidates at `/admin/sources/research-runs/{id}` and clicks **Approve & import** (when dry-run is off) or **Reject**.
6. Approved candidates create new `EventSource` rows with sensible defaults derived from the AI's recommended ingestion method.

---

## Required env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | empty | Required. Without it the agent returns `{ ok: false, reason: "openai_key_missing" }`. |
| `SACFAM_AI_SOURCE_AGENT_ENABLED` | `true` | Feature flag — set to `false` to fully disable. |
| `SACFAM_SOURCE_AGENT_MODEL` | falls back to `OPENAI_MODEL`, then `gpt-5.5` | Model override for this agent only. |
| `SACFAM_SOURCE_AGENT_MAX_SOURCES` | `125` | Hard upper bound on `requestedSourceCount`. |
| `SACFAM_SOURCE_AGENT_DRY_RUN` | `true` | When `true`, runs persist candidates but admin approval cannot promote into `EventSource`. |
| `CRON_SECRET` | — | Required to call the route handlers; the in-app admin UI uses Server Actions and doesn't need it. |

---

## How to run source research

### From the admin UI

1. Visit `/admin/sources/research`.
2. (Optional) Adjust the **Requested source count** field. The cap is `SACFAM_SOURCE_AGENT_MAX_SOURCES`.
3. (Optional) Override the **Target region** label.
4. Click **Run AI source research**. The page revalidates to show the new run row.
5. Click **View** on the run to see all candidates.

### From the API

```bash
curl -X POST "$APP_BASE_URL/api/admin/sources/research" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "requestedSourceCount": 50, "targetRegion": "Sacramento / Placer" }'
```

Response:

```json
{
  "ok": true,
  "runId": "ckv...",
  "parsedSourceCount": 50,
  "duplicateCount": 7,
  "dryRun": true
}
```

---

## How to review candidates

Visit `/admin/sources/research-runs/{runId}` for the candidate list. Each candidate shows:

- Name, URL, category, source type
- `freshness_likelihood`, `automation_fit`, `verification_status`, `review_priority`
- Model `relevance_score` and the agent's deterministic structural score
- Family relevance + reasoning text
- Import status badge (`pending_review`, `imported`, `duplicate`, `rejected`, `needs_verification`)

Actions:

- **Approve & import** — creates a new `EventSource` row (requires `SACFAM_SOURCE_AGENT_DRY_RUN=false`).
- **Reject** — marks the candidate `rejected`; no `EventSource` is created.

---

## How approval maps to EventSource

| Candidate field | EventSource field | Notes |
|-----------------|-------------------|-------|
| `sourceName` | `name` | direct |
| `sourceUrl` | `sourceUrl` | unique; existing row is linked rather than re-created |
| `sourceCategory` | `category` | snake_case category id |
| `cityOrAreaServed` | `city` | best-effort |
| `countyOrRegion` | `county` / `region` | |
| `sourceType` | `sourceType` | direct |
| `recommendedIngestionMethod` | `fetchStrategy` | mapped (see [`fetchStrategyForCandidate`](../lib/sources/sourceResearchService.ts)) |
| `deterministicScore` | `trustedSourceScore` | structural score in [0, 1] |
| `notes` | `notes` | direct |

`checkFrequencyMinutes` defaults to `EVENT_SOURCE_DEFAULT_CHECK_INTERVAL_MINUTES` (or `360`).

---

## Dry-run mode

While `SACFAM_SOURCE_AGENT_DRY_RUN=true`:

- Research runs still save the `SourceResearchRun` row and all `SourceResearchCandidate` rows.
- The admin UI shows the "Dry-run is ON" badge and approval still creates no `EventSource` row.
- Programmatic approval through the API returns `{ ok: false, reason: "dry_run_blocked" }`.

Set `SACFAM_SOURCE_AGENT_DRY_RUN=false` and restart the dev server / redeploy to enable imports.

---

## How data validation works

Every OpenAI response is parsed against [`sourceResearchSchema`](../lib/ai/schemas/sourceResearchSchema.ts) before any DB write:

- Enums (`source_category`, `source_type`, `freshness_likelihood`, `automation_fit`, `recommended_ingestion_method`, `review_priority`, `verification_status`) are strictly validated.
- `relevance_score` must be in `[0, 1]`.
- Failures are recorded on the run row as `status="failed"` with the error message and a 4000-character preview of the raw response.

---

## Privacy / safety limitations

- Only public URLs are fetched (no auth, no login bypass, no paywall scraping).
- Private Facebook groups and login-only sources are flagged as manual-only by the prompt and surfaced as `needs_verification` candidates.
- OpenAI receives only the prompt and (for the event monitor) the public page text. No customer data, no secrets, no admin password.
- Run rows persist a truncated preview of the raw model output only, never API keys.

---

## How to disable

- **Soft disable:** `SACFAM_AI_SOURCE_AGENT_ENABLED=false`. The admin UI shows a disabled banner and route handlers return `{ ok: false, reason: "source_agent_flag_off" }`.
- **Cost-only disable:** keep the flag on but set `SACFAM_SOURCE_AGENT_DRY_RUN=true` so admins can still trigger runs but nothing imports.
- **Full disable:** unset `OPENAI_API_KEY`. Existing extraction cron will throw on its hardcoded `getOpenAIClient`, but the SacFam agent wrapper returns a graceful error.
