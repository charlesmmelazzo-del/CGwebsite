// ─── Pop Up Zone — guest authentication ──────────────────────────────────────
//
// Guest accounts use Supabase Auth and are COMPLETELY SEPARATE from the admin
// login. The admin panel still uses ADMIN_PASSWORD + the signed `cg-admin-session`
// cookie (src/lib/session.ts); nothing here touches that.
//
// Two clients are in play and the distinction matters:
//   * The ANON-key client below handles sessions. It reads/writes the auth
//     cookies and is the only thing that can mint a guest session.
//   * The SERVICE-ROLE client (src/lib/supabase.ts) reads and writes our own
//     popup_* tables. It bypasses RLS and is never used for guest auth.

import { cookies } from "next/headers";
import { createServerClient, type CookieOptions } from "@supabase/ssr";
import type { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { PopupProfile, PopupViewer } from "./types";

/** Minimum age to hold a Pop Up Zone account. */
export const MINIMUM_AGE = 21;

function anonEnv(): { url: string; key: string } | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return { url, key };
}

/** True when guest accounts are configured. Lets the UI explain itself rather
 *  than crashing when the anon key hasn't been set yet. */
export function isPopupAuthConfigured(): boolean {
  return anonEnv() !== null;
}

/**
 * Supabase client bound to the request's cookies. Use in Server Components,
 * Route Handlers and Server Actions.
 *
 * Returns null when the anon key is unset.
 */
export function createPopupServerClient() {
  const env = anonEnv();
  if (!env) return null;

  const store = cookies();
  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return store.getAll();
      },
      setAll(list) {
        try {
          list.forEach(({ name, value, options }) => store.set(name, value, options));
        } catch {
          // Server Components can't set cookies. The middleware refreshes the
          // session instead, so this is safe to swallow.
        }
      },
    },
  });
}

/**
 * Middleware variant — refreshes an expiring guest session and writes the
 * rotated cookies onto the outgoing response.
 */
export function createPopupMiddlewareClient(req: NextRequest, res: NextResponse) {
  const env = anonEnv();
  if (!env) return null;

  return createServerClient(env.url, env.key, {
    cookies: {
      getAll() {
        return req.cookies.getAll();
      },
      setAll(list: { name: string; value: string; options: CookieOptions }[]) {
        list.forEach(({ name, value, options }) => res.cookies.set(name, value, options));
      },
    },
  });
}

// ─── Age ─────────────────────────────────────────────────────────────────────

/**
 * Whole years between `dob` and today. Returns null for an unparseable or
 * future date. Always run on the server — the client is never trusted for this.
 */
export function calculateAge(dob: string): number | null {
  const birth = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(birth.getTime())) return null;

  const now = new Date();
  if (birth.getTime() > now.getTime()) return null;

  let age = now.getUTCFullYear() - birth.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - birth.getUTCMonth();
  // Birthday hasn't happened yet this year → subtract one.
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < birth.getUTCDate())) {
    age--;
  }
  return age;
}

export function meetsMinimumAge(dob: string): boolean {
  const age = calculateAge(dob);
  return age !== null && age >= MINIMUM_AGE;
}

// ─── Profiles ────────────────────────────────────────────────────────────────

function mapProfile(r: Record<string, unknown>): PopupProfile {
  return {
    id: String(r.id),
    email: (r.email as string) ?? "",
    firstName: (r.first_name as string) ?? "",
    lastName: (r.last_name as string) ?? "",
    dateOfBirth: (r.date_of_birth as string) ?? "",
    ageVerified: Boolean(r.age_verified),
  };
}

export async function getProfile(userId: string): Promise<PopupProfile | null> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    return data ? mapProfile(data) : null;
  } catch {
    return null;
  }
}

/**
 * The signed-in guest, or null. Derived entirely from the session cookie.
 *
 * Uses auth.getUser() rather than getSession() — getUser() revalidates the JWT
 * against Supabase, so a tampered cookie can't fabricate a viewer.
 */
export async function getViewer(): Promise<PopupViewer | null> {
  const sb = createPopupServerClient();
  if (!sb) return null;

  try {
    const {
      data: { user },
    } = await sb.auth.getUser();
    if (!user) return null;

    const profile = await getProfile(user.id);
    return {
      userId: user.id,
      email: user.email ?? "",
      emailVerified: Boolean(user.email_confirmed_at ?? user.confirmed_at),
      ageVerified: profile?.ageVerified ?? false,
      profile,
    };
  } catch {
    return null;
  }
}
