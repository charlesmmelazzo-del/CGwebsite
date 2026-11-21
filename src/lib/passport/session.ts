import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import type { NextResponse } from "next/server";
import type { MemberAuth } from "./bible";

/**
 * The Passport sign-in cookie: the member number and the Bible's session token,
 * signed so it can't be altered. httpOnly (page scripts can't read it), secure,
 * 90 days. The Bible still checks the token on every request, so deactivating a
 * member or resetting their password signs them out at once.
 *
 * Signed with a key derived from SESSION_SECRET (never the admin password).
 * With no SESSION_SECRET, Passport sign-in is refused rather than weakened.
 */

export const PASSPORT_COOKIE = "cg-passport";
export const MAX_AGE_SEC = 90 * 24 * 60 * 60;

function key(): Buffer | null {
  const secret = process.env.SESSION_SECRET;
  if (!secret) return null;
  // A separate key for Passport, so a Passport cookie can never stand in for an admin one.
  return createHmac("sha256", secret).update("cg-passport-cookie-v1").digest();
}

const sign = (k: Buffer, payload: string) => createHmac("sha256", k).update(payload).digest("base64url");

export function canSignIn(): boolean {
  return key() !== null;
}

export function encode(auth: MemberAuth, expiresMs: number): string | null {
  const k = key();
  if (!k) return null;
  const payload = `p1.${auth.memberId}.${expiresMs}.${auth.token}`;
  return `${payload}.${sign(k, payload)}`;
}

export function decode(value: string | undefined): MemberAuth | null {
  const k = key();
  if (!k || !value) return null;
  const parts = value.split(".");
  if (parts.length !== 5 || parts[0] !== "p1") return null;
  const payload = parts.slice(0, 4).join(".");
  const want = Buffer.from(sign(k, payload));
  const got = Buffer.from(parts[4]);
  if (want.length !== got.length || !timingSafeEqual(want, got)) return null;
  const memberId = Number(parts[1]);
  const exp = Number(parts[2]);
  if (!Number.isInteger(memberId) || memberId <= 0 || !Number.isFinite(exp) || exp < Date.now()) return null;
  if (!/^[A-Za-z0-9_-]{20,200}$/.test(parts[3])) return null;
  return { memberId, token: parts[3] };
}

/** The signed-in member's auth from the request cookies (server components and routes). */
export function currentAuth(): MemberAuth | null {
  return decode(cookies().get(PASSPORT_COOKIE)?.value);
}

export function setCookie(res: NextResponse, auth: MemberAuth): boolean {
  const expires = Date.now() + MAX_AGE_SEC * 1000;
  const value = encode(auth, expires);
  if (!value) return false;
  res.cookies.set(PASSPORT_COOKIE, value, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE_SEC,
  });
  return true;
}

export function clearCookie(res: NextResponse) {
  res.cookies.set(PASSPORT_COOKIE, "", { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax", path: "/", maxAge: 0 });
}
