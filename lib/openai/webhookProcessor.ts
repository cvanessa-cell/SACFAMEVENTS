import { prisma } from "@/lib/prisma";
import { getOpenAIClient } from "@/lib/openai/client";
import { eventExtractionSchema } from "@/lib/events/eventExtractionSchema";
import { upsertExtractedEvents } from "@/lib/events/upsertExtractedEvents";
import { notifyOpenAIWebhookIssue } from "@/lib/slack/projectSignals";

type HeaderBag = Record<string, string>;

type OpenAIResponseShape = {
  output_text?: string;
  output?: Array<{ content?: Array<{ text?: string }> }>;
};

function extractOutputText(response: OpenAIResponseShape): string {
  if (typeof response.output_text === "string" && response.output_text.trim()) {
    return response.output_text;
  }
  const out = response.output;
  if (!Array.isArray(out)) return "";
  for (const entry of out) {
    const content = entry?.content;
    if (!Array.isArray(content)) continue;
    for (const c of content) {
      if (typeof c?.text === "string" && c.text.trim()) return c.text;
    }
  }
  return "";
}

async function handleVerifiedEvent(event: { type?: string; data?: { id?: string } }) {
  const responseId = event.data?.id;
  if (!responseId) {
    return { ok: true, status: 200, message: "Ignored event without response id" };
  }
  const client = getOpenAIClient();

  const job = await prisma.aiEventExtractionJob.findUnique({
    where: { openaiResponseId: responseId },
    include: { sourceChange: { include: { source: true } } },
  });
  if (!job) return { ok: true, status: 200, message: "No matching job" };

  if (event.type === "response.failed") {
    await prisma.aiEventExtractionJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: JSON.stringify(event.data ?? {}) },
    });
    await prisma.sourceChange.update({ where: { id: job.sourceChangeId }, data: { status: "ai_failed" } });
    await notifyOpenAIWebhookIssue({
      eventType: event.type,
      sourceChangeId: job.sourceChangeId,
      openaiResponseId: responseId,
      details: JSON.stringify(event.data ?? {}),
    });
    return { ok: true, status: 200, message: "Failed handled" };
  }

  if (event.type === "response.incomplete") {
    await prisma.aiEventExtractionJob.update({
      where: { id: job.id },
      data: { status: "incomplete", errorMessage: JSON.stringify(event.data ?? {}) },
    });
    await notifyOpenAIWebhookIssue({
      eventType: event.type,
      sourceChangeId: job.sourceChangeId,
      openaiResponseId: responseId,
      details: JSON.stringify(event.data ?? {}),
    });
    return { ok: true, status: 200, message: "Incomplete handled" };
  }

  if (event.type === "response.cancelled") {
    await prisma.aiEventExtractionJob.update({
      where: { id: job.id },
      data: { status: "cancelled", errorMessage: JSON.stringify(event.data ?? {}) },
    });
    await notifyOpenAIWebhookIssue({
      eventType: event.type,
      sourceChangeId: job.sourceChangeId,
      openaiResponseId: responseId,
      details: JSON.stringify(event.data ?? {}),
    });
    return { ok: true, status: 200, message: "Cancelled handled" };
  }

  if (event.type !== "response.completed") {
    return { ok: true, status: 200, message: "Unhandled event type" };
  }

  try {
    const fullResponse = (await client.responses.retrieve(responseId)) as OpenAIResponseShape;
    const rawText = extractOutputText(fullResponse);
    const parsedRaw = JSON.parse(rawText);
    const parsed = eventExtractionSchema.parse(parsedRaw);

    await upsertExtractedEvents({
      source: job.sourceChange.source,
      sourceChange: job.sourceChange,
      parsed,
      autoApproveConfidence: Number(process.env.EVENT_EXTRACTION_AUTO_APPROVE_CONFIDENCE ?? "0.88"),
    });

    await prisma.aiEventExtractionJob.update({
      where: { id: job.id },
      data: {
        status: "completed",
        rawResponseText: rawText,
        parsedJson: JSON.stringify(parsed),
      },
    });
    await prisma.sourceChange.update({ where: { id: job.sourceChangeId }, data: { status: "ai_completed" } });
    return { ok: true, status: 200, message: "Completed handled" };
  } catch (error) {
    const details = error instanceof Error ? error.message : "Unknown webhook processing error";
    await prisma.aiEventExtractionJob.update({
      where: { id: job.id },
      data: { status: "failed", errorMessage: details },
    });
    await prisma.sourceChange.update({ where: { id: job.sourceChangeId }, data: { status: "ai_failed" } });
    await notifyOpenAIWebhookIssue({
      eventType: "response.completed_parse_failed",
      sourceChangeId: job.sourceChangeId,
      openaiResponseId: responseId,
      details,
    });
    return { ok: false, status: 500, message: "Completed event processing failed" };
  }
}

export async function processOpenAIWebhook(rawBody: string, headers: HeaderBag) {
  const verified = await verifyOpenAIWebhook(rawBody, headers);
  if (!verified.ok) {
    return { ok: false, status: verified.status, message: verified.message };
  }
  return handleVerifiedEvent(verified.event);
}

export async function verifyOpenAIWebhook(rawBody: string, headers: HeaderBag) {
  const secret = process.env.OPENAI_WEBHOOK_SECRET?.trim();
  if (!secret) {
    return { ok: false, status: 500, message: "OPENAI_WEBHOOK_SECRET missing" as const };
  }
  const client = getOpenAIClient();
  try {
    const event = client.webhooks.unwrap(rawBody, headers, { secret }) as {
      type?: string;
      data?: { id?: string };
    };
    return { ok: true, status: 200, event };
  } catch {
    return { ok: false, status: 400, message: "Invalid signature" as const };
  }
}

export async function processOpenAIWebhookTaskEvent(event: { type?: string; data?: { id?: string } }) {
  return handleVerifiedEvent(event);
}
