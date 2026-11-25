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
  // Passport: sign-in attempts per IP (the Bible also locks one email after 5 misses),
  // sign-up and forgot-password like the Reserve page's forms, and ordinary member requests.
  "passport-signin": { max: 20,  windowMs: HOUR },
  "passport-form":   { max: 5,   windowMs: HOUR },
  "passport-member": { max: 300, windowMs: HOUR },
  // File 04: a member changing their own favorites, ratings, notes, lists and recipes (reordering by buttons is one tap each).
  "passport-personal": { max: 600, windowMs: HOUR },
  // File 05: a member asking for bottles and answering prices (the Bible also caps open requests at ten).
  "passport-bottles": { max: 60,  windowMs: HOUR },
  // File 06: the one search bar (answers as the member types, after a short pause; a word is a few requests).
  "passport-search": { max: 600, windowMs: HOUR },
  // File 08: the Inbox. Writing to the bar, requests and event inquiries (the Bible also caps 30 messages a day, five open
  // threads and ten open requests), and reading one open conversation, which asks again every 30 seconds while on screen.
  "passport-inbox":      { max: 80,  windowMs: HOUR },
  "passport-inbox-read": { max: 900, windowMs: HOUR },
  // File 09: friends. Looking someone up (the Bible also caps ten lookups an hour per member), and everything else a
  // member does with friends: messages, shares, plans, answers (the Bible caps 100 messages a day), and reading an open
  // conversation, which asks again every 30 seconds while on screen.
  "passport-friends":      { max: 40,  windowMs: HOUR },
  "passport-social":       { max: 300, windowMs: HOUR },
  "passport-social-read":  { max: 900, windowMs: HOUR },
  // File 10: comments (the Bible also caps 30 a day per member and 500 per item; edits, deletes and reports count here
  // too) and votes (one tap each; a member may change a pick until voting closes).
  "passport-comments":     { max: 120, windowMs: HOUR },
  "passport-votes":        { max: 300, windowMs: HOUR },
  // Invitation codes typed in or opened from a link: few, so a code can't be guessed (the Bible also caps wrong codes overall).
  "passport-code":   { max: 10,  windowMs: HOUR },
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

/**
 * Give back one hit, for an attempt that failed before it did anything (the
 * service behind it never answered). The guest shouldn't lose a try to our outage.
 */
export function refundRateLimit(bucket: BucketName, ip: string): void {
  const entry = buckets.get(bucket)?.get(ip);
  if (entry && entry.count > 0 && Date.now() <= entry.resetAt) entry.count--;
}
