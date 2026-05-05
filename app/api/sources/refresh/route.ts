import { NextResponse } from "next/server";

export async function POST() {
  return NextResponse.json({
    ok: false,
    message: "Source refresh pipelines will hydrate Airtable from discovery jobs.",
  });
}
