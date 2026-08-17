// ─── Pop Up Zone — arcade high scores ────────────────────────────────────────
//
// Every play-through is stored (see db/popup-high-scores.sql). A leaderboard is
// each guest's BEST run, computed here rather than stored, so a guest can play
// as many times as they like and only their best stands.
//
// These boards decide a real $15 gift card, so the read side never exposes a
// guest's email — only a first name and last initial. The owner sees the full
// contact details in the admin winners panel, and nowhere else.

import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "@/lib/supabase";
import type { GameBoard, GameScoreEntry } from "./types";

/** Highest score a single run may claim. Mirrors the DB check constraint. */
export const MAX_SCORE = 10_000_000;

/** How many rows a public board shows. */
const BOARD_SIZE = 10;

interface ScoreRow {
  user_id: string | null;
  score: number;
  created_at: string;
}

/**
 * Public-facing name for a leaderboard: "Mike L." — enough for a guest to spot
 * themselves at the bar, never enough to identify a stranger.
 */
function displayName(first?: string, last?: string): string {
  const f = (first ?? "").trim();
  const l = (last ?? "").trim();
  if (!f && !l) return "Anonymous";
  const initial = l ? ` ${l[0].toUpperCase()}.` : "";
  return `${f}${initial}`.trim() || "Anonymous";
}

/**
 * The board for one game on one pop-up.
 *
 * Sandbox runs live in their own board (is_test), so an admin testing a game
 * never appears in front of guests.
 */
export async function getGameBoard(
  menuId: string,
  gameKey: string,
  viewerId: string | null,
  isTest = false
): Promise<GameBoard> {
  noStore();

  const empty: GameBoard = {
    gameKey,
    entries: [],
    yourBest: null,
    yourPosition: null,
    totalPlayers: 0,
  };

  let rows: ScoreRow[] = [];
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_game_scores")
      .select("user_id, score, created_at")
      .eq("menu_id", menuId)
      .eq("game_key", gameKey)
      .eq("is_test", isTest)
      .order("score", { ascending: false })
      .limit(2000);
    rows = (data ?? []) as ScoreRow[];
  } catch {
    return empty;
  }

  if (!rows.length) return empty;

  // Collapse to each guest's best run. Anonymous runs (no user_id) are never
  // stored, but guard anyway rather than grouping them all into one "player".
  const best = new Map<string, ScoreRow>();
  for (const r of rows) {
    if (!r.user_id) continue;
    const current = best.get(r.user_id);
    if (!current || r.score > current.score) best.set(r.user_id, r);
  }

  const bests = Array.from(best.entries()).map(([userId, r]) => ({
    userId,
    score: r.score,
    achievedAt: r.created_at,
  }));

  // Highest score first; an earlier run wins a tie, which is the arcade
  // convention and rewards whoever got there first.
  bests.sort((a, b) => b.score - a.score || a.achievedAt.localeCompare(b.achievedAt));

  // Names for the rows we're actually going to show, plus the viewer's own.
  const needed = new Set(bests.slice(0, BOARD_SIZE).map((b) => b.userId));
  if (viewerId) needed.add(viewerId);

  const names = new Map<string, string>();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("popup_profiles")
      .select("id, first_name, last_name")
      .in("id", Array.from(needed));
    for (const p of data ?? []) {
      names.set(String(p.id), displayName(p.first_name, p.last_name));
    }
  } catch {
    /* fall through — rows render as "Anonymous" rather than failing the page */
  }

  // Equal scores share a position (1, 2, 2, 4).
  let lastScore = Number.NaN;
  let lastPos = 0;
  const ranked = bests.map((b, i) => {
    if (b.score !== lastScore) {
      lastPos = i + 1;
      lastScore = b.score;
    }
    return { ...b, position: lastPos };
  });

  const entries: GameScoreEntry[] = ranked.slice(0, BOARD_SIZE).map((b) => ({
    score: b.score,
    name: names.get(b.userId) ?? "Anonymous",
    position: b.position,
    isYou: b.userId === viewerId,
    achievedAt: b.achievedAt,
  }));

  const mine = viewerId ? ranked.find((b) => b.userId === viewerId) : undefined;

  return {
    gameKey,
    entries,
    yourBest: mine?.score ?? null,
    yourPosition: mine?.position ?? null,
    totalPlayers: ranked.length,
  };
}

/** Record one play-through. */
export async function recordScore(args: {
  menuId: string;
  cocktailId: string | null;
  userId: string;
  gameKey: string;
  score: number;
  detail?: Record<string, unknown>;
  isTest?: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  try {
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("popup_game_scores").insert({
      menu_id: args.menuId,
      cocktail_id: args.cocktailId,
      user_id: args.userId,
      game_key: args.gameKey,
      score: args.score,
      detail: args.detail ?? {},
      is_test: args.isTest ?? false,
    });
    if (error) throw error;
    return { ok: true };
  } catch (e) {
    console.error("[popup] recordScore failed", e);
    return { ok: false, error: "Could not save your score." };
  }
}

export interface GameWinner {
  gameKey: string;
  cocktailName: string;
  /** Null when nobody has played this game yet. */
  winner: {
    name: string;
    email: string;
    score: number;
    achievedAt: string;
    emailVerified: boolean;
  } | null;
  totalPlayers: number;
}

/**
 * Top scorer per game for a pop-up, WITH contact details — the list the owner
 * works from when sending the gift cards.
 *
 * Admin-only: this is the one place a guest's email is attached to a score.
 * `emailVerified` is surfaced so an unconfirmed address is obvious before
 * anyone sends money to it.
 */
export async function getGameWinners(
  menuId: string,
  cocktails: { id: string; name: string; gameKey?: string }[],
  isTest = false
): Promise<GameWinner[]> {
  noStore();

  const withGames = cocktails.filter((c) => c.gameKey);
  if (!withGames.length) return [];

  const results: GameWinner[] = [];

  for (const c of withGames) {
    const gameKey = c.gameKey!;
    const board = await getGameBoard(menuId, gameKey, null, isTest);

    if (!board.entries.length) {
      results.push({ gameKey, cocktailName: c.name, winner: null, totalPlayers: 0 });
      continue;
    }

    // Re-read the single top row to attach contact details, rather than
    // widening getGameBoard's public shape to carry emails around.
    let winner: GameWinner["winner"] = null;
    try {
      const sb = getSupabaseAdmin();
      const { data: top } = await sb
        .from("popup_game_scores")
        .select("user_id, score, created_at")
        .eq("menu_id", menuId)
        .eq("game_key", gameKey)
        .eq("is_test", isTest)
        .order("score", { ascending: false })
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (top?.user_id) {
        const { data: profile } = await sb
          .from("popup_profiles")
          .select("first_name, last_name, email")
          .eq("id", String(top.user_id))
          .maybeSingle();

        let emailVerified = false;
        try {
          const { data: authUser } = await sb.auth.admin.getUserById(String(top.user_id));
          emailVerified = Boolean(authUser?.user?.email_confirmed_at);
        } catch {
          /* treat as unverified — the panel flags it for a manual check */
        }

        winner = {
          name: [profile?.first_name, profile?.last_name].filter(Boolean).join(" ") || "Unknown",
          email: profile?.email ?? "",
          score: Number(top.score),
          achievedAt: String(top.created_at),
          emailVerified,
        };
      }
    } catch (e) {
      console.error("[popup] winner lookup failed", e);
    }

    results.push({
      gameKey,
      cocktailName: c.name,
      winner,
      totalPlayers: board.totalPlayers,
    });
  }

  return results;
}
