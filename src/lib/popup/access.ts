// ─── Pop Up Zone — rate limiting and request helpers ─────────────────────────

import type { NextRequest } from "next/server";

// Same in-memory approach as the admin login route: resets on restart, which is
// fine for this threat model (slowing down scripted abuse, not hard security —
// the real guarantees, like a ticket being usable once, live in the database).

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { blocked: false, retryAfterSec: 0 };
  }
  if (entry.count >= max) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { blocked: false, retryAfterSec: 0 };
}

export function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
