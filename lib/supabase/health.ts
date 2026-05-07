import { getSupabasePublishableKey, getSupabaseUrl } from "./env";

export type SupabaseReachabilityResult =
  | { configured: false }
  | {
      configured: true;
      ok: boolean;
      latencyMs: number;
      httpStatus?: number;
      error?: string;
    };

/**
 * Lightweight connectivity check (Auth service). Does not require any tables to exist.
 */
export async function checkSupabaseReachability(): Promise<SupabaseReachabilityResult> {
  const url = getSupabaseUrl();
  const key = getSupabasePublishableKey();
  if (!url || !key) {
    return { configured: false };
  }
  const base = url.replace(/\/$/, "");
  const start = Date.now();
  try {
    const res = await fetch(`${base}/auth/v1/health`, {
      method: "GET",
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
      },
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });
    const latencyMs = Date.now() - start;
    return {
      configured: true,
      ok: res.ok,
      latencyMs,
      httpStatus: res.status,
      error: res.ok ? undefined : `HTTP ${res.status}`,
    };
  } catch (e) {
    return {
      configured: true,
      ok: false,
      latencyMs: Date.now() - start,
      error: e instanceof Error ? e.message : "unknown_error",
    };
  }
}
