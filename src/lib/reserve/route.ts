import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { reserveEnabled } from "./enabled";
import { BibleError, UNAVAILABLE_MESSAGE } from "./bible";
import { getIp, isRateLimited, type BucketName } from "@/lib/rateLimit";
import { isToken } from "./format";

/** Shared plumbing for the /api/reserve/* proxy routes. */

export const RATE_LIMIT_MESSAGE = "You've tried that a lot in a short time. Please wait a bit, or call us.";

export function notFound() {
  return NextResponse.json({ error: "Not found" }, { status: 404 });
}

/**
 * Feature switch + rate limit. Returns a response to send instead, or null to carry on.
 */
export function guard(req: NextRequest, bucket: BucketName): NextResponse | null {
  if (!reserveEnabled()) return notFound();
  if (isRateLimited(bucket, getIp(req))) {
    return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  }
  return null;
}

/** Validate a reservation token before it ever reaches the Bible. */
export function badToken(token: string): NextResponse | null {
  if (!isToken(token)) {
    return NextResponse.json(
      { error: "We couldn't find that reservation. Check the link in your email, or call us." },
      { status: 404 },
    );
  }
  return null;
}

/** Pass the Bible's friendly message (and only that, plus party options) back to the browser. */
export function fromError(e: unknown): NextResponse {
  if (e instanceof BibleError) {
    const body: Record<string, unknown> = { error: e.message };
    if (Array.isArray(e.extra.options)) body.options = e.extra.options;
    return NextResponse.json(body, { status: e.status });
  }
  console.error("[reserve]", e instanceof Error ? e.message : e);
  return NextResponse.json({ error: UNAVAILABLE_MESSAGE }, { status: 503 });
}

export async function readJson(req: NextRequest): Promise<Record<string, unknown>> {
  try {
    const raw = await req.text();
    if (raw.length > 20_000) return {};
    const v = JSON.parse(raw || "{}");
    return v && typeof v === "object" && !Array.isArray(v) ? v : {};
  } catch {
    return {};
  }
}

export function bad(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

/** Silent drop for bots: looks like success, does nothing. */
export function silentOk() {
  return NextResponse.json({ ok: true });
}

/** Honeypot filled in, or the form submitted faster than a person could. */
export function looksLikeBot(body: Record<string, unknown>): boolean {
  if (typeof body.company === "string" && body.company.trim() !== "") return true;
  const rendered = Number(body.rendered_at);
  if (!Number.isFinite(rendered) || rendered <= 0) return true;
  return Date.now() - rendered < 3000;
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^\d{2}:\d{2}$/;

export function intParam(v: unknown, min: number, max: number): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN;
  if (!Number.isInteger(n) || n < min || n > max) return null;
  return n;
}
