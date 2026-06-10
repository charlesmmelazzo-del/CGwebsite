// Signed admin session tokens.
//
// The session cookie used to be the static string "authenticated", which meant
// anyone could forge it (the value is not a secret). These helpers replace that
// with an HMAC-signed token: `<expiryMs>.<base64url(signature)>`. The signature
// is keyed on a server-only secret, so the cookie can no longer be guessed or
// copied from the public source.
//
// Implemented with Web Crypto (crypto.subtle) so the same code runs in both the
// Edge middleware and the Node API route.

export const SESSION_COOKIE = "cg-admin-session";

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

/**
 * Mint a signed session token valid for `maxAgeSec` seconds.
 * Returns "" if no secret is configured (caller should refuse to set a cookie).
 */
export async function createSessionToken(maxAgeSec: number): Promise<string> {
  const secret = getSecret();
  if (!secret) return "";
  const exp = Date.now() + maxAgeSec * 1000;
  const payload = String(exp);
  const key = await importKey(secret);
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(payload));
  return `${payload}.${toB64url(sig)}`;
}

/**
 * Verify a session token's signature and expiry. Returns true only for a token
 * minted by createSessionToken with the current secret that has not expired.
 */
export async function verifySessionToken(token: string | undefined): Promise<boolean> {
  const secret = getSecret();
  if (!secret || !token) return false;

  const dot = token.indexOf(".");
  if (dot <= 0) return false;
  const payload = token.slice(0, dot);
  const sigPart = token.slice(dot + 1);

  const exp = Number(payload);
  if (!Number.isFinite(exp) || exp < Date.now()) return false;

  let sigBytes: Uint8Array;
  try {
    sigBytes = fromB64url(sigPart);
  } catch {
    return false;
  }

  const key = await importKey(secret);
  // crypto.subtle.verify performs a constant-time comparison.
  return crypto.subtle.verify(
    "HMAC",
    key,
    sigBytes as BufferSource,
    new TextEncoder().encode(payload) as BufferSource
  );
}
