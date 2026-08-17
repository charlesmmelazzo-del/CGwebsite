// ─── Pop Up Zone — who may vote, and how often ───────────────────────────────

import type { NextRequest } from "next/server";
import type { PopupMenu, PopupViewer, VoteBlockReason } from "./types";

/**
 * Why this guest can't vote on this pop-up right now, or null if they can.
 *
 * Shared by the page (to show the right prompt) and the vote API route (to
 * actually refuse). The API is the enforcement point; the UI just reads the
 * same answer so the two never disagree.
 */
export function voteBlockReason(
  viewer: PopupViewer | null,
  menu: PopupMenu,
  liveMenuId: string | null
): VoteBlockReason | null {
  // Voting is only ever open on the pop-up that is currently live.
  if (!menu.votingEnabled || menu.id !== liveMenuId) return "voting_closed";
  if (!viewer) return "not_signed_in";
  if (!viewer.emailVerified) return "email_unverified";
  if (!viewer.ageVerified) return "age_unverified";
  return null;
}

export const VOTE_BLOCK_MESSAGE: Record<VoteBlockReason, string> = {
  not_signed_in: "Sign in to cast your vote.",
  email_unverified: "Confirm your email address to cast your vote.",
  age_unverified: "We couldn't verify your age. Update your profile to vote.",
  voting_closed: "Voting is closed for this pop-up.",
};

// ─── Rate limiting ───────────────────────────────────────────────────────────
// Same in-memory approach as the admin login route: resets on restart, which is
// fine for this threat model (slowing down scripted abuse, not hard security —
// the real vote integrity guarantees are the DB unique indexes and the
// verified-email requirement).

const buckets = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  max: number,
  windowMs: number
): { blocked: boolean; retryAfterSec: number } {
  const now = Date.now();
  const entry = buckets.get(key);

  if (!entry || now > entry.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { blocked: false, retryAfterSec: 0 };
  }
  if (entry.count >= max) {
    return { blocked: true, retryAfterSec: Math.ceil((entry.resetAt - now) / 1000) };
  }
  entry.count++;
  return { blocked: false, retryAfterSec: 0 };
}

export function getIp(req: NextRequest): string {
  return (
    req.headers.get("x-forwarded-for")?.split(",")[0].trim() ??
    req.headers.get("x-real-ip") ??
    "unknown"
  );
}
