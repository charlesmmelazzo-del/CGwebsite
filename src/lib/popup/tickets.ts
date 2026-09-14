// ─── Pop Up Zone — raffle-ticket high score runs ─────────────────────────────
//
// Every cocktail comes with a physical raffle ticket. Its serial number buys one
// "High Score Run" on one game, so the prize goes to someone playing at the bar
// rather than someone replaying at home all week. See db/popup-tickets.sql.
//
// The ticket is spent when the run STARTS, not when it ends. Otherwise a guest
// could quit or reload a bad run and try the same ticket again forever.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Longest serial accepted — comfortably inside a Postgres bigint. */
const MAX_DIGITS = 15;

/** Largest single range, so a typo can't validate a million tickets at once. */
export const MAX_RANGE_SIZE = 100_000;

export interface TicketRange {
  id: string;
  cocktailId: string;
  startSerial: number;
  endSerial: number;
  active: boolean;
  used: number;
  createdAt: string;
}

export interface TicketRedemption {
  id: string;
  serial: number;
  cocktailId: string | null;
  gameKey: string;
  guestName: string;
  guestEmail: string;
  redeemedAt: string;
  completed: boolean;
  score: number | null;
}

export type RedeemFailure =
  | "invalid"
  | "not_found"
  | "wrong_game"
  | "already_used"
  | "error";

/**
 * A serial as typed by a guest, as a number — or null if it isn't one.
 * Spaces, dashes and a leading "#" are forgiven, since tickets print them.
 */
export function parseSerial(input: unknown): number | null {
  const cleaned = String(input ?? "").trim().replace(/^#/, "").replace(/[\s-]/g, "");
  if (!/^\d+$/.test(cleaned) || cleaned.length > MAX_DIGITS) return null;
  return Number(cleaned);
}

function mapRange(r: Record<string, unknown>, used = 0): TicketRange {
  return {
    id: String(r.id),
    cocktailId: String(r.cocktail_id),
    startSerial: Number(r.start_serial),
    endSerial: Number(r.end_serial),
    active: Boolean(r.active),
    used,
    createdAt: String(r.created_at),
  };
}

// ─── Admin: ranges ───────────────────────────────────────────────────────────

export async function listRanges(menuId: string): Promise<TicketRange[]> {
  noStore();
  const sb = getSupabaseAdmin();
  const [{ data: ranges, error }, { data: uses }] = await Promise.all([
    sb
      .from("popup_ticket_ranges")
      .select("*")
      .eq("menu_id", menuId)
      .order("start_serial", { ascending: true }),
    sb.from("popup_ticket_redemptions").select("range_id").eq("menu_id", menuId),
  ]);
  if (error) throw error;

  const usedByRange = new Map<string, number>();
  for (const u of uses ?? []) {
    const id = String(u.range_id);
    usedByRange.set(id, (usedByRange.get(id) ?? 0) + 1);
  }
  return (ranges ?? []).map((r) => mapRange(r, usedByRange.get(String(r.id)) ?? 0));
}

export async function createRange(args: {
  menuId: string;
  cocktailId: string;
  startSerial: number;
  endSerial: number;
}): Promise<{ ok: true; range: TicketRange } | { ok: false; error: string }> {
  const { menuId, cocktailId, startSerial, endSerial } = args;

  if (startSerial > endSerial) {
    return { ok: false, error: "The first serial number has to be lower than the last." };
  }
  if (endSerial - startSerial + 1 > MAX_RANGE_SIZE) {
    return {
      ok: false,
      error: `That's more than ${MAX_RANGE_SIZE.toLocaleString()} tickets in one range. Check the numbers, or split it up.`,
    };
  }

  const sb = getSupabaseAdmin();

  // A serial must mean exactly one game, so ranges on the same pop-up can't
  // overlap — even across different cocktails.
  const { data: clash } = await sb
    .from("popup_ticket_ranges")
    .select("start_serial, end_serial")
    .eq("menu_id", menuId)
    .lte("start_serial", endSerial)
    .gte("end_serial", startSerial)
    .limit(1)
    .maybeSingle();
  if (clash) {
    return {
      ok: false,
      error: `Those numbers overlap a range that's already set up (${clash.start_serial}–${clash.end_serial}).`,
    };
  }

  const { data, error } = await sb
    .from("popup_ticket_ranges")
    .insert({
      menu_id: menuId,
      cocktail_id: cocktailId,
      start_serial: startSerial,
      end_serial: endSerial,
    })
    .select("*")
    .single();
  if (error) {
    console.error("[popup] createRange failed", error);
    return { ok: false, error: "Could not save that range." };
  }
  return { ok: true, range: mapRange(data) };
}

export async function setRangeActive(id: string, active: boolean): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("popup_ticket_ranges").update({ active }).eq("id", id);
  return !error;
}

