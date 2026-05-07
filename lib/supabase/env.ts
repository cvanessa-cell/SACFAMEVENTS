/**
 * Reads Supabase-related env. Optional: the app runs on Prisma/SQLite + Airtable without these.
 */
export function getSupabaseUrl(): string | undefined {
  const u = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  return u || undefined;
}

/** Publishable (anon) key for browser and server calls that must respect RLS. */
export function getSupabasePublishableKey(): string | undefined {
  const k =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
  return k || undefined;
}

/** Service role: server-only, bypasses RLS — use sparingly (batch jobs, admin scripts). */
export function getSupabaseServiceRoleKey(): string | undefined {
  return process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
}

export function isSupabaseConfigured(): boolean {
  return Boolean(getSupabaseUrl() && getSupabasePublishableKey());
}
