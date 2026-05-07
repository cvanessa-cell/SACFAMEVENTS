import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { createEventExtractionJob } from "@/lib/openai/createEventExtractionJob";
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
  const change = await prisma.sourceChange.findUnique({
    where: { id: params.id },
    include: { source: true },
  });
  if (!change || !change.source) {
    return NextResponse.json({ ok: false, message: "Source change not found" }, { status: 404 });
  }
  const job = await createEventExtractionJob({
    sourceChangeId: change.id,
    sourceName: change.source.name,
    sourceUrl: change.source.sourceUrl,
    sourceCategory: change.source.category,
    changedText: change.fullSnapshotText ?? change.changedTextExcerpt ?? "",
  });
  return NextResponse.json({ ok: true, jobId: job.id, openaiResponseId: job.openaiResponseId });
}
