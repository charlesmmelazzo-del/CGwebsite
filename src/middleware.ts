import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { createPopupMiddlewareClient } from "@/lib/popup/auth";

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page and the login API endpoint through
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/api/admin/login")) return NextResponse.next();

  // ── API routes (/api/admin/*) ──────────────────────────────────────────────
  // Return 401 JSON (not a redirect) so fetch() callers get a clean error
  if (pathname.startsWith("/api/admin")) {
    if (!(await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // ── Admin UI routes (/admin/*) ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!(await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // ── Pop Up Zone (/popup/*, /api/popup/*) ───────────────────────────────────
  // NOT an auth gate — individual pages and API routes decide what requires a
  // signed-in guest. This branch does two things:
  //
  //   1. Refreshes an expiring Supabase guest session and writes the rotated
  //      cookies onto the response. Server Components can't set cookies, so
  //      without this a long-lived session would eventually go stale.
  //   2. Tags the request with its path so the root layout can suppress the
  //      main site header and footer — the zone renders in its own shell.
  if (pathname.startsWith("/popup") || pathname.startsWith("/api/popup")) {
    const requestHeaders = new Headers(req.headers);
    requestHeaders.set("x-pathname", pathname);

    const res = NextResponse.next({ request: { headers: requestHeaders } });

    const sb = createPopupMiddlewareClient(req, res);
    // getUser() revalidates the token and triggers a refresh when it's near
    // expiry; the rotated cookies land on `res` via the setAll handler.
    if (sb) await sb.auth.getUser();

    return res;
  }

  return NextResponse.next();
}

export const config = {
  // Admin UI + admin API (auth gate), and the Pop Up Zone (session refresh)
  matcher: ["/admin/:path*", "/api/admin/:path*", "/popup/:path*", "/api/popup/:path*"],
};
