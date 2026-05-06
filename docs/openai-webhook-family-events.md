# OpenAI Webhook + Source Change Monitoring

## OpenAI dashboard settings

- Name: `Family Events - OpenAI Processing Complete`
- URL: `https://YOUR-DOMAIN.com/api/webhooks/openai`
- Local test URL: `https://YOUR-NGROK-OR-CLOUDFLARE-TUNNEL-URL/api/webhooks/openai`
- Event types:
  - `response.completed`
  - `response.failed`
  - `response.incomplete`
  - `response.cancelled`

## Local tunnel flow

1. Start app on localhost:3000 (or your configured local port).
2. Start ngrok or Cloudflare Tunnel.
3. Copy the public HTTPS URL.
4. Add `/api/webhooks/openai`.
5. Paste that URL into the OpenAI webhook dashboard.
6. Copy the signing secret into `OPENAI_WEBHOOK_SECRET`.
7. Trigger a background response from the app via source checks.
8. Confirm webhook receipt in route logs/admin UI.

## Architecture

- Source checker detects website/calendar changes using hash comparison.
- OpenAI analyzes only changed content in background responses.
- OpenAI webhook notifies the app when processing completes.
- App verifies and enqueues webhook tasks immediately, then background cron processes tasks to retrieve full response, validate structured JSON, and update review queue.

## Required environment variables

```env
OPENAI_API_KEY=
OPENAI_WEBHOOK_SECRET=
OPENAI_MODEL=gpt-5.5
APP_BASE_URL=http://localhost:3000
CRON_SECRET=
EVENT_SOURCE_CHECK_BATCH_SIZE=20
EVENT_SOURCE_DEFAULT_CHECK_INTERVAL_MINUTES=360
EVENT_EXTRACTION_AUTO_APPROVE_CONFIDENCE=0.88
EVENT_TIMEZONE=America/Los_Angeles
```

## Cron configuration

- Vercel cron is configured in `vercel.json` for every 6 hours.
- Vercel cron is also configured to process OpenAI webhook tasks every 5 minutes.
- Alternative scheduler command:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "$APP_BASE_URL/api/cron/check-event-sources"
curl -H "Authorization: Bearer $CRON_SECRET" "$APP_BASE_URL/api/cron/process-openai-webhook-tasks"
```

## Important compliance notes

- Do not scrape private Facebook groups/pages or logged-in/private sources.
- Do not bypass robots/paywalls/login protections.
- For Facebook, use manual import, public page URLs, public event links, or review workflows.
- Uncertain fields must remain `needs_human_review=true`.
