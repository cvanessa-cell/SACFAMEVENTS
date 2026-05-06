import { NextResponse } from "next/server";

import { processPendingOpenAIWebhookTasks } from "@/lib/openai/webhookQueue";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const results = await processPendingOpenAIWebhookTasks(20);
  return NextResponse.json({ ok: true, processed: results.length, results });
}
