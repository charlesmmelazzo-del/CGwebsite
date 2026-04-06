import { NextRequest, NextResponse } from "next/server";

const COOKIE_NAME  = "cg-admin-session";
const COOKIE_VALUE = "authenticated";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Only guard /admin routes — let the login page and API through
  if (!pathname.startsWith("/admin")) return NextResponse.next();
  if (pathname === "/admin/login") return NextResponse.next();
  if (pathname.startsWith("/api/admin/login")) return NextResponse.next();

  const session = req.cookies.get(COOKIE_NAME)?.value;

  if (session !== COOKIE_VALUE) {
    const loginUrl = new URL("/admin/login", req.url);
    loginUrl.searchParams.set("from", pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/admin/:path*"],
};
