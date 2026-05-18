# SacFamEvents Airtable MCP Workflow

Airtable MCP is for natural-language review and cleanup of the SacFamEvents source database from Cursor or ChatGPT-style tools. The SacFamEvents backend uses the Airtable Web API for reliable server-side automation.

## Roles

- Airtable Web API: production backend writes for source research runs, candidates, approvals, and source catalog updates.
- Airtable MCP: human-in-the-loop review, deduplication, prioritization, and reporting.
- Prisma: operational event-monitoring state and local audit mirror for existing admin pages.

MCP permissions mirror the connected Airtable user's permissions. Do not treat MCP as a privileged production write path unless the user intentionally grants that access.

For building and sharing an Airtable Interface (review UI in Airtable), see [SACFAM_AIRTABLE_INTERFACE_SETUP.md](./SACFAM_AIRTABLE_INTERFACE_SETUP.md).

## Recommended MCP Uses

- Review proposed sources by category, priority, verification status, and automation fit.
- Find duplicates by URL, domain, source name, city, or category.
- Identify sources that need manual verification before approval.
- Group approved sources by recommended ingestion method for event-monitoring rollout.
- Produce admin review summaries without deleting records.

## Guardrails

- Do not approve anything automatically through MCP.
- Do not delete records as part of routine cleanup; mark exact duplicates as rejected or duplicate.
- Do not encourage private, login-only, paywalled, or platform-restricted scraping.
- Keep AI-generated rows proposed until a human verifies them.

## Example MCP Review Prompts

Prompt 1:

```text
Review the proposed SacFamEvents sources in Airtable. Find duplicates, weak sources, sources that need verification, and sources that appear strong enough for admin approval. Do not approve anything automatically. Return a review summary grouped by category.
```

Prompt 2:

```text
Find all proposed SacFamEvents sources with verification_status = needs_verification. Create a short admin checklist explaining what needs to be manually verified before approval.
```

Prompt 3:

```text
Find all approved SacFamEvents sources with automation_fit = excellent or good. Group them by recommended_ingestion_method and tell me which ones should be connected first to the app's event-monitoring workflow.
```

Prompt 4:

```text
Find duplicate SacFamEvents source candidates by similar URL, source name, domain, or area served. Mark exact duplicates for rejection, but do not delete any records.
```

## Event Monitoring Foundation

The source workflow prepares approved sources for a later event-monitoring flow. Event candidates should be stored for review before public display or Google Calendar export. The monitor prompt and schema require candidates to list missing fields and only mark `calendar_ready` as `yes` when title, date/time, location, and source URL are sufficient.
