// ─── Pop Up Zone — Tiki Wars progression ─────────────────────────────────────
//
// Money, armor, luck and a running score that survive a game over. See
// db/popup-tiki-progress.sql for the shape and docs/tiki-wars.md for why each
// field persists and the others don't.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";

export interface TikiProgress {
  money: number;
  armor: number;
  luck: number;
  bestStage: number;
  totalScore: number;
  runs: number;
}

export const BLANK_PROGRESS: TikiProgress = {
  money: 0, armor: 0, luck: 0, bestStage: 1, totalScore: 0, runs: 0,
};

export const MAX_ARMOR = 10;
export const MAX_LUCK = 100;
/** Mirrors popup_game_scores. */
export const MAX_TOTAL = 10_000_000;

function clampInt(v: number, lo: number, hi: number): number {
  if (!Number.isFinite(v)) return lo;
  return Math.max(lo, Math.min(hi, Math.round(v)));
}

/**
 * Bring a client's numbers into range.
 *
 * CLAMPED, never rejected. A guest who has just had the run of their life
 * should not lose it to a validation error — the ceiling exists to stop a
 * tampered request parking an absurd number at the top of the board, and
 * clamping does that just as well while being kind to the honest case.
 */
export function sanitise(p: TikiProgress): TikiProgress {
  return {
    money: clampInt(p.money, 0, 1_000_000),
    armor: clampInt(p.armor, 0, MAX_ARMOR),
    // Luck only ever moves in tens; snapping here keeps a tampered 37% out of
    // the database and off the shop's price maths.
    luck: clampInt(Math.round(p.luck / 10) * 10, 0, MAX_LUCK),
    bestStage: clampInt(p.bestStage, 1, 10_000),
    totalScore: clampInt(p.totalScore, 0, MAX_TOTAL),
    runs: clampInt(p.runs, 0, 100_000),
  };
}

export async function loadTikiProgress(
  userId: string,
  menuId: string
): Promise<TikiProgress> {
  noStore();
  const sb = getSupabaseAdmin();
  if (!sb) return { ...BLANK_PROGRESS };

  const { data, error } = await sb
    .from("popup_tiki_progress")
    .select("money, armor, luck, best_stage, total_score, runs")
    .eq("user_id", userId)
    .eq("menu_id", menuId)
    .maybeSingle();

  // No row is the normal state for a first-time player, not a failure.
  if (error || !data) return { ...BLANK_PROGRESS };

  return sanitise({
    money: data.money,
    armor: data.armor,
    luck: data.luck,
    bestStage: data.best_stage,
    totalScore: data.total_score,
    runs: data.runs,
  });
}

export async function saveTikiProgress(
  userId: string,
  menuId: string,
  incoming: TikiProgress
): Promise<{ ok: true; progress: TikiProgress } | { ok: false; error: string }> {
  const sb = getSupabaseAdmin();
  if (!sb) return { ok: false, error: "Progress isn't available right now." };

  const clean = sanitise(incoming);

  // Two tabs, a stale client or a request arriving out of order must not erase
  // a guest's progress. bestStage and runs only ever climb, so they ratchet.
  //
  // totalScore CANNOT ratchet: dodging an enemy deducts points, so an honest
  // run can legitimately end lower than it started. Clamping it upward would
  // silently refund every penalty and make dodging free again — the exact thing
  // the penalty exists to prevent. Instead it is guarded by the run counter: a
  // write is only accepted from a client that has played at least as many runs
  // as we have already recorded, which rejects a stale save without rejecting a
  // legitimately lower score.
  const existing = await loadTikiProgress(userId, menuId);
  const stale = clean.runs < existing.runs;
  const merged: TikiProgress = {
    ...clean,
    bestStage: Math.max(existing.bestStage, clean.bestStage),
    runs: Math.max(existing.runs, clean.runs),
    totalScore: stale ? existing.totalScore : clean.totalScore,
    money: stale ? existing.money : clean.money,
    armor: stale ? existing.armor : clean.armor,
    luck: stale ? existing.luck : clean.luck,
  };

  const { error } = await sb.from("popup_tiki_progress").upsert(
    {
      user_id: userId,
      menu_id: menuId,
      money: merged.money,
      armor: merged.armor,
      luck: merged.luck,
      best_stage: merged.bestStage,
      total_score: merged.totalScore,
      runs: merged.runs,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "user_id,menu_id" }
  );

  if (error) return { ok: false, error: "Could not save your progress." };
  return { ok: true, progress: merged };
}
