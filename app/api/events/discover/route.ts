import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    message:
      "Event discovery orchestration arrives in Milestone 5 (/lib/eventExtraction + OpenAI workflows).",
  });
}
