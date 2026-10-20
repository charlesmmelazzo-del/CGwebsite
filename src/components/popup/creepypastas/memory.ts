// ─── Cocktail Creepypastas — what the bartender remembers ────────────────────
//
// No accounts: everything lives in this browser's localStorage. A guest who
// comes back on the same phone gets a "welcome back" about their last visit,
// and their bookmark. A different phone, or cleared browser data, starts fresh
// — the owner chose that over asking people to sign in.
//
// A VISIT is one browser tab session. Reloading mid-visit doesn't count as
// coming back; returning tomorrow does. The bartender's welcome reads a
// snapshot of memory taken when the visit began, so what happens tonight
// can't leak into tonight's "last time you were here…".

import { store } from "./lineRotation";

export interface Bookmark {
  contentVersion: string;
  /** How far through, 0–1, by scroll position. */
  progress: number;
  /**
   * The paragraph at the top of the screen. Both versions of a tale have the
   * same paragraphs, so this lands in the same place in either; progress is
   * the fallback for bookmarks saved before it existed.
   */
  para?: number;
  /** The telling they were reading. */
  version?: "original" | "modern";
  at: string;
}

export interface GuestMemory {
  v: 1;
  visits: number;
  /** Cocktail ids they took a recipe for. */
  recipes: string[];
  /** Tale ids read to the end. */
  finished: string[];
  /** The most recent tale read to the end. */
  lastFinished: string | null;
  /** Unfinished tales and where they stopped. */
  bookmarks: Record<string, Bookmark>;
  /** Reader text size multiplier. */
  textScale: number;
  /** Asked to join the mailing list: and said yes, or no. */
  signup: "joined" | "declined" | null;
}

const fresh = (): GuestMemory => ({
  v: 1,
  visits: 0,
  recipes: [],
  finished: [],
  lastFinished: null,
  bookmarks: {},
  textScale: 1,
  signup: null,
});

const key = (menuId: string) => `${menuId}:memory`;

export function readMemory(menuId: string): GuestMemory {
  const m = store.get<Partial<GuestMemory>>(key(menuId));
  // Anything malformed is forgotten rather than trusted.
  if (!m || m.v !== 1) return fresh();
  const f = fresh();
  return {
    ...f,
    ...m,
    recipes: Array.isArray(m.recipes) ? m.recipes : [],
    finished: Array.isArray(m.finished) ? m.finished : [],
    bookmarks: m.bookmarks && typeof m.bookmarks === "object" ? m.bookmarks : {},
    textScale: typeof m.textScale === "number" ? m.textScale : 1,
  };
}

/** Apply a change and save it. `saved` is false when this browser can't store anything. */
export function updateMemory(
  menuId: string,
  change: (m: GuestMemory) => GuestMemory
): { memory: GuestMemory; saved: boolean } {
  const memory = change(readMemory(menuId));
  return { memory, saved: store.set(key(menuId), memory) };
}

/**
 * Start (or rejoin) this visit. Returns memory as it stood BEFORE tonight —
 * the thing the welcome is allowed to talk about.
 */
export function beginVisit(menuId: string): GuestMemory {
  const flag = `creepypastas:${menuId}:visit`;
  let rejoining = false;
  try {
    rejoining = window.sessionStorage.getItem(flag) === "1";
    window.sessionStorage.setItem(flag, "1");
  } catch {
    /* no session storage: every load is a new visit, which is harmless */
  }

  const snapKey = `${menuId}:visitSnapshot`;
  if (rejoining) {
    const snap = store.get<GuestMemory>(snapKey);
    if (snap) return snap;
  }
  const before = readMemory(menuId);
  store.set(snapKey, before);
  updateMemory(menuId, (m) => ({ ...m, visits: m.visits + 1 }));
  return before;
}

/** Their most recent unfinished tale, if any. */
export function latestBookmark(m: GuestMemory): { id: string; bookmark: Bookmark } | null {
  let best: { id: string; bookmark: Bookmark } | null = null;
  for (const [id, bookmark] of Object.entries(m.bookmarks)) {
    if (!best || bookmark.at > best.bookmark.at) best = { id, bookmark };
  }
  return best;
}

/** Wipe this pop-up's memory on this browser — the sandbox's reset button. */
export function forgetEverything(menuId: string): void {
  store.set(key(menuId), fresh());
  store.set(`${menuId}:visitSnapshot`, null);
  try {
    window.sessionStorage.removeItem(`creepypastas:${menuId}:visit`);
  } catch {
    /* nothing to clear */
  }
}
