import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json({
    ok: false,
    message:
      'OAuth callbacks will persist refresh tokens securely in SQLite via Prisma (server-side only).',
  });
}
