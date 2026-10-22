// ─── A standard 52-card deck, as plain strings ───────────────────────────────
//
// A card is rank + suit: "AS", "10H", "QD", "7C". Strings keep game state
// readable in the database and trivially JSON-safe.

export const SUITS = ["S", "H", "D", "C"] as const;
export type Suit = (typeof SUITS)[number];

export const RANKS = ["A", "2", "3", "4", "5", "6", "7", "8", "9", "10", "J", "Q", "K"] as const;
export type Rank = (typeof RANKS)[number];

export const SUIT_NAMES: Record<Suit, string> = { S: "Spades", H: "Hearts", D: "Diamonds", C: "Clubs" };
export const SUIT_SYMBOLS: Record<Suit, string> = { S: "♠", H: "♥", D: "♦", C: "♣" };

export function rankOf(card: string): Rank {
  return card.slice(0, -1) as Rank;
}

export function suitOf(card: string): Suit {
  return card.slice(-1) as Suit;
}

export function isRed(card: string): boolean {
  const s = suitOf(card);
  return s === "H" || s === "D";
}

export function newDeck(): string[] {
  return SUITS.flatMap((s) => RANKS.map((r) => `${r}${s}`));
}

/** Fisher–Yates with the game's random source. */
export function shuffle<T>(items: T[], rand: () => number): T[] {
  const a = items.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Hand order: by suit, then rank — easier to scan on a phone. */
export function sortHand(cards: string[]): string[] {
  return cards
    .slice()
    .sort((a, b) => SUITS.indexOf(suitOf(a)) - SUITS.indexOf(suitOf(b)) || RANKS.indexOf(rankOf(a)) - RANKS.indexOf(rankOf(b)));
}

/** Seeded random source for tests (mulberry32). */
export function seeded(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}
