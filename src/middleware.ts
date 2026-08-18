import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import { createPopupMiddlewareClient } from "@/lib/popup/auth";
import { isPreviewDeployment, previewGate } from "@/lib/previewGate";

/**
 * Stamp responses on a preview deployment so a staging copy of the site can
 * never be indexed as a duplicate of the real one. No-op in production.
 */
function pass(res: NextResponse): NextResponse {
  if (isPreviewDeployment()) res.headers.set("X-Robots-Tag", "noindex, nofollow");
  return res;
}

export async function middleware(req: NextRequest) {
  // ── Preview password ───────────────────────────────────────────────────────
  // First, before anything else: on a staging deployment nothing is served —
  // not even the admin login page — until the site password is supplied.
  // Production doesn't set PREVIEW_PASSWORD, so this returns immediately.
  const gated = previewGate(req);
  if (gated) return gated;

  const { pathname } = req.nextUrl;

  // Always allow the login page and the login API endpoint through
  if (pathname === "/admin/login") return pass(NextResponse.next());
  if (pathname.startsWith("/api/admin/login")) return pass(NextResponse.next());

  // ── API routes (/api/admin/*) ──────────────────────────────────────────────
  // Return 401 JSON (not a redirect) so fetch() callers get a clean error
  if (pathname.startsWith("/api/admin")) {
    if (!(await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    return pass(NextResponse.next());
  }

  // ── Admin UI routes (/admin/*) ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!(await verifySessionToken(req.cookies.get(SESSION_COOKIE)?.value))) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return pass(NextResponse.next());
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

    return pass(res);
  }

  return pass(NextResponse.next());
}

export const config = {
  /**
   * Everything except Next's own static output.
   *
   * Broader than it needs to be for the admin and Pop Up Zone logic above,
   * because the preview password has to cover the WHOLE site — a staging
   * deployment that left the marketing pages open wouldn't really be private.
   * On production the first thing middleware does is read one missing env var
   * and fall straight through.
   */
  matcher: ["/((?!_next/static|_next/image).*)"],
};
