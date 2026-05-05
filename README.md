# Sacramento Family Event Finder

Next.js dashboard that reads curated family-event records from an Airtable **FAMILY EVENTS** base, helps operators review them locally, batches Google Calendar inserts (OAuth wiring staged), and keeps automation hooks ready for Zapier/cron.

> Project path in this workspace: `sacramento-family-event-finder/`

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn-inspired primitives
- TanStack Query for API state
- Prisma 5 + SQLite for local automation metadata (OAuth tokens, scheduler prefs)
- Zod validation shared between API + ingestion scripts
- Vitest for unit coverage
- Chrome extension (MV3) for parsing the structured Calendar footer

## Quick start

```bash
cd sacramento-family-event-finder
npm install
cp .env.example .env
npx prisma migrate dev
npm run dev
```

Visit `http://localhost:3333/events`.

### Data sources

1. **Mock mode (default)** – `/api/events` serves deterministic demo rows when Airtable env vars are blank.
2. **Airtable mode** – populate `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID` (plus optional table overrides). Same route auto-hydrates from the `Family Events` table and falls back to mock data with a warning if the API errors.

## npm scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Next dev server |
| `npm run build` | Production build |
| `npm run lint` | ESLint (Next config) |
| `npm test` | Vitest suite |
| `npm run prisma:migrate` | Run Prisma migrations against `DATABASE_URL` |
| `npm run seed:sources` / `seed:categories` | Prepare Airtable seed payloads (logs until write helpers land) |
| `npm run discover:once` | POST `/api/events/discover` (stub) |
| `npm run scheduler:run` | POST `/api/scheduler/run` (stub) |
| `npm run test:calendar` | Verifies Google env vars (`assertGoogleConfigured`) |
| `npm run extension:build` | Bundles Chrome popup + lightweight content stub |

**Zapier (optional)** — Toolbar **Send to Zapier** / per-card **Add via Zapier** call `POST /api/events/send-to-zapier` once `ZAPIER_WEBHOOK_URL` points at a Zapier Catch Hook.

### Chrome helper

```bash
npm run extension:build
chrome://extensions → Load unpacked → select `extension/chrome/`
```

`popup.html` accepts pasted descriptions and echoes parsed metadata using the shared block syntax documented in [`docs/GOOGLE_CALENDAR_FORMAT.md`](docs/GOOGLE_CALENDAR_FORMAT.md).

## Milestone status snapshot

| Area | Milestone |
| --- | --- |
| Foundation (`/events`, prisma, docs, mocks) | Milestone **1 ✓ / 2 partial** |
| Airtable read path + mapping | Wired for events + `/api/sources` |
| Discovery / GPT extraction | Stub routes + libs |
| OAuth + inserts | Guided via `/api/calendar/auth` scaffolding |
| Scheduler / Zapier hooks | Routes + docs, automation UI placeholder |
| Chrome extension | Popup parser + noop content hook |

Refer to `/docs/*.md` for deeper workflow notes plus privacy guidance.

### Manual credentials checklist

| Item | Why |
| --- | --- |
| Airtable PAT with base scope | Enables live `/api/events` + `/api/sources` |
| Google OAuth Desktop/Web client + Calendar scope | Enables `/api/calendar/auth` continuation |
| OpenAI secret | GPT-backed extraction prompts |
| Optional Zapier webhook URL | Enables **Send to Zapier / Add via Zapier** → Catch Hook payloads |
| Optional `ZAPIER_WEBHOOK_SECRET` | Sent as `X-Webhook-Secret` for simple verification in Zapier |
| Optional `ZAPIER_ENABLED` | Set to `false` to hide failures server-side (`503`) |

Outbound Zapier payloads use `FamilyEventZapierPayload` from `lib/zapier.ts` (flattened JSON for Calendar + Airtable steps). Successful and failed deliveries are stored in SQLite (`ZapierWebhookLog`). When your Airtable base includes **`Zapier Webhook Status`** and **`Zapier Last Sent At`** columns on Family Events, the app updates those fields after each attempt.

Never commit populated `.env` files.
