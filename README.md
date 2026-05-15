# Sacramento Family Event Finder

Next.js dashboard that discovers family events from curated sources, runs AI extraction over the changed pages, lets operators review the candidates, and exports approved rows straight into Google Calendar via OAuth.

> Project path in this workspace: `sacramento-family-event-finder/`

## Stack

- Next.js App Router + TypeScript + Tailwind + shadcn-inspired primitives
- TanStack Query for API state
- Prisma 5 + Supabase Postgres for app-side metadata (OAuth tokens, scheduler prefs, AI extraction queue)
- Zod validation shared between API + ingestion scripts
- Vitest for unit coverage
- Chrome extension (MV3) for parsing the structured Calendar footer

## Quick start

```bash
cd sacramento-family-event-finder
npm install
cp .env.example .env
# Fill in DATABASE_URL + DIRECT_URL (Supabase pooler URLs — see .env.example)
npx prisma generate
npx prisma db push   # or: npx prisma migrate deploy
npm run dev
```

Visit `http://localhost:3333/events`.

> **Database:** the app uses Supabase Postgres for both local dev and production. `DATABASE_URL` is the transaction pooler (port 6543, used by the runtime); `DIRECT_URL` is the session pooler (port 5432, used by `prisma migrate` / `prisma db push`). The unpooled `db.<project-ref>.supabase.co:5432` host is IPv6-only on most plans, which is why we use the session pooler for migrations.

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
| `npm run event-sources:seed` | Upserts the starter sources from `data/family-event-sources.template.csv` into Postgres |
| `npm run event-sources:check` | POSTs the cron endpoint locally with the configured `CRON_SECRET` |

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
| Foundation (`/events`, prisma, docs, mocks) | Milestone **1 ✓ / 2 ✓ / 3 ✓ / 4 ✓ / 5 ✓** |
| Airtable read path + mapping | Wired for events (`/api/events`) and live sources (`/api/sources` → `/sources` page) |
| `/settings` automation | Reads & writes `AppAutomationSettings` via Prisma · live `GoogleAccountsCard` for connecting multiple Google accounts, picking per-account default calendars, refreshing calendar lists |
| Admin operations console | Shared layout at `/admin/*`, top-bar Google sign-in widget, server actions for discovery / check-now / enable-disable / retry-AI / review / **add-to-calendar (per-calendar picker)** |
| `/admin/event-monitoring` | Live counts (sources, AI jobs, review backlog, webhook queue) + "Run discovery now" |
| `/admin/event-sources` | Stats, search/status filter, per-source check / enable-disable, recent changes & AI jobs |
| `/admin/event-review` | Status counts, filter, approve/reject/duplicate/reopen, **calendar picker (multiple accounts × multiple calendars)**, **green "Calendar exports" panel** listing every (account, calendar) export with deep links, **inline Google Maps preview** for each event location |
| Discovery pipeline | `/api/events/discover` (Bearer-auth) calls `checkDueSources` → fetch + hash + enqueue OpenAI extraction |
| Google Calendar OAuth + insert | Multi-account: `/api/calendar/auth` → consent → callback persists tokens **per Google account** in `GoogleAccount` (with userinfo email/avatar). `/api/events/add-to-calendar` (and the server action) accept optional `accountId`/`calendarId` overrides; every export is recorded in `FamilyEventCalendarExport`. |
| Calendar list cache | `/api/calendar/accounts` (GET / PATCH) — list accounts + cached calendars, set default account, set default calendar per account, refresh calendar list from Google. |
| Slack daily digest | `/api/cron/slack-daily-digest` (Bearer-auth) reports 24h pipeline health + cooldown-gated decision signals via `SlackDecisionState` |
| Scheduler / Zapier hooks | Routes + docs, settings flag editable in `/settings` |
| Chrome extension | Popup parser + noop content hook |

Refer to `/docs/*.md` for deeper workflow notes plus privacy guidance.

### Manual credentials checklist

