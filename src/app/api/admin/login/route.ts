import { NextRequest, NextResponse } from "next/server";

// ─── Admin password ────────────────────────────────────────────────────────────
// Set ADMIN_PASSWORD environment variable on Railway.
// No hardcoded default — if the env var is missing the server will refuse logins.
function getAdminPassword(): string {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) {
    // Log loudly in server output so the operator notices immediately
    console.error("[AUTH] ADMIN_PASSWORD environment variable is not set. All login attempts will be rejected.");
    return "";
  }
  return pw;
}

// ─── In-memory rate limiter (resets on server restart) ────────────────────────
// 10 failed attempts per IP per 15-minute window → locked out
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS  = 10;
const WINDOW_MS     = 15 * 60 * 1000; // 15 minutes

function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}

function checkRateLimit(ip: string): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = attempts.get(ip);

  if (!entry || now > entry.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + WINDOW_MS });
    return { blocked: false, retryAfterSec: 0 };
  }
  if (entry.count >= MAX_ATTEMPTS) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { blocked: false, retryAfterSec: 0 };
}

function clearRateLimit(ip: string) {
  attempts.delete(ip);
}

// ─── Cookie settings ───────────────────────────────────────────────────────────
const COOKIE_NAME    = "cg-admin-session";
const COOKIE_VALUE   = "authenticated";
const COOKIE_MAX_AGE = 60 * 60 * 24 * 7; // 7 days

export async function POST(req: NextRequest) {
  const ip = getIp(req);
  const rl = checkRateLimit(ip);

  if (rl.blocked) {
    return NextResponse.json(
      { error: `Too many failed attempts. Try again in ${Math.ceil(rl.retryAfterSec / 60)} minutes.` },
      {
        status: 429,
        headers: { "Retry-After": String(rl.retryAfterSec) },
      }
    );
  }

  const { password } = await req.json();
  const adminPw = getAdminPassword();

  if (!adminPw || password !== adminPw) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  // Successful login — clear rate limit counter and set session cookie
  clearRateLimit(ip);

  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, COOKIE_VALUE, {
    httpOnly:  true,
    secure:    true,           // always require HTTPS (Next.js allows localhost exemption)
    sameSite:  "strict",       // blocks cross-site request forgery
    maxAge:    COOKIE_MAX_AGE,
    path:      "/",
  });
  return res;
}

export async function DELETE() {
  const res = NextResponse.json({ success: true });
  res.cookies.set(COOKIE_NAME, "", { maxAge: 0, path: "/" });
  return res;
}
