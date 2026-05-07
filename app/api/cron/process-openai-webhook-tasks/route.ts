export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { processPendingOpenAIWebhookTasks } from "@/lib/openai/webhookQueue";

function isAuthorized(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const results = await processPendingOpenAIWebhookTasks(20);
  return NextResponse.json({ ok: true, processed: results.length, results });
}

export async function POST(req: Request) {
  return GET(req);
}
