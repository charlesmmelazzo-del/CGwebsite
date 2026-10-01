// ─── Cocktail Competitions — who is this request? (server only) ──────────────
//
// Guests sign in with the code printed on their ticket. The first device to
// use a code claims it: we store a random secret on the code row and the same
// secret in an httpOnly cookie on that phone. Any other device presenting the
// code is turned away until the admin resets it.
//
// The host is whoever holds the event's host link (its token), or a signed-in
// admin.

import { randomBytes, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextRequest } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/session";
import type { CompEvent, Viewer } from "./types";

export const guestCookieName = (eventId: string) => `cg-comp-${eventId.slice(0, 8)}`;

/** Read the signed-in guest for an event, or null. */
export async function getViewer(ev: CompEvent): Promise<Viewer | null> {
  const raw = cookies().get(guestCookieName(ev.id))?.value;
  if (!raw) return null;
  const [codeId, secret] = raw.split(".");
  if (!codeId || !secret) return null;
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("comp_codes")
    .select("id, code, tier_id, name, device_secret, event_id")
    .eq("id", codeId)
    .maybeSingle();
  if (!data || data.event_id !== ev.id || !data.device_secret) return null;
  if (!safeEqual(String(data.device_secret), secret)) return null;
  const tier = ev.tiers.find((t) => t.id === data.tier_id);
  return {
    codeId: data.id,
    code: data.code,
    tierId: data.tier_id,
    tierLabel: tier?.label ?? "Guest",
    isJudge: Boolean(tier?.isJudge),
    name: data.name ?? "",
  };
}

export function newDeviceSecret(): string {
  return randomBytes(24).toString("base64url");
}

function safeEqual(a: string, b: string): boolean {
  const x = Buffer.from(a);
  const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
}

/** Host link token or an admin session. */
export async function isHost(ev: CompEvent, key: string | null | undefined): Promise<boolean> {
  if (key && ev.hostToken && safeEqual(key, ev.hostToken)) return true;
  return verifySessionToken(cookies().get(SESSION_COOKIE)?.value);
}

export async function isAdminRequest(req?: NextRequest): Promise<boolean> {
  const value = req ? req.cookies.get(SESSION_COOKIE)?.value : cookies().get(SESSION_COOKIE)?.value;
  return verifySessionToken(value);
}

// ─── Wrong-code throttle ─────────────────────────────────────────────────────
// Codes are 6 characters from a 31-letter alphabet (~887 million), so guessing
// is already hopeless; this just stops anyone from trying at speed.

const misses = new Map<string, { n: number; first: number }>();
const WINDOW_MS = 10 * 60 * 1000;
const MAX_MISSES = 10;

export function tooManyMisses(ip: string): boolean {
  const m = misses.get(ip);
  if (!m) return false;
  if (Date.now() - m.first > WINDOW_MS) {
    misses.delete(ip);
    return false;
  }
  return m.n >= MAX_MISSES;
}

export function recordMiss(ip: string) {
  const m = misses.get(ip);
  if (!m || Date.now() - m.first > WINDOW_MS) misses.set(ip, { n: 1, first: Date.now() });
  else m.n++;
}
