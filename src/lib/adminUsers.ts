// Admin panel users — the extra sign-ins the main admin creates at /admin/users.
// Server only: this is where passwords are hashed and checked.
//
// See db/admin-users.sql for the table and src/lib/session.ts for how a
// signed-in user's cookie is checked on each request.

import "server-only";
import { randomBytes, scrypt, timingSafeEqual, createHash } from "crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { OWNER_USERNAME } from "@/lib/session";

export type AdminUser = {
  id: string;
  username: string;
  name: string;
  createdAt: string;
  lastLoginAt: string | null;
};

type Row = {
  id: string;
  username: string;
  name: string;
  password_hash: string;
  session_version: number;
  created_at: string;
  last_login_at: string | null;
};

const PUBLIC_COLS = "id, username, name, created_at, last_login_at";

export const MIN_PASSWORD_LENGTH = 8;

/** A problem the main admin can fix by changing what they typed. */
export class UserInputError extends Error {}

/** True when the failure is "the admin_users table hasn't been created yet". */
export function isMissingTable(e: unknown): boolean {
  const msg = e instanceof Error ? e.message : String((e as { message?: string })?.message ?? e);
  return /admin_users/.test(msg) && /(does not exist|schema cache)/i.test(msg);
}

// ── Passwords ────────────────────────────────────────────────────────────────
// scrypt with a per-user random salt. Stored as  scrypt$<N>$<salt>$<hash>.

const N = 16384;
const KEYLEN = 64;

function derive(password: string, salt: Buffer, n: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, KEYLEN, { N: n, r: 8, p: 1 }, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await derive(password, salt, N);
  return `scrypt$${N}$${salt.toString("base64")}$${key.toString("base64")}`;
}

export async function checkPassword(password: string, stored: string): Promise<boolean> {
  const [scheme, n, salt, hash] = stored.split("$");
  if (scheme !== "scrypt" || !n || !salt || !hash) return false;
  const want = Buffer.from(hash, "base64");
  const got = await derive(password, Buffer.from(salt, "base64"), Number(n));
  return want.length === got.length && timingSafeEqual(want, got);
}

/** Compare two strings without leaking where they differ through timing. */
export function safeEqual(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

// ── Validation ───────────────────────────────────────────────────────────────

export function normalizeUsername(raw: unknown): string {
  return String(raw ?? "").trim().toLowerCase();
}

function validateUsername(username: string) {
  if (!/^[a-z0-9][a-z0-9._-]{2,29}$/.test(username)) {
    throw new UserInputError(
      "Usernames are 3–30 characters: letters, numbers, dots, dashes or underscores, starting with a letter or number."
    );
  }
  if (username === OWNER_USERNAME) {
    throw new UserInputError(`"${OWNER_USERNAME}" is the main admin's sign-in name. Pick a different username.`);
  }
}

function validatePassword(password: unknown): asserts password is string {
  if (typeof password !== "string" || password.length < MIN_PASSWORD_LENGTH) {
    throw new UserInputError(`Passwords need at least ${MIN_PASSWORD_LENGTH} characters.`);
  }
  if (password.length > 200) throw new UserInputError("That password is too long.");
}

function toUser(r: Omit<Row, "password_hash" | "session_version">): AdminUser {
  return { id: r.id, username: r.username, name: r.name, createdAt: r.created_at, lastLoginAt: r.last_login_at };
}

function rethrow(error: { message: string; code?: string }): never {
  // 23505 = unique violation — the username index.
  if (error.code === "23505") throw new UserInputError("That username is already taken.");
  throw new Error(error.message);
}

// ── Reads and writes ─────────────────────────────────────────────────────────

export async function listAdminUsers(): Promise<AdminUser[]> {
  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .select(PUBLIC_COLS)
    .order("created_at", { ascending: true });
  if (error) rethrow(error);
  return (data ?? []).map(toUser);
}

export async function createAdminUser(input: { username: unknown; name: unknown; password: unknown }): Promise<AdminUser> {
  const username = normalizeUsername(input.username);
  validateUsername(username);
  validatePassword(input.password);
  const name = String(input.name ?? "").trim().slice(0, 80);

  const { data, error } = await getSupabaseAdmin()
    .from("admin_users")
    .insert({ username, name, password_hash: await hashPassword(input.password) })
    .select(PUBLIC_COLS)
    .single();
  if (error) rethrow(error);
  return toUser(data!);
}

/**
 * Change a user's name, username and/or password. A new password also bumps
 * session_version, which signs them out everywhere they were signed in.
 */
export async function updateAdminUser(
  id: string,
  patch: { username?: unknown; name?: unknown; password?: unknown }
): Promise<AdminUser> {
  const sb = getSupabaseAdmin();
  const update: Record<string, unknown> = {};

  if (patch.username !== undefined) {
    const username = normalizeUsername(patch.username);
    validateUsername(username);
    update.username = username;
  }
  if (patch.name !== undefined) update.name = String(patch.name ?? "").trim().slice(0, 80);
  if (patch.password !== undefined) {
    validatePassword(patch.password);
    const { data: cur, error: curErr } = await sb
      .from("admin_users").select("session_version").eq("id", id).maybeSingle();
    if (curErr) rethrow(curErr);
    if (!cur) throw new UserInputError("That user no longer exists.");
    update.password_hash = await hashPassword(patch.password);
    update.session_version = (cur.session_version ?? 1) + 1;
  }
  if (Object.keys(update).length === 0) throw new UserInputError("Nothing to change.");

  const { data, error } = await sb
    .from("admin_users").update(update).eq("id", id).select(PUBLIC_COLS).maybeSingle();
  if (error) rethrow(error);
  if (!data) throw new UserInputError("That user no longer exists.");
  return toUser(data);
}

/** Remove a user. Their session stops working on their very next request. */
export async function deleteAdminUser(id: string): Promise<void> {
  const { error } = await getSupabaseAdmin().from("admin_users").delete().eq("id", id);
  if (error) rethrow(error);
}

// A real hash to check against when the username doesn't exist, so a wrong
// username takes as long to reject as a wrong password.
let decoy: Promise<string> | null = null;

/**
 * Check a username + password. Returns what the session token needs, or null.
 * Never throws for a missing table — users simply can't sign in until it exists.
 */
export async function authenticateAdminUser(
  rawUsername: unknown,
  password: string
): Promise<{ id: string; sessionVersion: number } | null> {
  const username = normalizeUsername(rawUsername);
  let row: Pick<Row, "id" | "password_hash" | "session_version"> | null = null;
  try {
    const { data, error } = await getSupabaseAdmin()
      .from("admin_users")
      .select("id, password_hash, session_version")
      .eq("username", username)
      .maybeSingle();
    if (error) throw new Error(error.message);
    row = data;
  } catch (e) {
    if (!isMissingTable(e)) console.error("[AUTH] admin_users lookup failed:", e);
    return null;
  }

  if (!row) {
    decoy ??= hashPassword("not-a-real-password");
    await checkPassword(password, await decoy);
    return null;
  }
  if (!(await checkPassword(password, row.password_hash))) return null;

  // Best effort — the "last signed in" column is a convenience, not a gate.
  getSupabaseAdmin()
    .from("admin_users").update({ last_login_at: new Date().toISOString() }).eq("id", row.id)
    .then(() => {}, () => {});

  return { id: row.id, sessionVersion: row.session_version };
}
