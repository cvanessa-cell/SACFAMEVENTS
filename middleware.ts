import { NextResponse, type NextRequest } from "next/server";

import { checkRateLimit, API_RATE_LIMITS, type RateLimitConfig } from "@/lib/rateLimit";

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

function rateLimitConfigFor(pathname: string): RateLimitConfig {
  if (pathname.startsWith("/api/events/discover"))
    return API_RATE_LIMITS.discover;
  if (pathname.startsWith("/api/cron/")) return API_RATE_LIMITS.cron;
  if (pathname.startsWith("/api/webhooks/")) return API_RATE_LIMITS.webhook;
  if (pathname.startsWith("/api/admin/")) return API_RATE_LIMITS.admin;
  return API_RATE_LIMITS.default;
}

function isAdminAuthEnabled(): boolean {
  return !!process.env.ADMIN_PASSWORD?.trim();
}

function checkBasicAuth(req: NextRequest): boolean {
  const password = process.env.ADMIN_PASSWORD?.trim();
  if (!password) return true;

  const auth = req.headers.get("authorization");
  if (!auth) {
    const cookie = req.cookies.get("admin_auth")?.value;
    return cookie === password;
  }

  if (auth.startsWith("Basic ")) {
    try {
      const decoded = atob(auth.slice(6));
      const [, pass] = decoded.split(":");
      return pass === password;
    } catch {
      return false;
    }
  }
  return false;
}

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // --- Admin route protection ---
  if (
    pathname.startsWith("/admin") &&
    isAdminAuthEnabled() &&
    !checkBasicAuth(req)
  ) {
    return new NextResponse("Authentication required", {
      status: 401,
      headers: {
        "WWW-Authenticate": 'Basic realm="Admin Console"',
      },
    });
  }

  // --- API rate limiting ---
  if (pathname.startsWith("/api/")) {
    const ip = getClientIp(req);
    const config = rateLimitConfigFor(pathname);
    const result = checkRateLimit(`${ip}:${pathname.split("/").slice(0, 4).join("/")}`, config);

    if (!result.allowed) {
      return NextResponse.json(
        { ok: false, message: "Too many requests. Please try again later." },
        {
          status: 429,
          headers: {
            "Retry-After": String(Math.ceil(result.resetMs / 1000)),
            "X-RateLimit-Remaining": "0",
          },
        },
      );
    }

    const response = NextResponse.next();
    response.headers.set(
      "X-RateLimit-Remaining",
      String(result.remaining),
    );
    return response;
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*", "/api/:path*"],
};
