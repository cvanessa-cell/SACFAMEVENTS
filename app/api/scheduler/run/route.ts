import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    message:
      'Wire this route to cron / Zapier authenticated calls when automation is configured.',
    hint: ["node-cron (local)", "vercel cron", "github actions"],
  });
}
