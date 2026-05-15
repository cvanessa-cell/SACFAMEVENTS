# SacFamEvents Airtable Source Workflow Schema

This document defines the Airtable base used by the OpenAI + Airtable source-research workflow. It is separate from the older `FAMILY EVENTS` contract in `docs/AIRTABLE_SCHEMA.md`, which still documents the existing public event/source tables.

## Base

Base name: `SacFamEvents Source Database`

## Tables

1. `Event Sources`
2. `Source Research Runs`
3. `Source Candidates`
4. `Event Candidates`
5. `Admin Review Queue` (optional)

## Event Sources

Approved source catalog. The app and automation should treat only approved rows as production-ready.

| Field | Type |
| --- | --- |
| Source Name | Single line text |
| Website / Social Link | URL |
| Source Category | Single select |
| Source Type | Single select |
| City / Area Served | Single line text |
| County / Region | Single line text |
| Event Types | Multiple select or long text |
| Family Relevance | Long text |
| Why Useful for SacFamEvents | Long text |
| Estimated Update Frequency | Single line text |
| Freshness Likelihood | Single select |
| Automation Fit | Single select |
| Recommended Ingestion Method | Single select |
| Review Priority | Single select |
| Relevance Score | Number |
| Verification Status | Single select |
| Status | Single select |
| Notes | Long text |
| Last Checked At | Date/time |
| Created By AI | Checkbox |
| Research Run ID | Single line text |
| Duplicate Check Key | Single line text |

## Source Research Runs

Audit records for each OpenAI source-research request.

| Field | Type |
| --- | --- |
| Run ID | Single line text |
| Status | Single select |
| Requested Source Count | Number |
| Model | Single line text |
| Prompt Version | Single line text |
| Started At | Date/time |
| Completed At | Date/time |
| Parsed Source Count | Number |
| Saved Candidate Count | Number |
| Duplicate Count | Number |
| Error Message | Long text |
| Raw Response Preview | Long text |

## Source Candidates

Proposed sources produced by OpenAI and held for admin review.

| Field | Type |
| --- | --- |
| Candidate ID | Single line text |
| Research Run ID | Single line text |
| Source Name | Single line text |
| Website / Social Link | URL |
| Source Category | Single select |
| Source Type | Single select |
| City / Area Served | Single line text |
| County / Region | Single line text |
| Event Types | Multiple select or long text |
| Family Relevance | Long text |
| Why Useful for SacFamEvents | Long text |
| Estimated Update Frequency | Single line text |
| Freshness Likelihood | Single select |
| Automation Fit | Single select |
| Recommended Ingestion Method | Single select |
| Review Priority | Single select |
| Relevance Score | Number |
| Verification Status | Single select |
| Status | Single select |
| Notes | Long text |
| Duplicate Check Key | Single line text |
| Duplicate Of | Single line text |
| Import Status | Single select |

## Event Candidates

Foundation for future event-monitoring review before public display or Google Calendar export.

| Field | Type |
| --- | --- |
| Event Title | Single line text |
| Event URL | URL |
| Source Name | Single line text |
| Source URL | URL |
| Event Date | Date |
| Start Time | Single line text |
| End Time | Single line text |
| Location Name | Single line text |
| Street Address | Single line text |
| City | Single line text |
| County / Region | Single line text |
| Event Category | Single select |
| Family Age Range | Single line text |
| Cost | Single line text |
| Registration Required | Checkbox |
| Description Summary | Long text |
| Why Relevant for Families | Long text |
| Confidence Score | Number |
| Admin Review Required | Checkbox |
| Calendar Ready | Single select |
| Missing Fields | Long text |
| Review Status | Single select |
| Notes | Long text |

## Allowed Select Options

### Source Category

- City and County Event Calendars
- Parks and Recreation
- Public Libraries
- Museums and Children's Museums
- Zoos and Nature Centers
- Theaters and Performance Venues
- Concert and Entertainment Venues
- Farmers Markets
- Festivals and Fairs
- School and Community Education
- Parent Blogs and Family Guides
- Local News Calendars
- Tourism and Visitor Bureaus
- Facebook / Instagram
- Event Platforms
- Churches and Nonprofits
- Sports and Family Entertainment
- Enrichment Programs
- Other

### Source Type

- official
- aggregator
- social
- venue
- community
- media
- education
- recreation
- nonprofit
- other

### Freshness Likelihood

- low
- medium
- high

### Automation Fit

- excellent
- good
- fair
- poor
- manual_only

### Recommended Ingestion Method

- official_calendar_monitoring
- event_page_scrape_with_review
- rss_or_feed_monitoring
- social_monitoring_manual_review
- event_platform_search
- admin_manual_entry
- zapier_or_webhook_possible
- airtable_manual_source_tracking
- api_possible
- not_recommended_for_automation

### Review Priority

- high
- medium
- low

### Verification Status

- verified
- likely_valid
- needs_verification

### Status

- proposed
- approved
- rejected
- paused
- archived

### Import Status

- pending_review
- imported
- duplicate
- rejected
- needs_verification

### Event Review Status

- pending
- approved
- rejected
- needs_edit
- duplicate

## Operational Notes

- The backend uses the Airtable Web API for reliable automation.
- Airtable MCP is optional and intended for human-in-the-loop review from Cursor or ChatGPT.
- Candidate rows should not be deleted automatically. Use status fields for review history.
- Approved source rows should include a stable `Duplicate Check Key` so later runs can detect duplicates.
