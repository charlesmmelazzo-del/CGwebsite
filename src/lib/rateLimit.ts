import type { NextRequest } from "next/server";

/**
 * Simple in-memory, per-IP rate limiter with named buckets.
 * Process-local (resets on deploy), which is enough to blunt casual abuse;
 * the services behind these routes keep their own limits as a second line.
 */
type Entry = { count: number; resetAt: number };
const buckets = new Map<string, Map<string, Entry>>();

export const HOUR = 60 * 60 * 1000;

/** Named limits used across the site. */
export const LIMITS = {
  forms:          { max: 5,   windowMs: HOUR },
  request:        { max: 5,   windowMs: HOUR },
  lookup:         { max: 10,  windowMs: HOUR },
  "guest-action": { max: 30,  windowMs: HOUR },
  read:           { max: 120, windowMs: HOUR },
} as const;

export type BucketName = keyof typeof LIMITS;

export function getIp(req: NextRequest | Request): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ||
    req.headers.get("x-real-ip") ||
    "unknown"
  );
}

/** Count one hit for this IP in the bucket. Returns true when the IP is over the limit. */
export function isRateLimited(bucket: BucketName, ip: string): boolean {
  const { max, windowMs } = LIMITS[bucket];
  let map = buckets.get(bucket);
  if (!map) { map = new Map(); buckets.set(bucket, map); }
  const now = Date.now();

  // Keep the map from growing without bound on a long-lived process.
  if (map.size > 5000) {
    map.forEach((v, k) => { if (now > v.resetAt) map!.delete(k); });
  }

  const entry = map.get(ip);
  if (!entry || now > entry.resetAt) {
    map.set(ip, { count: 1, resetAt: now + windowMs });
    return false;
  }
  if (entry.count >= max) return true;
  entry.count++;
  return false;
}
