/**
 * File 10: comments on the bar's curated content, "Choose your perfect flight" and brackets. Plain helpers shared by the
 * pages, the API routes and the tests (no server-only code, no React). Nothing here adds a number the Bible didn't send:
 * members get their own pick, a winner and (only when the bar ticked it, after voting ends) a whole-percent share.
 */
import type { Bracket, CommentType, VoteCard } from "./types";

export const PG_LINE = "Please keep it PG and respectful.";
export const COMMENT_MAX = 500;
export const REMOVED_LINE = "Removed by Common Good";
export const DELETED_LINE = "Deleted by its author.";
export const COMMENT_TYPES: readonly CommentType[] = ["list", "message", "event", "flight", "bracket"];
export const isCommentType = (v: unknown): v is CommentType => typeof v === "string" && (COMMENT_TYPES as readonly string[]).includes(v);

const posInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
};

/** Where a curated item lives in the app (comments, Inbox notices). Only ever inside Passport. */
export function itemHref(kind: CommentType | string, id: unknown): string | null {
  const n = posInt(id);
  if (!n) return null;
  switch (kind) {
    case "list": return `/passport/house/${n}`;
    case "message": return `/passport/from-the-bar/${n}`;
    case "event": return `/passport/events/${n}`;
    case "flight": return `/passport/votes/${n}`;
    case "bracket": return `/passport/brackets/${n}`;
    default: return null;
  }
}
export const voteHref = (c: Pick<VoteCard, "kind" | "id">) => itemHref(c.kind, c.id) || "/passport";
export const PAST_VOTES_HREF = "/passport/votes/past";

/** A comment or reply the website will pass on: plain text the Bible checks again, and a reply's parent number. */
export function commentBody(b: Record<string, unknown>): { body: { body: string; parent_id?: number } } | { error: string } {
  const text = typeof b.body === "string" ? b.body.trim() : "";
  if (!text) return { error: "Write your comment first" };
  if (text.length > COMMENT_MAX) return { error: `Keep your comment to ${COMMENT_MAX} characters` };
  const out: { body: string; parent_id?: number } = { body: text };
  if (b.parent_id !== undefined && b.parent_id !== null) {
    const p = posInt(b.parent_id);
    if (!p) return { error: "Not found" };
    out.parent_id = p;
  }
  return { body: out };
}
/** A flight vote: one slot and one of its options (numbers the Bible sent). */
export function flightVoteBody(b: Record<string, unknown>): { body: { slot_id: number; option_id: number } } | { error: string } {
  const slot = posInt(b.slot_id);
  const option = posInt(b.option_id);
  return slot && option ? { body: { slot_id: slot, option_id: option } } : { error: "Choose one of the bottles" };
}
/** A bracket vote: one matchup, and "a" or "b". */
export function bracketVoteBody(b: Record<string, unknown>): { body: { matchup_id: number; pick: "a" | "b" } } | { error: string } {
  const m = posInt(b.matchup_id);
  return m && (b.pick === "a" || b.pick === "b") ? { body: { matchup_id: m, pick: b.pick } } : { error: "Choose one of the two" };
}

/** "67%", or nothing when the bar didn't share percentages. */
export const pctLabel = (n: number | null | undefined) => (typeof n === "number" && Number.isFinite(n) ? `${n}%` : null);
/** Whether the member's own comment can still be changed (the Bible decides; this only hides the button in time). */
export const canStillEdit = (editUntil: string | null | undefined, now = Date.now()) => !!editUntil && Date.parse(editUntil) > now;
/** Which round the bracket opens on, sideways: the current one, or the final once it is decided. */
export function startRound(b: Pick<Bracket, "rounds" | "current_round" | "status">): number {
  if (!b.rounds.length) return 0;
  if (b.current_round > 0) return Math.min(b.current_round, b.rounds.length) - 1;
  return 0;
}
/** "Voting is open" first, then results (Home). */
export const voteKicker = (c: Pick<VoteCard, "kind" | "status">) => (c.status === "open" ? (c.kind === "bracket" ? "Bracket · voting is open" : "Voting is open") : c.kind === "bracket" ? "We have a winner" : "The results are in");
