import { NextResponse } from "next/server";

import { verifyOpenAIWebhook } from "@/lib/openai/webhookProcessor";
import { enqueueOpenAIWebhookTask } from "@/lib/openai/webhookQueue";

export async function POST(req: Request) {
  const rawBody = await req.text();
  const headers: Record<string, string> = {};
  req.headers.forEach((value, key) => {
    headers[key] = value;
  });

  const verified = await verifyOpenAIWebhook(rawBody, headers);
  if (!verified.ok) {
    return NextResponse.json({ ok: false, message: verified.message }, { status: verified.status });
  }
  const task = await enqueueOpenAIWebhookTask(verified.event as { type: string; data?: { id?: string } });
  return NextResponse.json(
    { ok: true, enqueued: true, taskId: task?.id ?? null },
    { status: 200 },
  );
}
