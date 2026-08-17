// ─── Pop Up Zone — assembling everything a template needs ────────────────────

import { getCocktails, resolveLiveMenu } from "./menus";
import { getBallot, getLeaderboard } from "./voting";
import { voteBlockReason } from "./access";
import type {
  LeaderboardEntry,
  PopupCocktail,
  PopupMenu,
  PopupViewer,
  PopupVote,
  VoteBlockReason,
} from "./types";

export interface LoadedExperience {
  cocktails: PopupCocktail[];
  votingOpen: boolean;
  /** Is this the pop-up that's live right now? Gates game scoring. */
  isLive: boolean;
  voteBlockReason: VoteBlockReason | null;
  ballot: PopupVote[];
  results: LeaderboardEntry[];
}

/**
 * Load the cocktails, ballot and standings for a pop-up.
 *
 * Shared by the live page, the archive detail page and the sandbox so all
 * three agree on when voting is open — one place decides, rather than three
 * pages each making their own call and eventually drifting apart.
 */
export async function loadExperience(
  menu: PopupMenu,
  viewer: PopupViewer | null,
  opts: { isSandbox?: boolean } = {}
): Promise<LoadedExperience> {
  const isSandbox = opts.isSandbox ?? false;

  const [cocktails, live] = await Promise.all([
    getCocktails(menu.id, { includeInactive: isSandbox }),
    resolveLiveMenu(),
  ]);

  // In the sandbox we bypass the live-menu and verification checks so the
  // owner can exercise voting on an unpublished pop-up — but they still have
  // to be signed in as a guest, because a vote needs a user to attach to.
  const reason: VoteBlockReason | null = isSandbox
    ? viewer
      ? menu.votingEnabled
        ? null
        : "voting_closed"
      : "not_signed_in"
    : voteBlockReason(viewer, menu, live?.id ?? null);

  const [ballot, results] = await Promise.all([
    viewer ? getBallot(menu.id, viewer.userId, isSandbox) : Promise.resolve([] as PopupVote[]),
    getLeaderboard(menu, cocktails, isSandbox),
  ]);

  // In the sandbox the pop-up is treated as live so games and scoring can be
  // exercised before launch; those scores are written with is_test.
  const isLive = isSandbox || Boolean(live && live.id === menu.id);

  return {
    cocktails,
    votingOpen: reason === null,
    isLive,
    voteBlockReason: reason,
    ballot,
    results,
  };
}
