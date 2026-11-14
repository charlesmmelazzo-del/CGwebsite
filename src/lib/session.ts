// Signed admin session tokens.
//
// The cookie is an HMAC-signed token, keyed on a server-only secret, so it
// can't be guessed or forged:
//
//   v2.<expiryMs>.<role>.<userId>.<sessionVersion>.<base64url(signature)>
//
// Two kinds of people sign in to the admin:
//
//   * the MAIN ADMIN ("owner") — the ADMIN_PASSWORD environment variable.
//     Not stored in the database; the only one who can manage users.
//   * USERS — rows in the admin_users table, created by the main admin at
//     /admin/users. They can edit everything except the user list.
//
// A user's token is checked against the database on every request: the row
// must still exist and its session_version must match the token. So deleting
// a user, or resetting their password, cuts off access at once — not when the
// cookie eventually expires.
//
// Implemented with Web Crypto and fetch so the same code runs in both the Edge
// middleware and the Node API routes.

export const SESSION_COOKIE = "cg-admin-session";

/** The main admin's sign-in name. Reserved — no user can take it. */
export const OWNER_USERNAME = "admin";

export type AdminSession = {
  role: "owner" | "user";
  /** admin_users.id, or null for the main admin. */
  userId: string | null;
  username: string;
  name: string;
};

/**
 * Secret used to sign sessions. Prefer an explicit SESSION_SECRET; otherwise
 * fall back to ADMIN_PASSWORD (already required, already server-only) so the
 * owner doesn't have to configure a second env var. Empty when neither is set —
 * in which case login already fails, so no valid token can be minted anyway.
 */
function getSecret(): string {
  return process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "";
}

function toB64url(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromB64url(s: string): Uint8Array {
  const b64 = s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4);
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"]
  );
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Mint a signed session token valid for `maxAgeSec` seconds — for the main
 * admin when `user` is omitted, otherwise for that admin_users row.
 * Returns "" if no secret is configured (caller should refuse to set a cookie).
 */
export async function createSessionToken(
  maxAgeSec: number,
  user?: { id: string; sessionVersion: number }
): Promise<string> {
  const secret = getSecret();
  if (!secret) return "";
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = user
    ? `v2.${exp}.u.${user.id}.${user.sessionVersion}`
    : `v2.${exp}.o.-.0`;
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toB64url(sig)}`;
}

/**
 * The live admin_users row behind a user token, or null when it's gone.
 * Plain fetch against Supabase's REST API (no client library) so this runs in
 * the Edge middleware. Any failure returns null — a user we can't confirm is
 * not let in.
 */
async function fetchUser(
  id: string
): Promise<{ username: string; name: string; session_version: number } | null> {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  try {
    const res = await fetch(
      `${url}/rest/v1/admin_users?id=eq.${id}&select=username,name,session_version`,
      { headers: { apikey: key, Authorization: `Bearer ${key}` }, cache: "no-store" }
    );
    if (!res.ok) return null;
    const rows = (await res.json()) as { username: string; name: string; session_version: number }[];
    return rows[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * Who a session token belongs to, or null when it isn't valid: bad signature,
 * expired, or a user who has since been removed or had their password reset.
 */
export async function getSession(token: string | undefined): Promise<AdminSession | null> {
  const secret = getSecret();
  if (!secret || !token) return null;

  const parts = token.split(".");
  if (parts.length !== 6 || parts[0] !== "v2") return null;
  const [, expPart, role, uid, verPart, sigPart] = parts;
  const payload = parts.slice(0, 5).join(".");

  const exp = Number(expPart);
  if (!Number.isFinite(exp) || exp < Date.now()) return null;

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromB64url(sigPart);
  } catch {
    return null;
  }

  const key = await importKey(secret);
  // crypto.subtle.verify performs a constant-time comparison.
  const ok = await crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(payload) as BufferSource
  );
  if (!ok) return null;

  if (role === "o") {
    return { role: "owner", userId: null, username: OWNER_USERNAME, name: "Main admin" };
  }
  if (role !== "u" || !UUID.test(uid)) return null;

  const row = await fetchUser(uid);
  if (!row || String(row.session_version) !== verPart) return null;
  return { role: "user", userId: uid, username: row.username, name: row.name || row.username };
}

/** True for any valid admin session — the main admin or a current user. */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  return (await getSession(token)) !== null;
}
