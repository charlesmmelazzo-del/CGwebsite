import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME  = "cg-admin-session";
const COOKIE_VALUE = "authenticated";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Always allow the login page and the login API endpoint through
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/api/admin/login")) return NextResponse.next();

  const session = req.cookies.get(COOKIE_NAME)?.value;
  const authenticated = session === COOKIE_VALUE;

  // ── API routes (/api/admin/*) ──────────────────────────────────────────────
  // Return 401 JSON (not a redirect) so fetch() callers get a clean error
  if (pathname.startsWith("/api/admin")) {
    if (!authenticated) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  // ── Admin UI routes (/admin/*) ─────────────────────────────────────────────
  if (pathname.startsWith("/admin")) {
    if (!authenticated) {
      const loginUrl = new URL("/admin/login", req.url);
      loginUrl.searchParams.set("from", pathname);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  // Protect both the admin UI and all admin API routes
  matcher: ["/admin/:path*", "/api/admin/:path*"],
};
