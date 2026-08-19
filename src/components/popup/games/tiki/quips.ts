// ─── Tiki Wars — quips ───────────────────────────────────────────────────────
//
// The bubbles are drawn in code, so these pools can grow to hundreds of lines
// without a single new sprite. A guest who plays twenty runs should keep hearing
// new material.
//
// TO ADD MORE: append strings. Nothing else needs to change.
//
// LENGTH MATTERS. A pickup bubble is on screen for about 1.2 seconds while the
// guest is watching the road, not the text — keep those under ~40 characters or
// they simply will not be read. Shop and boss bubbles get longer and can run to
// about 70.
//
// These are PLACEHOLDERS, written to the right shape and length so the staging
// can be tuned. The owner is writing the real ones.

export const QUIPS = {
  /** On a gate pickup. Short. The game does not pause. */
  pickup: [
    "Now we're talking.",
    "Don't mind if I do.",
    "That'll do nicely.",
    "Top shelf, baby.",
    "Shaken, not sorry.",
    "Proof I know what I'm doing.",
    "Neat.",
    "One for the road.",
    "Overproof and overqualified.",
    "This is my island now.",
    "Garnish THIS.",
    "Ice cold.",
    "Last call, fruit.",
    "Squeeze me.",
    "Extra pulp.",
  ],

  /** In the shop. Blocking already, so these can breathe. */
  shop: [
    "Aye, that'll cost ye. Everything does.",
    "Cannae take it with ye, laddie.",
    "Bought wi' blood, paid wi' coin.",
    "Ye'll thank me when yer still standing.",
    "No refunds. No exchanges. No pineapples.",
    "A wise investment, if ye survive to enjoy it.",
    "That's the good stuff. Don't waste it.",
    "Aged twelve years. Unlike yerself.",
    "Spend it or lose it, that's the way of things.",
    "I've outlived every hero who's stood there.",
  ],

  /** After a boss dies. The hero turns to camera and the shades drop. */
  boss: [
    "Consider yourself garnished.",
    "That's what I call a fruit salad.",
    "Should've stayed in the can.",
    "Squeezed dry.",
    "You picked the wrong bottle, pal.",
    "And that's why they call it overproof.",
    "Peeled, cored, and served.",
    "Somebody get a mop.",
    "Tropical? More like topical. You're finished.",
    "Save me a seat, sweetheart. I'm coming.",
  ],
} as const;

export type QuipPool = keyof typeof QUIPS;

/**
 * Shuffle-bag draw.
 *
 * Picking at random each time visibly repeats within a handful of draws — the
 * birthday problem makes a pool of fifteen feel like a pool of five, and the
 * whole point of a big pool is that it does not feel small. This walks a
 * shuffled copy and only reshuffles once every line has been used.
 */
export class QuipBag {
  private bags: Partial<Record<QuipPool, string[]>> = {};

  constructor(private rng: () => number = Math.random) {}

  draw(pool: QuipPool): string {
    let bag = this.bags[pool];
    if (!bag || bag.length === 0) {
      bag = [...QUIPS[pool]];
      for (let i = bag.length - 1; i > 0; i--) {
        const j = Math.floor(this.rng() * (i + 1));
        [bag[i], bag[j]] = [bag[j], bag[i]];
      }
      this.bags[pool] = bag;
    }
    return bag.pop() ?? "";
  }
}
