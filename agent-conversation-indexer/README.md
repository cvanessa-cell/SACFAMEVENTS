# Agent Conversation Indexer

Indexes Cursor / agent-style work from this repository into **Airtable** as the source of truth. **Notion** and **Linear** are optional side channels (human-readable digests and ticket creation).

## Safety defaults

- **Dry-run is on by default** (`INDEXER_DRY_RUN=true`). No Airtable / Notion / Linear calls happen until you configure env vars and turn dry-run off.
- **Secrets are redacted** before sync or LLM calls (`INDEXER_REDACT_SECRETS=true`). Never place real API keys in `imports/` test files you plan to sync.
- **Cursor local storage scan is off** by default. Enable only with `INDEXER_ALLOW_CURSOR_LOCAL_SCAN=true` **and** a strict `CURSOR_LOCAL_ALLOWED_PATHS` allowlist of absolute paths.

If automated discovery of Cursor chat storage is unclear, the tool reports:

> Cursor local conversation storage was not safely discoverable. Use manual export/import folder.

## Quick start

1. Copy `agent-conversation-indexer/.env.example` → `agent-conversation-indexer/.env` (or use the repo root `.env` with the same keys).
2. Drop exports into `agent-conversation-indexer/imports/` (`.md`, `.txt`, `.json`, `.jsonl`).
3. Dry scan (default):

   ```bash
   npm run agent:index:scan
   ```

4. Review `agent-conversation-indexer/output/dry-run-results.json`.
5. Create the Airtable tables and fields listed below (or use a Personal Access Token with **schema.bases:read** so metadata discovery can confirm table names).
6. Set `INDEXER_DRY_RUN=false`, provide `AIRTABLE_API_KEY` + `AIRTABLE_BASE_ID`, then:

   ```bash
   npm run agent:index:sync
   # or force live even if env dry flag is wrong:
   npx tsx agent-conversation-indexer/src/cli.ts sync --live
   ```

7. Optional local markdown summary:

   ```bash
   npm run agent:index:report
   ```

## npm scripts (repo root)

| Script | Command |
|--------|---------|
| `npm run agent:indexer` | `tsx agent-conversation-indexer/src/cli.ts` (pass subcommands after `--`) |
| `npm run agent:index:doctor` | Validate config / defaults |
| `npm run agent:index:scan` | `scan --dry-run` |
| `npm run agent:index:sync` | Respects `INDEXER_DRY_RUN`; add `--live` via CLI for forced writes |
| `npm run agent:index:report` | Writes `output/project-agent-index.md` |
| `npm run agent:index:all` | Dry pipeline + report |

CLI flags:

```text
tsx agent-conversation-indexer/src/cli.ts scan [--dry-run|--live] [--source=all|exported|logs|cursor|reports|local]
tsx agent-conversation-indexer/src/cli.ts sync [--live] [--source=...]
tsx agent-conversation-indexer/src/cli.ts notion-sync
tsx agent-conversation-indexer/src/cli.ts linear-sync
```

## Airtable (primary database)

