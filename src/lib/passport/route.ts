import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { getIp, isRateLimited, refundRateLimit, type BucketName } from "@/lib/rateLimit";
import { PassportError, UNAVAILABLE, type MemberAuth, type SignedIn } from "./bible";
import { clearCookie, currentAuth, setCookie } from "./session";
import { readJson as readBody } from "@/lib/reserve/route";

/** Shared plumbing for the /api/passport/* routes (the browser's side; these call the Bible). */

export { readJson, looksLikeBot, silentOk, bad } from "@/lib/reserve/route";

export const RATE_LIMIT_MESSAGE = "Too many tries in a short time. Please wait a little and try again.";

export function limited(req: NextRequest, bucket: BucketName): NextResponse | null {
  if (isRateLimited(bucket, getIp(req))) return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429 });
  return null;
}

/** Turn a failure into a response. A sign-in that is no longer valid clears the cookie. */
export function fromError(e: unknown, limit?: { req: NextRequest; bucket: BucketName }): NextResponse {
  if (e instanceof PassportError) {
    if (e.status === 503 && limit) refundRateLimit(limit.bucket, getIp(limit.req));
    const res = NextResponse.json({ error: e.message, signed_out: e.signedOut || undefined }, { status: e.status });
    if (e.signedOut) clearCookie(res);
    return res;
  }
  console.error("[passport] unexpected", e);
  return NextResponse.json({ error: UNAVAILABLE }, { status: 500 });
}

/** A successful sign-in (password, link or sign-up): set the 90-day cookie. Only the member's own record goes to the browser. */
export function signedInResponse(out: SignedIn, extra: Record<string, unknown> = {}): NextResponse {
  const res = NextResponse.json({ ok: true, first_name: out.member.first_name, ...extra });
  if (!setCookie(res, { token: out.session_token, memberId: out.member.id })) {
    console.error("[passport] SESSION_SECRET is not set; refusing to sign anyone in.");
    return NextResponse.json({ error: UNAVAILABLE }, { status: 503 });
  }
  return res;
}

/** Only accept writes posted by our own pages, not another site. */
export function sameOrigin(req: NextRequest): boolean {
  const origin = req.headers.get("origin");
  // Browsers always send Origin on a cross-site POST; with none, it isn't one.
  if (!origin) return true;
  try {
    const host = (req.headers.get("x-forwarded-host") || req.headers.get("host") || "").split(",")[0].trim();
    return new URL(origin).host === host;
  } catch {
    return false;
  }
}

/**
 * File 04: one of the signed-in member's own requests (favorites, ratings, notes, lists, recipes).
 * Same-site only, rate limited per IP, and only ever for the member in the signed cookie: the Bible
 * checks that session and scopes everything to that member. `run` returns the JSON to send, or a response.
 */
export async function memberRequest(
  req: NextRequest,
  bucket: BucketName,
  run: (auth: MemberAuth, body: Record<string, unknown>) => Promise<unknown>,
): Promise<NextResponse> {
  if (!sameOrigin(req)) return NextResponse.json({ error: "Not allowed" }, { status: 403 });
  const stop = limited(req, bucket);
  if (stop) return stop;
  const auth = currentAuth();
  if (!auth) return NextResponse.json({ error: "Please sign in again.", signed_out: true }, { status: 401 });
  const body = req.method === "GET" ? {} : await readBody(req);
  try {
    const out = await run(auth, body);
    return out instanceof NextResponse ? out : NextResponse.json(out ?? { ok: true });
  } catch (e) {
    return fromError(e, { req, bucket });
  }
}

/** Input checks before anything reaches the Bible (which checks again). */
export const KINDS = ["cocktail", "bottle"] as const;
export const isKind = (v: unknown): v is (typeof KINDS)[number] => v === "cocktail" || v === "bottle";
export const posInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
};
export const text = (v: unknown, max: number) => (typeof v === "string" ? v.slice(0, max) : "");
