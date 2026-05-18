# SacFamEvents Airtable Interface Setup

Use this checklist to add a human-friendly **Airtable Interface** for the source-research workflow. The SacFamEvents app keeps using the **Web API**; the Interface is for browsing and light edits in Airtable.

**Base ID:** `app0tfryJgq6BAUJJ`  
**Existing Interface (legacy events):** `Family Events/Things To Do` (`pbdularoo4IXbBnDP`)

---

## Choose your layout

### Option A — Extend the existing Interface (recommended)

Keeps family events and source research in one place.

1. Open [your base](https://airtable.com/app0tfryJgq6BAUJJ).
2. Click **Interfaces** → open **Family Events/Things To Do**.
3. Click **Edit** (pencil) → **Add page** for each row below.

### Option B — New Interface

1. **Interfaces** → **Create interface** → name it **SacFam Source Research**.
2. Add the pages below.

---

## Pages to add (4 list pages)

### 1. Source candidates (review queue)

| Setting | Value |
|--------|--------|
| Page type | **List** |
| Table | **Source Candidates** |
| Suggested name | `Source candidates — review` |

**Filter (recommended):**

- `Import Status` is any of: `pending_review`, `needs_verification`
- Optional: `Status` is `proposed`

**Visible columns (minimum):**

Source Name, Website / Social Link, Source Category, City / Area Served, Review Priority, Verification Status, Relevance Score, Automation Fit, Import Status, Notes

**Sort:** Review Priority (high first), then Relevance Score (desc)

---

### 2. Approved event sources (catalog)

| Setting | Value |
|--------|--------|
| Page type | **List** |
| Table | **Event Sources** |
| Suggested name | `Approved sources` |

**Filter:**

- `Status` is `approved`

**Visible columns:**

Source Name, Website / Social Link, Source Category, Automation Fit, Recommended Ingestion Method, City / Area Served, Verification Status, Relevance Score, Last Checked At

**Optional second page:** same table, filter `Automation Fit` is `excellent` or `good` → name `Automation-ready sources`

---

### 3. Source research runs (audit)

| Setting | Value |
|--------|--------|
| Page type | **List** |
| Table | **Source Research Runs** |
| Suggested name | `Research runs` |

**Sort:** Started At (newest first)

**Visible columns:**

Run ID, Status, Requested Source Count, Parsed Source Count, Saved Candidate Count, Duplicate Count, Model, Started At, Completed At, Error Message

---

### 4. Event candidates (monitor queue)

| Setting | Value |
|--------|--------|
| Page type | **List** |
| Table | **Event Candidates** |
| Suggested name | `Event candidates` |

**Filter:**

- `Review Status` is `pending`

**Visible columns:**

Event Title, Event Date, City, Source Name, Confidence Score, Calendar Ready, Review Status, Event URL

---

## Optional overview page

Add an **Overview** page at the top with:

```markdown
# SacFam Source Research

- Run AI research in the app: `/admin/sources/research`
- Review candidates here before they become approved **Event Sources**
- Strong candidates (score > 0.5) may auto-import when dry-run is off — still verify in Airtable
- Do not delete rows; use Status / Import Status fields
```

---

## Share the Interface

1. In the Interface editor, click **Share**.
2. **Invite** collaborators with **Editor** (review) or **Commenter** (read-only).
3. Or turn on **Share publicly** → copy link (only if you accept the privacy tradeoff).

Copy the share URL into `.env`:

```env
AIRTABLE_INTERFACE_URL="https://airtable.com/app0tfryJgq6BAUJJ/pbdXXXXXXXXXXXXXX"
```

Or set only the interface ID:

```env
AIRTABLE_INTERFACE_ID="pbdularoo4IXbBnDP"
```

Restart the dev server. Admin pages will show **Open Interface**.

---

## Direct table links (work before Interface is built)

| Table | URL |
|-------|-----|
| Source Candidates | https://airtable.com/app0tfryJgq6BAUJJ/tblmek2qKf6nmR8pJ |
| Event Sources | https://airtable.com/app0tfryJgq6BAUJJ/tblBJT4KAtUYKtV9I |
| Source Research Runs | https://airtable.com/app0tfryJgq6BAUJJ/tblQ6kig948uYfdvU |
| Event Candidates | https://airtable.com/app0tfryJgq6BAUJJ/tblqAm11SlU9CK2nM |

SacFamEvents admin already includes **Open table in Airtable** buttons using these links.

---

## Workflow roles (avoid confusion)

| Tool | Use for |
|------|---------|
| **SacFamEvents** `/admin/sources/*` | Run research, auto-import, approve into Prisma + production |
| **Airtable Interface** | Browse, filter, notes, manual spot-checks |
| **Airtable MCP** (Cursor) | Bulk review summaries, duplicate reports |

Approving in Airtable alone does **not** update Prisma unless you also approve in the app (or a future sync is added).

---

## After setup

1. Run source research once from `/admin/sources/research`.
2. Open **Source candidates** in the Interface and confirm rows appear.
3. Set `AIRTABLE_INTERFACE_URL` in `.env` if you want the **Open Interface** button.