| Item | Why |
| --- | --- |
| Airtable PAT with base scope | Enables live `/api/events` + `/api/sources` |
| `GOOGLE_CLIENT_ID` / `GOOGLE_CLIENT_SECRET` / `GOOGLE_REDIRECT_URI` | Web OAuth client (redirect URI must match `/api/calendar/callback`). Enables the full Calendar export flow. The OAuth scopes requested are `calendar.events`, `calendar.readonly`, `openid`, `email`, and `profile` — `calendar.readonly` is what powers the per-account calendar picker. |
| Google account authorization | Visit `/settings` → **Connect another Google account** (or click the **Sign in with Google** button in the top-right of any page). Refresh tokens persist per account in Postgres (`GoogleAccount`). Connect as many accounts as you like. |
| Optional `GOOGLE_CALENDAR_ID` | Initial fallback calendar id stamped on a freshly connected account. Per-account default calendar is editable from `/settings`. |
| Optional `NEXT_PUBLIC_GOOGLE_MAPS_EMBED_API_KEY` | Renders an inline Google Maps iframe under each event in the review queue. Without it, the UI still shows a plain "Open in Google Maps" link. |
| OpenAI secret | GPT-backed extraction prompts |
| `CRON_SECRET` | Bearer-token guard for `/api/events/discover` and `/api/cron/slack-daily-digest` |
| Optional `SLACK_WEBHOOK_URL` (+ `SLACK_SIGNALS_ENABLED`) | Enables daily digest + cooldown-gated decision messages |
| Optional Zapier webhook URL | Enables **Send to Zapier / Add via Zapier** → Catch Hook payloads |
| Optional `ZAPIER_WEBHOOK_SECRET` | Sent as `X-Webhook-Secret` for simple verification in Zapier |
| Optional `ZAPIER_ENABLED` | Set to `false` to hide failures server-side (`503`) |

### Google Calendar export flow (multi-account)

1. Set the three `GOOGLE_*` env vars (redirect URI = `http://localhost:3333/api/calendar/callback` locally, or your deployed equivalent). In Google Cloud → APIs & Services → OAuth consent screen, add the scopes:
   - `https://www.googleapis.com/auth/calendar.events`
   - `https://www.googleapis.com/auth/calendar.readonly`
   - `openid`, `email`, `profile`
2. Click **Sign in with Google** in the top-right of any page (or **Connect another Google account** from `/settings`). You'll go through Google's consent screen and back. Tokens persist in `GoogleAccount`; the app immediately fetches your calendar list and caches it in `GoogleAccountCalendar`.
3. From `/settings` you can:
   - **Set default account** — picks which account is used when no override is provided.
   - **Set default calendar per account** — picks which calendar is the primary export target for a given account.
   - **Refresh calendars** — re-pull the list from Google (e.g. after creating a new calendar).
   - **Disconnect** — remove an account (keeps export history intact via `FamilyEventCalendarExport.accountEmailSnapshot`).
4. In `/admin/event-review`, approve a `FamilyEvent`. Each approved card shows a **Calendar exports** panel:
   - A green list of every existing export (account email + calendar name + timestamp + "Open in Google Calendar" deep link).
   - A grid of one-click buttons under each connected account showing every calendar that account has access to. Click any button to add this event to that specific calendar.
5. To re-issue tokens (e.g. after revoking access), use **Disconnect** then **Sign in with Google** again, or `POST /api/calendar/disconnect` with `{"accountId": "..."}`.

API surface for programmatic access:

- `GET  /api/calendar/auth?return=<path>` — start OAuth, redirect back to `<path>`.
- `GET  /api/calendar/callback` — finishes OAuth.
- `POST /api/calendar/disconnect` — `{ "accountId": "..." }` (omit to drop all accounts).
- `GET  /api/calendar/accounts` — list connected accounts + calendars.
- `PATCH /api/calendar/accounts` — `{ action, accountId, ... }` for `setDefaultAccount`, `setDefaultCalendar`, `refreshCalendars`.
- `POST /api/events/add-to-calendar` — body accepts standard `eventIds` plus optional `accountId` / `calendarId` overrides.

All paths share `lib/googleCalendar.ts`, which auto-refreshes access tokens and writes them back to Postgres on every API call.

Outbound Zapier payloads use `FamilyEventZapierPayload` from `lib/zapier.ts` (flattened JSON for Calendar + Airtable steps). Successful and failed deliveries are stored in SQLite (`ZapierWebhookLog`). When your Airtable base includes **`Zapier Webhook Status`** and **`Zapier Last Sent At`** columns on Family Events, the app updates those fields after each attempt.

Never commit populated `.env` files.
