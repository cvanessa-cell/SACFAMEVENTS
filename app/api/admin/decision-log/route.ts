export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { markProjectActivity } from "@/lib/project/activityHeartbeat";
import { sendSlackSignal } from "@/lib/slack/projectSignals";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

type DecisionLogBody = {
  summary?: string;
  rationale?: string;
  module?: string;
  severity?: "info" | "warning" | "critical";
  recommendedAction?: string;
  links?: string[];
  metadata?: Record<string, unknown>;
};

export async function POST(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => ({}))) as DecisionLogBody;
  if (!body.summary?.trim()) {
    return NextResponse.json({ ok: false, message: "summary is required" }, { status: 400 });
  }

  await markProjectActivity();
  await sendSlackSignal({
    type: "decision",
    severity: body.severity ?? "info",
    module: body.module?.trim() || "projectDirection",
    summary: body.summary.trim(),
    suspectedCause: body.rationale?.trim(),
    recommendedAction: body.recommendedAction?.trim(),
    links: body.links,
    metadata: body.metadata,
  });

  return NextResponse.json({ ok: true, message: "Decision logged to Slack" });
}
