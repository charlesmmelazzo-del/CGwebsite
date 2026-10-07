// ─── Cocktail Creepypastas — choosing what the Host says ─────────────────────
//
// Each pool is a shuffled deck: lines are drawn without repeats until the deck
// runs out, then it's reshuffled — never starting on the line that just ended
// the last deck. The deck is kept in localStorage per browser, so a reload
// moves on to a new line rather than repeating the first one.
//
// Call drawLine() when something HAPPENS (arriving, choosing to browse), never
// during render — the line on screen has to stay put while the guest reads it.

import { POOLS, type HostLine, type PoolKey } from "./hostDialogue";

const NS = "creepypastas:v1";

/**
 * localStorage that never throws. Private windows, blocked storage and
 * thumbnail renderers all make it fail; the pop-up must still work, it just
 * forgets between visits.
 */
export const store = {
  get<T>(key: string): T | null {
    try {
      const raw = window.localStorage.getItem(`${NS}:${key}`);
      return raw ? (JSON.parse(raw) as T) : null;
    } catch {
      return null;
    }
  },
  set(key: string, value: unknown): boolean {
    try {
      window.localStorage.setItem(`${NS}:${key}`, JSON.stringify(value));
      return true;
    } catch {
      return false;
    }
  },
};

interface Deck {
  /** Line ids still to come, next one last. */
  left: string[];
  /** The line most recently drawn. */
  last: string | null;
}

// Fallback when storage is unavailable, so lines still rotate within a visit.
const memory = new Map<string, Deck>();

function shuffle<T>(items: T[]): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Draw the next line from one or more pools, treated as a single deck. */
export function drawLine(menuId: string, ...pools: PoolKey[]): HostLine {
  const lines = pools.flatMap((p) => POOLS[p]);
  const byId = new Map(lines.map((l) => [l.id, l]));
  const key = `${menuId}:deck:${pools.join("+")}`;

  let deck = store.get<Deck>(key) ?? memory.get(key) ?? { left: [], last: null };
  // Drop ids for lines that have since been edited out of the pool.
  deck = { ...deck, left: deck.left.filter((id) => byId.has(id)) };

  if (deck.left.length === 0) {
    const fresh = shuffle(lines.map((l) => l.id));
    // The next draw is the END of the array: keep it off the last line seen.
    if (fresh.length > 1 && fresh[fresh.length - 1] === deck.last) {
      [fresh[0], fresh[fresh.length - 1]] = [fresh[fresh.length - 1], fresh[0]];
    }
    deck.left = fresh;
  }

  const id = deck.left.pop()!;
  deck.last = id;
  memory.set(key, deck);
  store.set(key, deck);
  return byId.get(id)!;
}

/** Has this browser met the Host before? */
export function hasVisited(menuId: string): boolean {
  return store.get<boolean>(`${menuId}:visited`) === true;
}

export function markVisited(menuId: string): void {
  store.set(`${menuId}:visited`, true);
}
