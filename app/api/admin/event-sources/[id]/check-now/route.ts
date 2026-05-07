import { NextResponse } from "next/server";

import { checkSingleSource } from "@/lib/events/sourceChecker";
import { markProjectActivity } from "@/lib/project/activityHeartbeat";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return process.env.NODE_ENV !== "production";
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function POST(req: Request, { params }: { params: { id: string } }) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  await markProjectActivity();
  const result = await checkSingleSource(params.id);
  return NextResponse.json({ ok: true, sourceId: params.id, result });
}
