# SacFam AI Event Monitoring

An admin-triggered, on-demand event monitor that uses OpenAI to identify new, changed, canceled, or noteworthy events on a single `EventSource`. Results land in the `EventCandidate` staging table for admin review.

This is **parallel** to the cron-driven extraction pipeline that runs once a day. The monitor is intended for ad-hoc previews ("let me see what AI finds on this source right now") without waiting for the next cron tick.

---

## What it does

1. Admin clicks **AI monitor** on a source row in `/admin/event-sources`.
2. The service fetches the source page server-side (15s timeout, project user-agent, no login).
3. The page text is normalized (HTML stripped) and capped at 120,000 characters.
4. The service calls the OpenAI Responses API with the event-monitor prompt and a Zod schema.
5. The response is validated and persisted as one `EventMonitorRun` row plus one `EventCandidate` per event.
6. Admin reviews candidates at `/admin/events/candidates` and clicks **Approve & promote** (when dry-run is off) or **Reject**.
7. Approved candidates create new `FamilyEvent` rows with `status="needs_review"` so they still pass through the existing review queue.

---

## Required env vars

| Variable | Default | Purpose |
|----------|---------|---------|
| `OPENAI_API_KEY` | empty | Required. |
| `SACFAM_AI_EVENT_MONITOR_ENABLED` | `true` | Feature flag — `false` disables the monitor. |
| `SACFAM_SOURCE_AGENT_MODEL` | falls back to `OPENAI_MODEL` | Model override. |
| `SACFAM_SOURCE_AGENT_DRY_RUN` | `true` | Shared with the source agent — when `true`, approval is blocked. |
| `CRON_SECRET` | — | Required for the route handler; UI uses Server Actions. |

---

## How to monitor a source

### From the admin UI

1. Visit `/admin/event-sources`.
2. Find the source you want to probe.
3. Click **AI monitor** in the action column. The page revalidates and the run shows up at `/admin/events/monitor-runs`.
4. View candidates at `/admin/events/candidates` (filter by `pending`).

### From the API

```bash
curl -X POST "$APP_BASE_URL/api/admin/events/monitor" \
  -H "Authorization: Bearer $CRON_SECRET" \
  -H "Content-Type: application/json" \
  -d '{ "sourceId": "src_abc123" }'
```

Response:

```json
{
  "ok": true,
  "runId": "ckv...",
  "candidateCount": 12,
  "newEventsFound": 8,
  "updatedEventsFound": 1,
  "eventsNeedingReview": 3,
  "calendarReadyEvents": 7
}
```

---

## Data validation

Every response is parsed against [`eventMonitorSchema`](../lib/ai/schemas/eventMonitorSchema.ts) before any DB write:

- `change_type` is restricted to `new_event | updated_event | canceled_event | duplicate_possible | stale_event | no_change | needs_manual_review`.
- `calendar_ready` is restricted to `yes | no | needs_review`.
- `confidence_score` must be in `[0, 1]`.
- Counts must be integers `>= 0`.

Failures write `status="failed"` on the `EventMonitorRun` row with a truncated preview of the raw response.

---

## Promotion to FamilyEvent

When an admin approves a candidate (and dry-run is off):

| EventCandidate field | FamilyEvent field |
|----------------------|-------------------|
| `eventTitle` | `title` |
| `descriptionSummary` | `description` |
| `eventUrl` | `sourceEventUrl` |
| `sourceId` | `sourceId` |
| `city`, `countyOrRegion` | `city`, `county` |
| `locationName`, `streetAddress` | `venueName`, `address` |
| `eventDate` + `eventStartTime` | `startDatetime` (best-effort ISO parse) |
| `eventDate` + `eventEndTime` | `endDatetime` |
| `familyAgeRange` | `ageRange` |
| `cost` | `priceText` |
| `confidenceScore` | `confidence` |

`status` is always set to `needs_review` so the human review queue still gets to confirm.

---

## Safety / limitations

- Plain HTTP `fetch` only — no login, no JS rendering, no Firecrawl reuse. If the source needs Firecrawl or other authenticated fetch, use the cron-driven extraction pipeline instead (set `fetchStrategy="firecrawl"` on the `EventSource`).
- Snapshot is truncated to 120,000 chars to keep prompt cost bounded.
- No automatic deduplication against existing `FamilyEvent` rows — that happens via the existing review queue and `buildDuplicateKey` helper at the next pipeline stage.
- Approval never bypasses the human review queue (`status="needs_review"` is set on creation).

---

## How to disable

- **Soft disable:** `SACFAM_AI_EVENT_MONITOR_ENABLED=false`. The "AI monitor" button is hidden in `/admin/event-sources`; route handler returns `{ ok: false, reason: "event_monitor_flag_off" }`.
- **Cost-only disable:** keep flag on, set `SACFAM_SOURCE_AGENT_DRY_RUN=true` so candidates persist but cannot be promoted.
