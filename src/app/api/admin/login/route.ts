import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, OWNER_USERNAME, createSessionToken } from "@/lib/session";
import { authenticateAdminUser, normalizeUsername, safeEqual } from "@/lib/adminUsers";

// Two ways in:
//   * the MAIN ADMIN — username "admin" (or left blank) + ADMIN_PASSWORD
//   * a USER the main admin created at /admin/users — their own username and
//     password, checked against the admin_users table

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

  const body = await req.json().catch(() => ({}));
  const password = typeof body.password === "string" ? body.password : "";
  const username = normalizeUsername(body.username);
  const wrong = () => NextResponse.json({ error: "Incorrect username or password" }, { status: 401 });

  let user: { id: string; sessionVersion: number } | undefined;
  if (username === "" || username === OWNER_USERNAME) {
    const adminPw = getAdminPassword();
    if (!adminPw || !safeEqual(password, adminPw)) return wrong();
  } else {
    const found = password ? await authenticateAdminUser(username, password) : null;
    if (!found) return wrong();
    user = found;
  }

  // Successful login — clear rate limit counter and set a signed session cookie.
  // The cookie value is an HMAC token (not a guessable constant), so it can't be
  // forged by anyone reading the public source.
  clearRateLimit(ip);

  const token = await createSessionToken(COOKIE_MAX_AGE, user);
  if (!token) {
    // No signing secret configured (ADMIN_PASSWORD/SESSION_SECRET missing).
    return NextResponse.json({ error: "Server not configured for login" }, { status: 500 });
  }

  const res = NextResponse.json({ success: true });
  res.cookies.set(SESSION_COOKIE, token, {
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
  res.cookies.set(SESSION_COOKIE, "", { maxAge: 0, path: "/" });
  return res;
}
