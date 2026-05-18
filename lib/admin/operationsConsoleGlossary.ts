export interface GlossaryEntry {
  term: string;
  definition: string;
}

export interface GlossarySection {
  id: string;
  title: string;
  items: GlossaryEntry[];
}

export const OPERATIONS_CONSOLE_GLOSSARY: GlossarySection[] = [
  {
    id: "navigation",
    title: "Navigation tabs",
    items: [
      {
        term: "Monitoring",
        definition:
          "Health dashboard: source counts, AI job status, webhook queue, and quick links.",
      },
      {
        term: "Sources",
        definition:
          "Operational event-source table — check URLs, enable/disable sources, run AI monitor.",
      },
      {
        term: "Airtable sources",
        definition:
          "Approved source catalog in Airtable for human review and MCP workflows.",
      },
      {
        term: "AI source research",
        definition:
          "Run the AI agent to discover new venue/site candidates for the region.",
      },
      {
        term: "Source candidates",
        definition:
          "Review AI-discovered sources before they are added to the live catalog.",
      },
      {
        term: "Review queue",
        definition:
          "Human review of extracted family events before they appear on the public site.",
      },
      {
        term: "AI event candidates",
        definition:
          "Staging events from the on-demand AI monitor; approve to promote into FamilyEvent.",
      },
    ],
  },
  {
    id: "monitoring-stats",
    title: "Monitoring — stat cards",
    items: [
      {
        term: "Sources",
        definition: "Total EventSource rows configured in the database.",
      },
      {
        term: "Pending AI jobs",
        definition:
          "OpenAI extraction jobs still waiting (status created or sent) for webhook completion.",
      },
      {
        term: "Failed AI jobs",
        definition:
          "Extraction jobs that failed, were incomplete, or were cancelled.",
      },
      {
        term: "Needs review",
        definition:
          "Family events with status needs_review awaiting admin approval.",
      },
    ],
  },
  {
    id: "monitoring-actions",
    title: "Monitoring — actions",
    items: [
      {
        term: "Run discovery now",
        definition:
          "Checks a batch of due sources (same as cron): fetch URL, hash content, enqueue AI if changed.",
      },
      {
        term: "Process queue now",
        definition:
          "Processes pending OpenAI webhook tasks so completed extractions land in the review queue.",
      },
      {
        term: "Webhook queue — Pending",
        definition: "Webhook tasks waiting to be processed.",
      },
      {
        term: "Webhook queue — Processing",
        definition: "Webhook tasks currently being handled.",
      },
      {
        term: "Webhook queue — Failed",
        definition: "Webhook tasks that errored and may need retry or inspection.",
      },
    ],
  },
  {
    id: "source-stats",
    title: "Event sources — stat cards",
    items: [
      {
        term: "Total sources",
        definition: "All configured upstream URLs in the system.",
      },
      {
        term: "Enabled",
        definition: "Sources with monitoring turned on; included in discovery and cron.",
      },
      {
        term: "Last status: failed",
        definition: "Sources whose most recent check ended in an error.",
      },
      {
        term: "Due for check",
        definition:
          "Enabled sources past their check interval and eligible for the next scheduled fetch.",
      },
      {
        term: "Pending AI extraction",
        definition:
          "Source changes detected but still waiting for the hash-pipeline extraction job.",
      },
    ],
  },
  {
    id: "source-filters",
    title: "Event sources — filters",
    items: [
      {
        term: "all",
        definition: "Show every source regardless of status.",
      },
      {
        term: "enabled",
        definition: "Only sources actively included in discovery checks.",
      },
      {
        term: "disabled",
        definition: "Sources turned off; checks are skipped.",
      },
      {
        term: "failed",
        definition: "Sources whose last check failed (network, parse, or config error).",
      },
      {
        term: "due",
        definition: "Sources overdue for a check based on their interval setting.",
      },
    ],
  },
  {
    id: "source-badges",
    title: "Event sources — status badges",
    items: [
      {
        term: "Enabled",
        definition: "Source is on and will be checked by Run discovery now and cron.",
      },
      {
        term: "Disabled",
        definition: "Source is off; automatic and manual batch checks skip it.",
      },
      {
        term: "unchanged",
        definition: "Last fetch succeeded; page content hash matches the previous check.",
      },
      {
        term: "changed",
        definition:
          "Content hash changed; a source change was recorded and an AI extraction job was queued.",
      },
      {
        term: "failed",
        definition: "Last fetch or parse failed — see the error text under the URL.",
      },
      {
        term: "never",
        definition: "This source has not completed a successful check yet.",
      },
      {
        term: "skipped",
        definition:
          "Check was skipped because the source is disabled or uses a non-automated fetch strategy.",
      },
      {
        term: "Due",
        definition:
          "Enabled source is past its check interval (e.g. every 360m) and should be checked soon.",
      },
    ],
  },
  {
    id: "source-actions",
    title: "Event sources — row actions",
    items: [
      {
        term: "Check now",
        definition:
          "Immediately fetch this URL, hash content, and enqueue an OpenAI extraction job if the page changed.",
      },
      {
        term: "Disable / Enable",
        definition:
          "Toggle whether this source participates in discovery and scheduled checks.",
      },
      {
        term: "AI monitor",
        definition:
          "On-demand AI read of the page; results go to AI event candidates (separate from the hash/change pipeline).",
      },
      {
        term: "Retry AI",
        definition:
          "Re-queue an OpenAI extraction job for a source change (if the first job failed or you want a redo).",
      },
    ],
  },
  {
    id: "pipelines",
    title: "Two AI pipelines",
    items: [
      {
        term: "Change detection pipeline",
        definition:
          "Check now / Run discovery → hash compare → extraction job → webhook → Review queue (FamilyEvents).",
      },
      {
        term: "AI monitor pipeline",
        definition:
          "AI monitor button → structured event list → AI event candidates → approve to FamilyEvent.",
      },
    ],
  },
  {
    id: "other",
    title: "Other controls",
    items: [
      {
        term: "AI design assistant (chat icon)",
        definition:
          "Floating UI customization chat for colors and layout — not related to event discovery.",
      },
      {
        term: "Google account (header)",
        definition:
          "Connect Google Calendar to export approved events from the review queue.",
      },
    ],
  },
];

export function glossaryDefinition(
  sectionId: string,
  term: string,
): string | undefined {
  const section = OPERATIONS_CONSOLE_GLOSSARY.find((s) => s.id === sectionId);
  return section?.items.find((item) => item.term === term)?.definition;
}

export function glossaryDefinitionAny(term: string): string | undefined {
  for (const section of OPERATIONS_CONSOLE_GLOSSARY) {
    const match = section.items.find((item) => item.term === term);
    if (match) return match.definition;
  }
  return undefined;
}