**Runtime sync** uses the [Airtable Web API](https://airtable.com/developers/web/api/introduction) from this package (reliable for scheduled / repeatable indexing).

**Optional:** install the **Airtable MCP** in Cursor if you want conversational CRUD while debugging — it does not replace API-based batch sync for automation.

### Environment

- `AIRTABLE_API_KEY` — PAT with `data.records:read` / `write` scopes for your base (and optionally `schema.bases:read` for metadata checks).
- `AIRTABLE_BASE_ID`
- Optional table overrides: `AIRTABLE_*_TABLE` vars (defaults match names below).

### Tables & fields

Create tables with **exact primary field labels** compatible with inserts (first column is typically the primary; you may keep auto “Name” plus the fields below):

#### 1. Agent Conversations

`Conversation ID`, `Project Name`, `Project Root`, `Source Type`, `Source Path`, `Source URL`, `Conversation Title`, `Conversation Date`, `Imported At`, `Last Synced At`, `Content Hash`, **`Dedupe Key`** (indexed / unique preferred), `Status`, `Agent Name`, `User Request`, `Short Summary`, `Detailed Summary`, `Key Outcome`, `Current State`, `Files Changed Count`, `Commands Run Count`, `Errors Count`, `Decisions Count`, `Action Items Count`, `Tags`, `Related Feature`, `Related Route`, `Related API Endpoint`, `Related Database Table`, `Related Migration`, `Related Provider`, `Related UI Page`, `Has Build Output`, `Has Test Output`, `Has Errors`, `Needs Follow-Up`, `Raw Transcript Redacted`, `Local Raw File Path`, `Notion Page URL`, `Linear Issues Created`, `Sync Notes`

Use **single select** for `Status` if desired (incoming value: `indexed`). Count fields: **number**. Booleans: **checkbox**. Long text fields for summaries and transcript excerpt.

#### 2. Agent Action Items

Includes **`Dedupe Key`**, **`Confidence`** (number), **`Action ID`**, **`Conversation ID`** (text link to indexer ID), titles, enums for `Priority`, `Status`, `Type`, `Linear Issue URL`, dates.

`Type` options: bug, feature, refactor, test, docs, migration, setup, investigation, follow-up.  
`Status` options include `sent_to_linear` after Linear automation.

#### 3. Agent Referenced Files

`File Ref ID`, `Conversation ID`, `Dedupe Key`, `File Path`, `Mention Type`, `Change Type`, `Exists Locally`, etc.

#### 4. Agent Errors

`Error ID`, `Conversation ID`, `Dedupe Key`, `Error Message`, `Status` (unresolved / resolved / ignored), etc.

#### 5. Agent Decisions

`Decision ID`, `Conversation ID`, `Dedupe Key`, `Decision`, `Rationale`, …

Upserts use **`Dedupe Key`** per table (`find` + create/update).

## Notion (optional)

Only for readable digests or per-conversation exports — **not** the system of record.

- `NOTION_ENABLED=true`
- `NOTION_API_KEY`, `NOTION_PARENT_PAGE_ID` (must accept new child pages via API)
- `NOTION_CREATE_PAGE_PER_CONVERSATION=true` for one page per conversation; otherwise a single digest page is created.

**Note:** Creating pages requires a compatible parent (often a Notion database with a Title property or a workspace template that exposes `title`). Adjust your parent if the API returns validation errors.

## Linear (optional)

Creates issues only from extracted **action items** that pass type + confidence thresholds — **never** entire transcripts.

- `LINEAR_ENABLED=true`, `LINEAR_API_KEY`, `LINEAR_TEAM_ID`
- Optional `LINEAR_PROJECT_ID`, `LINEAR_ACTION_CONFIDENCE_THRESHOLD` (default `0.6`)
- Requires **`INDEXER_DRY_RUN=false`** **and** Airtable credentials so action rows can be updated with `Linear Issue URL` + `sent_to_linear` status.

## OpenAI summarization (optional)

- `OPENAI_SUMMARIZATION_ENABLED=true`
- `OPENAI_API_KEY`
- Uses the repo dependency `openai` (already in the main `package.json`).

Fails open to heuristic summaries when the API errors.

## Import sources

1. **`imports/`** — manual exports / paste (recommended).
2. **Project logs** — common `./logs`, `./reports`, `./docs`, etc. (text-like extensions only).
3. **`.cursor/`** — safe markdown / `mcp.json` snapshots (rules/config, not full chats unless you paste them).
4. **Repo heuristic reports** — files matching phrases like “Files changed”, “Next steps”.
5. **Optional local Cursor paths** — only with allowlist paths.

## MCP setup notes

| Integration | Recommendation |
|-------------|----------------|
| **Airtable API** | Primary path for scripted sync (this tool). |
| **Airtable MCP** | Great for Cursor-driven exploration/fixups. |
| **Notion MCP** | Optional summaries / documentation helpers. |

## Tests

```bash
npx vitest run agent-conversation-indexer/tests
```

## Troubleshooting

- **422 / INVALID_MULTIPLE_CHOICE_OPTIONS** — Airtable single-select choices must include values the indexer emits (or change fields to long text temporarily).
- **403 on metadata API** — create tables manually; sync may still succeed if names match.
- **Empty `imports/`** — dry-run JSON will still include rows from `./docs`, `.cursor/rules`, etc., if matched.
