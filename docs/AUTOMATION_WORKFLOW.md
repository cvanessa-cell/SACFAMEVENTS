# Scheduler & Zapier workflows

Automation must default to **gather → Airtable review → deliberate calendar export**.

## Scheduler surfaces

| Runner | Fit |
| --- | --- |
| `node-cron` locally via `lib/scheduler.ts` | Dev laptops / Raspberry Pi hosts |
| Vercel cron hitting `/api/scheduler/run` | Managed Next deployments |
| GitHub Actions + curl | Lightweight remote pings |
| Zapier webhook → `/api/events/discover` | No-code ops teams |

## Safety toggles (Prisma `AppAutomationSettings`)

- `automationEnabled`
- `frequency` (`daily | weekly | monthly`)
- `preferredRunTime`
- `maxSourcesPerRun`
- `onlyActiveSources`
- `autoConfirmHighConfidence`
- **`autoAddToGoogleCalendar`** (defaults false forever unless explicitly flipped)
- `minConfidenceAutoConfirm`

## Zapier inspirations

1. Trigger on Airtable “Status = Confirmed” → enqueue Google inserts (prefer native server route first).
2. Schedule-triggered Zap to request `/api/events/discover`.
3. Cloudinary/Drive screenshot hook → PATCH Airtable + refresh Calendar description footer.
