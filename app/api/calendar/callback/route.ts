export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { completeGoogleOAuth, getGoogleEnv } from "@/lib/googleCalendar";

function appBaseUrl(req: Request): string {
  const env = process.env.APP_BASE_URL?.trim();
  if (env) return env.replace(/\/$/, "");
  const url = new URL(req.url);
  return `${url.protocol}//${url.host}`;
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const error = url.searchParams.get("error");
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const base = appBaseUrl(req);

  function redirect(target: string, params: Record<string, string>) {
    const search = new URLSearchParams(params).toString();
    return NextResponse.redirect(`${base}${target}?${search}`, { status: 302 });
  }

  const fallback = "/settings";

  if (error) {
    return redirect(fallback, { google: "error", reason: error });
  }
  if (!code || !state) {
    return redirect(fallback, { google: "error", reason: "missing_params" });
  }
  if (!getGoogleEnv()) {
    return redirect(fallback, { google: "error", reason: "missing_env" });
  }

  try {
    const result = await completeGoogleOAuth({ state, code });
    const target = result.returnPath ?? fallback;
    return redirect(target, {
      google: "connected",
      account: result.email,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "OAuth exchange failed";
    return redirect(fallback, { google: "error", reason: message });
  }
}
