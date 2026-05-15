export type SourceKind =
  | "exported_file"
  | "project_log"
  | "cursor_project_file"
  | "repo_agent_report"
  | "cursor_local_optional";

export type ReferencedFile = {
  filePath: string;
  mentionType:
    | "mentioned"
    | "read"
    | "created"
    | "modified"
    | "deleted"
    | "tested"
    | "unknown";
  summary?: string;
};

export type CommandRun = {
  command: string;
};

export type ExtractedError = {
  message: string;
  type?: string;
  command?: string;
  filePath?: string;
};

export type ExtractedDecision = {
  text: string;
  rationale?: string;
  relatedFile?: string;
  relatedFeature?: string;
};

export type ExtractedActionItem = {
  title: string;
  description?: string;
  metadata?: Record<string, unknown>;
  type:
    | "bug"
    | "feature"
    | "refactor"
    | "test"
    | "docs"
    | "migration"
    | "setup"
    | "investigation"
    | "follow-up";
  priority?: "urgent" | "high" | "medium" | "low";
  relatedFile?: string;
  confidence: number;
  status?: "new" | "reviewed" | "in_progress" | "done" | "ignored" | "sent_to_linear";
};

export type NormalizedConversation = {
  id: string;
  projectName: string;
  projectRoot: string;
  sourceType: SourceKind;
  sourcePath?: string;
  sourceUrl?: string;
  title?: string;
  conversationDate?: string;
  importedAt: string;
  rawText: string;
  redactedText: string;
  contentHash: string;
  dedupeKey: string;
  userRequest?: string;
  agentName?: string;
  shortSummary?: string;
  detailedSummary?: string;
  keyOutcome?: string;
  currentState?: string;
  filesReferenced: ReferencedFile[];
  commandsRun: CommandRun[];
  errors: ExtractedError[];
  decisions: ExtractedDecision[];
  actionItems: ExtractedActionItem[];
  tags: string[];
  metadata: Record<string, unknown>;
};

export type RawSourcePayload = {
  sourceType: SourceKind;
  sourcePath?: string;
  sourceUrl?: string;
  rawText: string;
  suggestedTitle?: string;
  conversationDate?: string;
  metadata?: Record<string, unknown>;
};

export type IndexerDryRunPayload = {
  conversations: NormalizedConversation[];
  airtableConversationPayloads: Record<string, unknown>[];
  airtableChildren: {
    files: Record<string, unknown>[];
    errors: Record<string, unknown>[];
    decisions: Record<string, unknown>[];
    actions: Record<string, unknown>[];
  };
  notionPlannedPages: number;
  linearPlannedIssues: number;
};
