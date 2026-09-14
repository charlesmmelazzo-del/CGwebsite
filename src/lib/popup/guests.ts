// ─── Pop Up Zone — guest accounts, admin side ────────────────────────────────
//
// One guest account works across every pop-up. Supabase Auth owns the login
// (email, password, confirmed or not); popup_profiles owns the name. The admin
// panel edits both through here so the two never drift apart.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface GuestAccount {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  emailConfirmed: boolean;
  createdAt: string;
  lastSignInAt: string | null;
  ticketRuns: number;
}

/** Every guest, newest first. Auth is the source of truth for who exists. */
export async function listGuests(): Promise<GuestAccount[]> {
  noStore();
  const sb = getSupabaseAdmin();

  const users: {
    id: string;
    email?: string;
    email_confirmed_at?: string | null;
    created_at: string;
    last_sign_in_at?: string | null;
  }[] = [];
  for (let page = 1; page <= 50; page++) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    users.push(...data.users);
    if (data.users.length < 1000) break;
  }

  const [{ data: profiles }, { data: runs }] = await Promise.all([
    sb.from("popup_profiles").select("id, first_name, last_name, email"),
    sb.from("popup_ticket_redemptions").select("user_id"),
  ]);
  const profileById = new Map((profiles ?? []).map((p) => [String(p.id), p]));
  const runsByUser = new Map<string, number>();
  for (const r of runs ?? []) {
    const id = String(r.user_id);
    runsByUser.set(id, (runsByUser.get(id) ?? 0) + 1);
  }

  return users
    .map((u) => {
      const p = profileById.get(u.id);
      return {
        id: u.id,
        email: u.email ?? p?.email ?? "",
        firstName: p?.first_name ?? "",
        lastName: p?.last_name ?? "",
        emailConfirmed: Boolean(u.email_confirmed_at),
        createdAt: u.created_at,
        lastSignInAt: u.last_sign_in_at ?? null,
        ticketRuns: runsByUser.get(u.id) ?? 0,
      };
    })
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export async function updateGuest(
  id: string,
  patch: {
    email?: string;
    firstName?: string;
    lastName?: string;
    password?: string;
    confirmEmail?: boolean;
  }
): Promise<{ ok: true } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();

  const authPatch: { email?: string; password?: string; email_confirm?: boolean } = {};
  if (patch.email !== undefined) authPatch.email = patch.email;
  if (patch.password) authPatch.password = patch.password;
  // An email changed by the owner is trusted — don't make the guest re-confirm it.
  if (patch.confirmEmail || patch.email !== undefined) authPatch.email_confirm = true;

  if (Object.keys(authPatch).length) {
    const { error } = await sb.auth.admin.updateUserById(id, authPatch);
    if (error) return { ok: false, error: error.message };
  }

  const row: Record<string, string> = { updated_at: new Date().toISOString() };
  if (patch.email !== undefined) row.email = patch.email;
  if (patch.firstName !== undefined) row.first_name = patch.firstName;
  if (patch.lastName !== undefined) row.last_name = patch.lastName;
  if (Object.keys(row).length > 1) {
    const { error } = await sb.from("popup_profiles").upsert({ id, ...row }, { onConflict: "id" });
    if (error) return { ok: false, error: "Login updated, but the name could not be saved." };
  }

  return { ok: true };
}

/**
 * Delete a guest outright. Their scores and ticket runs go with them
 * (every popup_* table cascades on auth.users), so a deleted winner is gone
 * from the boards too.
 */
export async function deleteGuest(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.auth.admin.deleteUser(id);
  return !error;
}