export async function deleteRange(id: string): Promise<boolean> {
  const sb = getSupabaseAdmin();
  const { error } = await sb.from("popup_ticket_ranges").delete().eq("id", id);
  return !error;
}

/** The most recent tickets played on a pop-up, with who played them. */
export async function listRedemptions(menuId: string, limit = 100): Promise<TicketRedemption[]> {
  noStore();
  const sb = getSupabaseAdmin();
  const { data: rows } = await sb
    .from("popup_ticket_redemptions")
    .select("id, serial, cocktail_id, game_key, user_id, redeemed_at, completed_at")
    .eq("menu_id", menuId)
    .order("redeemed_at", { ascending: false })
    .limit(limit);
  if (!rows?.length) return [];

  const userIds = Array.from(new Set(rows.map((r) => String(r.user_id))));
  const ids = rows.map((r) => String(r.id));
  const [{ data: profiles }, { data: scores }] = await Promise.all([
    sb.from("popup_profiles").select("id, first_name, last_name, email").in("id", userIds),
    sb.from("popup_game_scores").select("redemption_id, score").in("redemption_id", ids),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [String(p.id), p]));
  const scoreByRedemption = new Map(
    (scores ?? []).map((s) => [String(s.redemption_id), Number(s.score)])
  );

  return rows.map((r) => {
    const p = profileById.get(String(r.user_id));
    return {
      id: String(r.id),
      serial: Number(r.serial),
      cocktailId: r.cocktail_id ? String(r.cocktail_id) : null,
      gameKey: String(r.game_key),
      guestName: [p?.first_name, p?.last_name].filter(Boolean).join(" ") || "Unknown",
      guestEmail: p?.email ?? "",
      redeemedAt: String(r.redeemed_at),
      completed: Boolean(r.completed_at),
      score: scoreByRedemption.get(String(r.id)) ?? null,
    };
  });
}

// ─── Guests: spending a ticket ───────────────────────────────────────────────

/**
 * Spend a ticket on one run of one cocktail's game.
 *
 * Returns the redemption id, which the client sends back with the score. The
 * unique index on (menu_id, serial) is the real guard against a ticket being
 * used twice — the lookup before it only exists to give a helpful message.
 */
export async function redeemTicket(args: {
  menuId: string;
  cocktailId: string;
  gameKey: string;
  userId: string;
  serial: number;
}): Promise<
  | { ok: true; redemptionId: string }
  | { ok: false; reason: RedeemFailure; otherCocktailId?: string }
> {
  const { menuId, cocktailId, gameKey, userId, serial } = args;
  try {
    const sb = getSupabaseAdmin();

    const { data: range } = await sb
      .from("popup_ticket_ranges")
      .select("id, cocktail_id")
      .eq("menu_id", menuId)
      .eq("active", true)
      .lte("start_serial", serial)
      .gte("end_serial", serial)
      .limit(1)
      .maybeSingle();

    if (!range) return { ok: false, reason: "not_found" };
    if (String(range.cocktail_id) !== cocktailId) {
      return { ok: false, reason: "wrong_game", otherCocktailId: String(range.cocktail_id) };
    }

    const { data, error } = await sb
      .from("popup_ticket_redemptions")
      .insert({
        menu_id: menuId,
        cocktail_id: cocktailId,
        range_id: range.id,
        user_id: userId,
        serial,
        game_key: gameKey,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = unique_violation: somebody already played this ticket.
      if (error.code === "23505") return { ok: false, reason: "already_used" };
      throw error;
    }
    return { ok: true, redemptionId: String(data.id) };
  } catch (e) {
    console.error("[popup] redeemTicket failed", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Mark a guest's ticket run as finished so its score can be saved — once.
 *
 * The update only matches an unfinished run belonging to this guest, game and
 * pop-up, so a replayed request or someone else's ticket id matches nothing.
 */
export async function completeRedemption(args: {
  redemptionId: string;
  userId: string;
  menuId: string;
  gameKey: string;
}): Promise<{ ok: true; cocktailId: string | null } | { ok: false }> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("popup_ticket_redemptions")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", args.redemptionId)
      .eq("user_id", args.userId)
      .eq("menu_id", args.menuId)
      .eq("game_key", args.gameKey)
      .is("completed_at", null)
      .select("cocktail_id")
      .maybeSingle();
    if (error || !data) return { ok: false };
    return { ok: true, cocktailId: data.cocktail_id ? String(data.cocktail_id) : null };
  } catch {
    return { ok: false };
  }
}

/** Put a run back to unfinished, when its score couldn't be saved after all. */
export async function reopenRedemption(redemptionId: string): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb
      .from("popup_ticket_redemptions")
      .update({ completed_at: null })
      .eq("id", redemptionId);
  } catch {
    /* the admin log still shows the ticket as played */
  }
}
