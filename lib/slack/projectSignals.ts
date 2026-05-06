type SlackSeverity = "info" | "warning" | "critical";
type SlackSignalType = "alert" | "digest" | "decision" | "incident" | "outcome";

type SlackSignalPayload = {
  type: SlackSignalType;
  severity: SlackSeverity;
  module: string;
  summary: string;
  impact?: string;
  suspectedCause?: string;
  recommendedAction?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
};

function isSlackEnabled(): boolean {
  const enabled = process.env.SLACK_SIGNALS_ENABLED?.trim().toLowerCase();
  if (!enabled) return Boolean(process.env.SLACK_WEBHOOK_URL?.trim());
  return enabled === "1" || enabled === "true" || enabled === "yes";
}

function getSlackWebhookUrl(): string | null {
  const url = process.env.SLACK_WEBHOOK_URL?.trim();
  return url ? url : null;
}

function formatSignal(payload: SlackSignalPayload): string {
  const lines = [
    `type: ${payload.type}`,
    `severity: ${payload.severity}`,
    `module: ${payload.module}`,
    `summary: ${payload.summary}`,
  ];
  if (payload.impact) lines.push(`impact: ${payload.impact}`);
  if (payload.suspectedCause) lines.push(`suspected_cause: ${payload.suspectedCause}`);
  if (payload.recommendedAction) lines.push(`recommended_action: ${payload.recommendedAction}`);
  if (payload.links?.length) lines.push(`links: ${payload.links.join(", ")}`);
  if (payload.metadata && Object.keys(payload.metadata).length) {
    lines.push(`metadata: ${JSON.stringify(payload.metadata)}`);
  }
  return lines.join("\n");
}

export async function sendSlackSignal(payload: SlackSignalPayload): Promise<void> {
  const webhookUrl = getSlackWebhookUrl();
  if (!webhookUrl || !isSlackEnabled()) return;

  const text = formatSignal(payload);
  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) {
      console.error("Slack signal failed", { status: res.status, statusText: res.statusText });
    }
  } catch (error) {
    console.error("Slack signal request error", error);
  }
}

export async function notifySourceCheckFailure(input: {
  sourceId: string;
  sourceName: string;
  sourceUrl: string;
  error: string;
}): Promise<void> {
  await sendSlackSignal({
    type: "alert",
    severity: "warning",
    module: "sourceChecker",
    summary: `Source check failed for "${input.sourceName}"`,
    impact: "Event freshness may degrade for this source until next successful run.",
    suspectedCause: input.error.slice(0, 300),
    recommendedAction: "Inspect source reachability or parser assumptions, then re-run check-now.",
    metadata: {
      source_id: input.sourceId,
      source_url: input.sourceUrl,
    },
  });
}

export async function notifySourceContentChanged(input: {
  sourceId: string;
  sourceName: string;
  sourceChangeId: string;
  aiJobId: string;
}): Promise<void> {
  await sendSlackSignal({
    type: "outcome",
    severity: "info",
    module: "sourceChecker",
    summary: `Source changed and extraction job queued for "${input.sourceName}"`,
    recommendedAction: "Track webhook completion and review newly extracted events.",
    metadata: {
      source_id: input.sourceId,
      source_change_id: input.sourceChangeId,
      ai_job_id: input.aiJobId,
    },
  });
}

export async function notifyOpenAIWebhookIssue(input: {
  eventType: string;
  sourceChangeId?: string;
  openaiResponseId?: string;
  details?: string;
}): Promise<void> {
  await sendSlackSignal({
    type: "incident",
    severity: "critical",
    module: "webhookProcessor",
    summary: `OpenAI webhook event "${input.eventType}" indicates extraction pipeline issue`,
    impact: "Event extraction may be delayed or incomplete for pending source changes.",
    suspectedCause: input.details?.slice(0, 300),
    recommendedAction: "Inspect AI job status and retry extraction from admin source-changes view if needed.",
    metadata: {
      source_change_id: input.sourceChangeId,
      openai_response_id: input.openaiResponseId,
      event_type: input.eventType,
    },
  });
}
