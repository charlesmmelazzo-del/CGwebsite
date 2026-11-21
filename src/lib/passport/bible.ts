import "server-only";
import { setDefaultResultOrder } from "node:dns";

/**
 * The website's side of the Passport entrance in the Bible
 * (/api/passport-public). Server to server only: the guest's browser never
 * talks to the Bible. Authenticated with PASSPORT_SYNC_KEY, its own key,
 * separate from the reservations key. The website stores no member data; every
 * screen asks the Bible.
 */

try { setDefaultResultOrder("ipv4first"); } catch { /* older runtimes */ }

const TIMEOUT_MS = 8_000;

export const UNAVAILABLE = "Passport is temporarily unavailable. Please try again in a few minutes.";

export class PassportError extends Error {
  status: number;
  /** True when the Bible says this sign-in is no longer valid (signed out, deactivated, reset). */
  signedOut: boolean;
  constructor(status: number, message: string, signedOut = false) {
    super(message);
    this.name = "PassportError";
    this.status = status;
    this.signedOut = signedOut;
  }
}

/** Who is asking: the Bible checks the session token and that it belongs to this member. */
export type MemberAuth = { token: string; memberId: number };

function baseUrl(): string {
  return (process.env.BIBLE_API_URL || "https://cgbible.com").replace(/\/+$/, "");
}

export async function passport<T>(
  method: "GET" | "POST" | "PUT",
  path: string,
  opts: { body?: Record<string, unknown>; auth?: MemberAuth } = {},
): Promise<T> {
  const key = process.env.PASSPORT_SYNC_KEY;
  if (!key) throw new PassportError(503, UNAVAILABLE);
  let res: Response;
  try {
    res = await fetch(`${baseUrl()}/api/passport-public${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(opts.body ? { "Content-Type": "application/json" } : {}),
        ...(opts.auth ? { "X-Passport-Session": opts.auth.token, "X-Passport-Member": String(opts.auth.memberId) } : {}),
      },
      body: opts.body ? JSON.stringify(opts.body) : undefined,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch (e) {
    console.error(`[passport] Bible ${method} ${path} failed: ${(e as Error).name}`);
    throw new PassportError(503, UNAVAILABLE);
  }
  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty */ }
  if (!res.ok) {
    const error = data && typeof data === "object" && typeof (data as { error?: unknown }).error === "string" ? (data as { error: string }).error : "";
    if (res.status === 401 && error === "signed_out") throw new PassportError(401, "Please sign in again.", true);
    if (res.status === 401 || res.status >= 500) {
      // A wrong or missing key on one side is ours to fix, not the guest's.
      console.error(`[passport] Bible ${method} ${path} → ${res.status}`);
      throw new PassportError(503, UNAVAILABLE);
    }
    throw new PassportError(res.status, error || "Something went wrong. Please try again.");
  }
  return data as T;
}

// ── What the Bible sends (its approved list, server/passport/guestSafe.js) ────

export interface Member {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  phone: string;
  member_since: string | null;
  marketing_consent: boolean;
  can_invite_household: boolean;
}
export interface HouseholdMember { first_name: string; last_name: string; status: "invited" | "active" }
export interface Me { member: Member; household: HouseholdMember[] }
export interface Config { signup_enabled: boolean; terms_version: number; terms_text: string }
export interface LinkInfo { kind: "set_password" | "reset"; first_name: string; needs_details: boolean; phone: string }
export interface SignedIn { member: Member; session_token: string; expires_at: string; household_invited?: number }

export const getConfig = () => passport<{ config: Config }>("GET", "/config").then((r) => r.config);
export const getMe = (auth: MemberAuth) => passport<Me>("GET", "/me", { auth });
