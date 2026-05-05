# Source discovery pipeline

Goals:

1. Keep Airtable as the ingestion ledger (never Calendar).
2. Treat official venue/city calendars as authoritative over Facebook chatter.
3. Record raw fetch text + URLs for auditing.

Stages:

| Stage | Description |
| --- | --- |
| Source catalog | Seeds + GPT-assisted expansion (`lib/openai.ts` placeholder). |
| Fetch | Lightweight HTTP retrieval with generous timeouts / manual review flags when blocked |
| Structure | GPT JSON adhering to `openAIExtractionResponseSchema` |
| QA | Confidence scoring → `Need Review` until accepted |
| Dedupe | `buildNormalizedEventKey` + `pickWinnerForDuplicates` |

## Prompt seed

> “Create an extensive detailed list of at least 100 top places to find kid/family-friendly events in or around the Sacramento/Placer area…”

Store results into `Family Event Sources` (`scripts/seedSources.ts` scaffolding).

## Manual safeguards

Sites that forbid scraping stay in Airtable with `Requires Manual Review?`, `Best Effort scrape`, or Zapier-mediated workflows.
