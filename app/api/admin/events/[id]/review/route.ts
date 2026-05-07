import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
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
  let body: { status?: string; note?: string } = {};
  const contentType = req.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    body = (await req.json().catch(() => ({}))) as { status?: string; note?: string };
  } else {
    const form = await req.formData().catch(() => null);
    body = {
      status: typeof form?.get("status") === "string" ? String(form.get("status")) : undefined,
      note: typeof form?.get("note") === "string" ? String(form.get("note")) : undefined,
    };
  }
  if (!body.status || !["approved", "rejected", "duplicate", "needs_review"].includes(body.status)) {
    return NextResponse.json({ ok: false, message: "Invalid status" }, { status: 400 });
  }
  await markProjectActivity();
  const updated = await prisma.familyEvent.update({
    where: { id: params.id },
    data: { status: body.status },
  });
  if (body.note?.trim()) {
    await prisma.eventReviewNote.create({
      data: { familyEventId: params.id, note: body.note.trim() },
    });
  }
  return NextResponse.json({ ok: true, event: updated });
}
