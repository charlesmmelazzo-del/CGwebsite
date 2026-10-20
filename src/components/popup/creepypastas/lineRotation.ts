// ─── Cocktail Creepypastas — rotating the bartender's lines ──────────────────
//
// Each moment has several alternative lines. They're dealt like a shuffled
// deck: no repeats until the deck runs out, then a reshuffle that never starts
// on the line that just ended the last one. The deck is kept in localStorage,
// so a reload or a return visit moves on to a new line.
//
// Draw a line when something HAPPENS (arriving, choosing), never during render:
// the line on screen has to stay put while the guest reads it.

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
  /** Ids still to come, next one last. */
  left: string[];
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

/** Draw the next of `options` for the moment called `deckName`. */
export function drawFrom<T extends { id: string }>(menuId: string, deckName: string, options: T[]): T {
  if (options.length === 0) throw new Error(`No lines for ${deckName}`);
  const byId = new Map(options.map((o) => [o.id, o]));
  const k = `${menuId}:deck:${deckName}`;

  let deck = store.get<Deck>(k) ?? memory.get(k) ?? { left: [], last: null };
  // Lines since edited out of the pool are dropped.
  deck = { ...deck, left: deck.left.filter((id) => byId.has(id)) };

  if (deck.left.length === 0) {
    const fresh = shuffle(options.map((o) => o.id));
    // The next draw is the END of the array: keep it off the last line seen.
    if (fresh.length > 1 && fresh[fresh.length - 1] === deck.last) {
      [fresh[0], fresh[fresh.length - 1]] = [fresh[fresh.length - 1], fresh[0]];
    }
    deck.left = fresh;
  }

  const id = deck.left.pop()!;
  deck.last = id;
  memory.set(k, deck);
  store.set(k, deck);
  return byId.get(id)!;
}
