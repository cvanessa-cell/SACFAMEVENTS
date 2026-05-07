import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: "Dedupe pass will call /lib/eventDedupe after extraction.",
  });
}
