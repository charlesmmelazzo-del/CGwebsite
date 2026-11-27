import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { bad, looksLikeBot, readJson, sameOrigin, silentOk } from "@/lib/passport/route";
import { getIp, isRateLimited } from "@/lib/rateLimit";
import { BAD_PASSCODE, PASSCODE_LIMIT_MESSAGE, cleanPasscode, isJoinSlug } from "@/lib/passport/passcode";
import { checkPasscode } from "@/lib/passport/join";
import { UNAVAILABLE } from "@/lib/passport/bible";

export const dynamic = "force-dynamic";

/** A random id for this browser, only to count passcode tries per device (it says nothing about anyone). */
const DEVICE_COOKIE = "cgp_device";

/**
 * File 18: the passcode typed on the invitation-card sign-up page. 5 tries in 15 minutes per address and per device,
 * then a calm "wait a few minutes". Every bad passcode gets the same answer. Nothing is used up here.
 */
export async function POST(req: NextRequest) {
  if (!sameOrigin(req)) return bad("Not allowed", 403);
  const had = req.cookies.get(DEVICE_COOKIE)?.value || "";
  const device = /^[A-Za-z0-9_-]{22}$/.test(had) ? had : randomBytes(16).toString("base64url");
  const withDevice = (res: NextResponse) => {
    if (device !== had) {
      res.cookies.set(DEVICE_COOKIE, device, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 365 * 24 * 3600 });
    }
    return res;
  };
  // Both limits count every try (one by address, one by device), so clearing cookies doesn't buy more.
  const byIp = isRateLimited("passport-passcode", getIp(req));
  const byDevice = isRateLimited("passport-passcode-device", device);
  if (byIp || byDevice) return withDevice(NextResponse.json({ error: PASSCODE_LIMIT_MESSAGE }, { status: 429 }));
  const body = await readJson(req);
  if (looksLikeBot(body)) return withDevice(silentOk());
  const slug = typeof body.slug === "string" ? body.slug : "";
  const code = cleanPasscode(body.code);
  if (!isJoinSlug(slug)) return withDevice(bad(BAD_PASSCODE));
  const r = await checkPasscode(slug, code);
  if (r === "ok") return withDevice(NextResponse.json({ ok: true, code }));
  if (r === "paused") return withDevice(NextResponse.json({ error: PASSCODE_LIMIT_MESSAGE }, { status: 429 }));
  if (r === "unavailable") return withDevice(NextResponse.json({ error: UNAVAILABLE }, { status: 503 }));
  return withDevice(bad(BAD_PASSCODE));
}
