export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  const reviewStatus = searchParams.get("reviewStatus");
  const where = reviewStatus ? { reviewStatus } : undefined;
  const candidates = await prisma.eventCandidate.findMany({
    where,
    orderBy: [{ confidenceScore: "desc" }, { createdAt: "desc" }],
    take: 100,
  });
  return NextResponse.json({ ok: true, candidates });
}
