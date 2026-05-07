export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: true,
    message: "SQLite-backed settings hydrate here after Prisma client bootstrapping.",
    defaults: {
      automationEnabled: false,
      frequency: "weekly",
      autoAddToCalendar: false,
    },
  });
}
