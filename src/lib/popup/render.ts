// ─── Pop Up Zone — assembling everything a template needs ────────────────────

import { getCocktails, resolveLiveMenu } from "./menus";
import type { PopupCocktail, PopupMenu } from "./types";

export interface LoadedExperience {
  cocktails: PopupCocktail[];
  /** Is this the pop-up that's live right now? Gates game scoring. */
  isLive: boolean;
}

/**
 * Load the cocktails for a pop-up and whether it's the live one.
 *
 * Shared by the live page, the archive detail page and the sandbox so all
 * three agree on when scoring is open.
 */
export async function loadExperience(
  menu: PopupMenu,
  opts: { isSandbox?: boolean } = {}
): Promise<LoadedExperience> {
  const isSandbox = opts.isSandbox ?? false;

  const [cocktails, live] = await Promise.all([
    getCocktails(menu.id, { includeInactive: isSandbox }),
    resolveLiveMenu(),
  ]);

  // In the sandbox the pop-up is treated as live so games and scoring can be
  // exercised before launch; those scores are written with is_test.
  const isLive = isSandbox || Boolean(live && live.id === menu.id);

  return { cocktails, isLive };
}
