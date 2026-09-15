// ─── Pop Up Zone — raffle tickets ────────────────────────────────────────────
//
// Every cocktail comes with a physical raffle ticket. Entering its serial number
// UNLOCKS that cocktail's game for the guest — unlimited free play instead of
// the short demo — and gives them RUNS_PER_TICKET High Score Runs on it. The
// games are a garnish on the drink: to really play, order it.
// See db/popup-tickets.sql and db/popup-ticket-runs.sql.
//
// A run is spent when it STARTS, not when it ends. Otherwise a guest could quit
// or reload a bad run and try again forever.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

/** Longest serial accepted — comfortably inside a Postgres bigint. */
const MAX_DIGITS = 15;

/** Largest single range, so a typo can't validate a million tickets at once. */
export const MAX_RANGE_SIZE = 100_000;

/** High Score Runs that come with one ticket. */
export const RUNS_PER_TICKET = 3;

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
  runsUsed: number;
  runsAllowed: number;
  /** Best score across this ticket's runs, or null if none finished. */
  score: number | null;
}

/** What a signed-in guest has unlocked on one cocktail's game. */
export interface GameAccess {
  unlocked: boolean;
  runsLeft: number;
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
    .select("id, serial, cocktail_id, game_key, user_id, redeemed_at, runs_allowed")
    .eq("menu_id", menuId)
    .order("redeemed_at", { ascending: false })
    .limit(limit);
  if (!rows?.length) return [];

  const userIds = Array.from(new Set(rows.map((r) => String(r.user_id))));
  const ids = rows.map((r) => String(r.id));
  const [{ data: profiles }, { data: scores }, { data: runs }] = await Promise.all([
    sb.from("popup_profiles").select("id, first_name, last_name, email").in("id", userIds),
    sb.from("popup_game_scores").select("redemption_id, score").in("redemption_id", ids),
    sb.from("popup_ticket_runs").select("redemption_id").in("redemption_id", ids),
  ]);

  const profileById = new Map((profiles ?? []).map((p) => [String(p.id), p]));
  const scoreByRedemption = new Map<string, number>();
  for (const sc of scores ?? []) {
    const k = String(sc.redemption_id);
    scoreByRedemption.set(k, Math.max(scoreByRedemption.get(k) ?? 0, Number(sc.score)));
  }
  const runsByRedemption = new Map<string, number>();
  for (const r of runs ?? []) {
    const k = String(r.redemption_id);
    runsByRedemption.set(k, (runsByRedemption.get(k) ?? 0) + 1);
  }

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
      runsUsed: runsByRedemption.get(String(r.id)) ?? 0,
      runsAllowed: Number(r.runs_allowed ?? RUNS_PER_TICKET),
      score: scoreByRedemption.get(String(r.id)) ?? null,
    };
  });
}

// ─── Guests: unlocking with a ticket ─────────────────────────────────────────

/**
 * Enter a ticket: unlock one cocktail's game for this guest, with its runs.
 *
 * The unique index on (menu_id, serial) is the real guard against a ticket
 * being used twice — the lookup before it only exists to give a helpful
 * message. Entering your OWN ticket again is not an error: it is already yours.
 */
export async function redeemTicket(args: {
  menuId: string;
  cocktailId: string;
  gameKey: string;
  userId: string;
  serial: number;
}): Promise<
  | { ok: true; redemptionId: string; alreadyYours: boolean }
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
        runs_allowed: RUNS_PER_TICKET,
      })
      .select("id")
      .single();

    if (error) {
      // 23505 = unique_violation: this ticket has been entered before.
      if (error.code === "23505") {
        const { data: existing } = await sb
          .from("popup_ticket_redemptions")
          .select("id, user_id")
          .eq("menu_id", menuId)
          .eq("serial", serial)
          .maybeSingle();
        if (existing && String(existing.user_id) === userId) {
          return { ok: true, redemptionId: String(existing.id), alreadyYours: true };
        }
        return { ok: false, reason: "already_used" };
      }
      throw error;
    }
    return { ok: true, redemptionId: String(data.id), alreadyYours: false };
  } catch (e) {
    console.error("[popup] redeemTicket failed", e);
    return { ok: false, reason: "error" };
  }
}

