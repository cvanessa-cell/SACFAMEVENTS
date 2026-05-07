import { NextResponse } from "next/server";

import { checkSupabaseReachability } from "@/lib/supabase/health";

export const dynamic = "force-dynamic";

/**
 * Uptime / integration check: optional Supabase project reachability.
 * Does not expose URLs or keys.
 */
export async function GET() {
  const result = await checkSupabaseReachability();
  if (!result.configured) {
    return NextResponse.json({
      ok: true,
      supabase: "disabled",
      detail: "NEXT_PUBLIC_SUPABASE_URL and publishable key not set",
    });
  }
  if (!result.ok) {
    return NextResponse.json(
      {
        ok: false,
        supabase: "unreachable",
        latencyMs: result.latencyMs,
        httpStatus: result.httpStatus,
        error: result.error,
      },
      { status: 503 },
    );
  }
  return NextResponse.json({
    ok: true,
    supabase: "connected",
    latencyMs: result.latencyMs,
  });
}
