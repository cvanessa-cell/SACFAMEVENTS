export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

function isAllowed(req: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(req: Request, { params }: { params: { id: string } }) {
  if (!isAllowed(req)) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const run = await prisma.sourceResearchRun.findUnique({
    where: { id: params.id },
    include: {
      candidates: { orderBy: { deterministicScore: "desc" } },
    },
  });
  if (!run) {
    return NextResponse.json({ ok: false, message: "Run not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true, run });
}