/** A guest's tickets on one pop-up, with how many runs each has used. */
async function ticketsFor(menuId: string, userId: string, cocktailId?: string) {
  const sb = getSupabaseAdmin();
  let q = sb
    .from("popup_ticket_redemptions")
    .select("id, cocktail_id, game_key, runs_allowed, redeemed_at")
    .eq("menu_id", menuId)
    .eq("user_id", userId)
    .order("redeemed_at", { ascending: true });
  if (cocktailId) q = q.eq("cocktail_id", cocktailId);
  const { data: tickets, error } = await q;
  if (error) throw error;
  if (!tickets?.length) return [];

  const { data: runs, error: runsError } = await sb
    .from("popup_ticket_runs")
    .select("redemption_id")
    .in("redemption_id", tickets.map((t) => String(t.id)));
  if (runsError) throw runsError;
  const used = new Map<string, number>();
  for (const r of runs ?? []) {
    const k = String(r.redemption_id);
    used.set(k, (used.get(k) ?? 0) + 1);
  }
  return tickets.map((t) => ({
    id: String(t.id),
    cocktailId: t.cocktail_id ? String(t.cocktail_id) : null,
    gameKey: String(t.game_key),
    allowed: Number(t.runs_allowed ?? RUNS_PER_TICKET),
    used: used.get(String(t.id)) ?? 0,
  }));
}

/** Every game this guest has unlocked on a pop-up, keyed by cocktail id. */
export async function getAccess(menuId: string, userId: string): Promise<Record<string, GameAccess>> {
  noStore();
  const out: Record<string, GameAccess> = {};
  for (const t of await ticketsFor(menuId, userId)) {
    if (!t.cocktailId) continue;
    const a = out[t.cocktailId] ?? { unlocked: true, runsLeft: 0 };
    a.runsLeft += Math.max(0, t.allowed - t.used);
    out[t.cocktailId] = a;
  }
  return out;
}

export type StartRunFailure = "locked" | "no_runs" | "error";

/**
 * Start one High Score Run on a game this guest has unlocked, spending a run
 * from their oldest ticket that still has one. The unique (ticket, run number)
 * index stops two phones taking the same run at once; losing that race just
 * tries again with the next number.
 */
export async function startRun(args: {
  menuId: string;
  cocktailId: string;
  gameKey: string;
  userId: string;
}): Promise<{ ok: true; runId: string; runsLeft: number } | { ok: false; reason: StartRunFailure }> {
  try {
    const sb = getSupabaseAdmin();
    for (let attempt = 0; attempt < 3; attempt++) {
      const tickets = await ticketsFor(args.menuId, args.userId, args.cocktailId);
      if (!tickets.length) return { ok: false, reason: "locked" };
      const ticket = tickets.find((t) => t.used < t.allowed);
      if (!ticket) return { ok: false, reason: "no_runs" };

      const { data, error } = await sb
        .from("popup_ticket_runs")
        .insert({
          redemption_id: ticket.id,
          menu_id: args.menuId,
          user_id: args.userId,
          game_key: args.gameKey,
          run_number: ticket.used + 1,
        })
        .select("id")
        .single();
      if (error) {
        if (error.code === "23505") continue;
        throw error;
      }
      const left = tickets.reduce((n, t) => n + Math.max(0, t.allowed - t.used), 0) - 1;
      return { ok: true, runId: String(data.id), runsLeft: Math.max(0, left) };
    }
    return { ok: false, reason: "error" };
  } catch (e) {
    console.error("[popup] startRun failed", e);
    return { ok: false, reason: "error" };
  }
}

/**
 * Mark a guest's run as finished so its score can be saved — once.
 *
 * The update only matches an unfinished run belonging to this guest, game and
 * pop-up, so a replayed request or someone else's run id matches nothing.
 */
export async function completeRun(args: {
  runId: string;
  userId: string;
  menuId: string;
  gameKey: string;
}): Promise<{ ok: true; redemptionId: string; cocktailId: string | null } | { ok: false }> {
  try {
    const sb = getSupabaseAdmin();
    const { data, error } = await sb
      .from("popup_ticket_runs")
      .update({ completed_at: new Date().toISOString() })
      .eq("id", args.runId)
      .eq("user_id", args.userId)
      .eq("menu_id", args.menuId)
      .eq("game_key", args.gameKey)
      .is("completed_at", null)
      .select("redemption_id")
      .maybeSingle();
    if (error || !data) return { ok: false };
    const { data: ticket } = await sb
      .from("popup_ticket_redemptions")
      .select("cocktail_id")
      .eq("id", data.redemption_id)
      .maybeSingle();
    return {
      ok: true,
      redemptionId: String(data.redemption_id),
      cocktailId: ticket?.cocktail_id ? String(ticket.cocktail_id) : null,
    };
  } catch {
    return { ok: false };
  }
}

/** Put a run back to unfinished, when its score couldn't be saved after all. */
export async function reopenRun(runId: string): Promise<void> {
  try {
    const sb = getSupabaseAdmin();
    await sb.from("popup_ticket_runs").update({ completed_at: null }).eq("id", runId);
  } catch {
    /* the admin log still shows the run as played */
  }
}
