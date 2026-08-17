// ─── Pop Up Zone — voting & leaderboard ──────────────────────────────────────
//
// The rules, as the owner described them:
//
//   * A guest votes for one favorite cocktail.
//   * If they try to vote for a second, they're asked to RANK their picks
//     instead of just adding another equal vote.
//   * Lower-ranked picks still count toward deciding the leader, worth less
//     than a first-place pick.
//
// That's a Borda count. Weights are per-pop-up and editable from the admin
// panel (default 3 / 2 / 1), which is why the tally is computed here in
// TypeScript rather than baked into a SQL view.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { LeaderboardEntry, PopupCocktail, PopupMenu, PopupVote } from "./types";

/** Points a vote at `rank` is worth. Ranks past the weight list score nothing. */
export function weightForRank(menu: PopupMenu, rank: number): number {
  return menu.voteWeights[rank - 1] ?? 0;
}

/** This guest's current ballot, favorite first. */
export async function getBallot(
  menuId: string,
  userId: string,
  isTest = false
): Promise<PopupVote[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_votes")
      .select("cocktail_id, rank")
      .eq("menu_id", menuId)
      .eq("user_id", userId)
      .eq("is_test", isTest)
      .order("rank", { ascending: true });
    return (data ?? []).map((r) => ({ cocktailId: String(r.cocktail_id), rank: Number(r.rank) }));
  } catch {
    return [];
  }
}

/**
 * Turn raw vote rows into standings. Pure — no I/O — so the scoring rules can
 * be reasoned about and tested without a database.
 */
export function tallyBallots(
  menu: PopupMenu,
  cocktails: PopupCocktail[],
  rows: { cocktail_id: string; rank: number }[]
): LeaderboardEntry[] {
  const tally = new Map<string, { points: number; first: number; total: number }>();
  for (const c of cocktails) tally.set(c.id, { points: 0, first: 0, total: 0 });

  for (const row of rows) {
    const entry = tally.get(String(row.cocktail_id));
    // A vote for a cocktail that's since been removed is simply ignored.
    if (!entry) continue;
    const rank = Number(row.rank);
    entry.points += weightForRank(menu, rank);
    entry.total += 1;
    if (rank === 1) entry.first += 1;
  }

  const entries = cocktails.map((c) => {
    const t = tally.get(c.id)!;
    return {
      cocktailId: c.id,
      name: c.name,
      points: t.points,
      firstPlaceVotes: t.first,
      totalVotes: t.total,
      position: 0,
    };
  });

  // Most points wins; most #1 votes breaks a tie; then name for stability.
  entries.sort(
    (a, b) =>
      b.points - a.points ||
      b.firstPlaceVotes - a.firstPlaceVotes ||
      a.name.localeCompare(b.name)
  );

  // Genuine ties share a position (1, 2, 2, 4).
  let lastKey = "";
  let lastPos = 0;
  entries.forEach((e, i) => {
    const key = `${e.points}:${e.firstPlaceVotes}`;
    if (key !== lastKey) {
      lastPos = i + 1;
      lastKey = key;
    }
    e.position = lastPos;
  });

  return entries;
}

/**
 * Standings for a pop-up.
 *
 * Sandbox votes (is_test) live in their own tally, so an admin can exercise
 * voting end to end in the sandbox without ever touching public results.
 */
export async function getLeaderboard(
  menu: PopupMenu,
  cocktails: PopupCocktail[],
  isTest = false
): Promise<LeaderboardEntry[]> {
  noStore();

  let rows: { cocktail_id: string; rank: number }[] = [];
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_votes")
      .select("cocktail_id, rank")
      .eq("menu_id", menu.id)
      .eq("is_test", isTest);
    rows = (data ?? []) as { cocktail_id: string; rank: number }[];
  } catch {
    rows = [];
  }

  return tallyBallots(menu, cocktails, rows);
}

export interface BallotValidation {
  ok: boolean;
  error?: string;
  /** Cleaned list, favorite first. */
  ranked?: string[];
}

/**
 * Check a submitted ballot against the pop-up's rules.
 *
 * Callers must run this server-side before writing. It rejects duplicates,
 * over-long ballots and ids that don't belong to this pop-up — the same
 * guarantees the unique indexes in db/popup-zone.sql enforce at the storage
 * layer, caught earlier so the guest gets a readable message.
 */
