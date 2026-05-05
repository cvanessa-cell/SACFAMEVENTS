# Airtable schema contract

Canonical base: **FAMILY EVENTS**.

## Tables & purpose

| Table | Purpose |
| --- | --- |
| Family Event Sources | Upstream ingestion targets (official sites > Facebook duplicates). |
| Family Event Venues | Normalized place metadata (amenities, indoor/outdoor, parking hints). |
| Family Event Categories | Calendar prefix/color defaults that feed Google Calendar naming. |
| Family Events | Master event records surfaced in the Next.js `/events` experience. |

## Field references

Mirrors fields described in README + `familyEventSchema` inside `lib/validation.ts`.

### Linked records caveat

Venue/category links return record IDs unless you expose lookup fields (“Venue Name (from Venue)” etc.). The mapper currently stringifies primitives; enrich Airtable with friendly lookups for better UI output.

### Status workflow

1. `Need Review` – ingestion / OpenAI ambiguity.
2. `Confirmed` – human or high-confidence automation.
3. `Added to Calendar` – Google insert succeeded AND Airtable patch recorded.
4. `Expired`, `Duplicate`, `Rejected` – terminal hygiene states.

## Sync playbook

1. Capture field IDs (`scripts/syncAirtableSchema.ts`).
2. Keep `.env.example` aligned with renamed tables/views.
3. Run `npm run seed:sources` / `seed:categories` after API keys exist.