export function validateBallot(
  menu: PopupMenu,
  cocktails: PopupCocktail[],
  rankedCocktailIds: unknown
): BallotValidation {
  if (!Array.isArray(rankedCocktailIds)) {
    return { ok: false, error: "Invalid ballot." };
  }

  const ranked = rankedCocktailIds.filter((id): id is string => typeof id === "string" && !!id);

  if (!ranked.length) {
    return { ok: false, error: "Pick at least one cocktail." };
  }
  if (new Set(ranked).size !== ranked.length) {
    return { ok: false, error: "You can only vote for each cocktail once." };
  }
  if (ranked.length > menu.voteRankDepth) {
    return {
      ok: false,
      error: `You can rank up to ${menu.voteRankDepth} cocktail${menu.voteRankDepth === 1 ? "" : "s"}.`,
    };
  }

  const valid = new Set(cocktails.filter((c) => c.active).map((c) => c.id));
  if (ranked.some((id) => !valid.has(id))) {
    return { ok: false, error: "That cocktail isn't on this pop-up menu." };
  }

  return { ok: true, ranked };
}

/**
 * Replace this guest's ballot for a pop-up.
 *
 * Delete-then-insert rather than an upsert, because the ballot is a whole
 * ordered set — a guest re-ranking from [A,B] to [B] must not leave A behind.
 * If the insert fails the guest simply has no ballot and can recast; we never
 * end up with a half-applied ranking.
 */
export async function replaceBallot(
  menuId: string,
  userId: string,
  rankedCocktailIds: string[],
  isTest = false
): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabaseAdmin();

    const { error: delErr } = await sb
      .from("popup_votes")
      .delete()
      .eq("menu_id", menuId)
      .eq("user_id", userId)
      .eq("is_test", isTest);
    if (delErr) throw delErr;

    // An empty list is a withdrawal — the delete above is the whole operation.
    if (!rankedCocktailIds.length) return { ok: true };

    const rows = rankedCocktailIds.map((cocktailId, i) => ({
      menu_id: menuId,
      user_id: userId,
      cocktail_id: cocktailId,
      rank: i + 1,
      is_test: isTest,
    }));

    const { error: insErr } = await sb.from("popup_votes").insert(rows);
    if (insErr) throw insErr;

    return { ok: true };
  } catch (e) {
    console.error("[popup] replaceBallot failed", e);
    return { ok: false, error: "Could not save your vote. Please try again." };
  }
}

export interface BallotHistoryEntry {
  menuId: string;
  menuTitle: string;
  menuSlug: string;
  picks: { name: string; rank: number }[];
}

/**
 * Every ballot this guest has cast, newest pop-up first.
 * Powers the "your picks" list on their account page.
 */
export async function getBallotHistory(userId: string): Promise<BallotHistoryEntry[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_votes")
      .select("rank, menu_id, popup_menus(id,title,slug,go_live_at), popup_cocktails(name)")
      .eq("user_id", userId)
      .eq("is_test", false)
      .order("rank", { ascending: true });

    const byMenu = new Map<string, BallotHistoryEntry & { sortKey: string }>();

    for (const row of (data ?? []) as unknown as {
      rank: number;
      menu_id: string;
      popup_menus: { id: string; title: string; slug: string; go_live_at: string | null } | null;
      popup_cocktails: { name: string } | null;
    }[]) {
      const menu = row.popup_menus;
      if (!menu) continue;
      const existing = byMenu.get(menu.id) ?? {
        menuId: menu.id,
        menuTitle: menu.title,
        menuSlug: menu.slug,
        picks: [],
        sortKey: menu.go_live_at ?? "",
      };
      existing.picks.push({ name: row.popup_cocktails?.name ?? "—", rank: Number(row.rank) });
      byMenu.set(menu.id, existing);
    }

    // Array.from rather than spreading the iterator — the project targets ES5.
    const entries = Array.from(byMenu.values());
    entries.sort((a, b) => b.sortKey.localeCompare(a.sortKey));

    return entries.map((e): BallotHistoryEntry => ({
      menuId: e.menuId,
      menuTitle: e.menuTitle,
      menuSlug: e.menuSlug,
      picks: e.picks.slice().sort((a, b) => a.rank - b.rank),
    }));
  } catch {
    return [];
  }
}

/** How many distinct guests have voted on a pop-up. */
export async function getVoterCount(menuId: string, isTest = false): Promise<number> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_votes")
      .select("user_id")
      .eq("menu_id", menuId)
      .eq("is_test", isTest);
    return new Set((data ?? []).map((r) => String(r.user_id))).size;
  } catch {
    return 0;
  }
}
