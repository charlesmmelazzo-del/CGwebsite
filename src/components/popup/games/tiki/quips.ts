// ─── Tiki Wars — quips ───────────────────────────────────────────────────────
//
// The bubbles are drawn in code, so these pools can grow without a single new
// sprite. A guest who plays twenty runs should keep hearing new material.
//
// TO ADD MORE: append strings. Nothing else needs to change.
//
// TWO RULES, both enforced by __tests__/tiki.test.ts so a new line cannot break
// the game silently:
//
//   1. RENDERABLE CHARACTERS ONLY. These are drawn with the cabinet's bitmap
//      font, which has 54 glyphs — A-Z, 0-9 and . , ! ? ' - + = / ( ) < > * $
//      % # : — and prints anything else as a literal question mark. That means
//      straight quotes, not curly ones, and "..." rather than a single ellipsis
//      character. The owner's original text used curly apostrophes and ellipses
//      throughout; it is normalised here rather than in the renderer, so what
//      is written is exactly what appears.
//
//   2. LENGTH. A pickup or downgrade bubble is on screen for about 1.2 seconds
//      while the guest is watching the road, not the text. Keep those short.
//      Shop and boss bubbles block, so they can run longer.

/** Longest a bubble may be, by pool. See rule 2 above. */
export const QUIP_LIMITS = { pickup: 44, downgrade: 44, shop: 72, boss: 72 } as const;

export const QUIPS = {
  /** Gate pickup that HELPED. Short — the game does not pause. */
  pickup: [
    "Make it a double!",
    "New vintage",
    "On the rocks",
    "Hell yeah!",
    "Nice!",
    "Bonus!",
    "Navy Strength!",
    "Bottom's Up!",
    "High Proof!",
    "Liquid courage!",
    "Full strength!",
    "Fortified!",
    "Rum rage!",
    "Straight up!",
    "Neat!",
    "Shake it up!",
    "Order up!",
    "Somebody order shots?",
    "Goes Down Smooth",
    "Rum Fire!",
    "Cha-Ching!",
    "Daddy Like!",
    "Oh Yeah!",
    "Me Likey!",
    "Let's Go!",
    "Boozy Baby!",
    "X-Mas Came Early",
    "For me???",
    "Never Better!",
    "MMMMM Delish!",
    "That's More Like It!",
    "Love It!",
    "Bring it on!",
  ],

  /** Gate pickup that HURT. Same staging as pickup, opposite mood. */
  downgrade: [
    "Come on!",
    "No Way!",
    "Seriously??",
    "No Bueno!",
    "NOOOOO!",
    "Stop it!",
    "Get it Together!",
    "You stink at this!",
    "Ummmm Try Harder?",
    "ACK!",
    "STOP IT!",
    "I WANT MY MOMMY!",
    "NO NO NO NO!",
    "This Stinks!",
  ],

  /** The shopkeeper, on a purchase. The shop is already a pause. */
  shop: [
    "Don't Cheap Out On Me",
    "Good Choice",
    "You Gotta Deal",
    "Straight Cash Homie",
    "Jedi Tricks Don't Work On Me",
    "Leave a nice yelp review!",
    "Come back soon!",
    "Thank you for your purchase!",
    "Want a receipt with that?",
    "No refunds!",
    "You clearly have taste",
    "That's what they call me, the plug",
    "I got you",
  ],

  /** After a boss dies. The hero turns to camera and the shades drop. */
  boss: [
    "It's good to be the King baby",
    "Juiced!",
    "Cored!",
    "Sliced!",
    "Crushed!",
    "Pulped!",
    "Spiked!",
    "Crowned out!",
    "Tropical toast!",
    "Sweet dreams!",
    "Fruit punch!",
    "Bottoms up, pineapple!",
    "You're toast!",
    "Core deleted!",
    "Prickly problem solved!",
    "Pineapple down!",
    "Not so juicy now!",
    "From crown to crumb!",
    "Extra pulp, extra pain!",
    "Pina colada'd!",
    "You're the pits!",
    "Ripe for defeat!",
    "Too sweet to last!",
    "King of nothing!",
    "Tropical knockout!",
    "Juice box closed!",
    "Spiked the fruit!",
    "Aged better than you!",
    "Rum wins, fruit loses!",
    "Pour one out for the pineapple!",
    "That's how you get juiced!",
    "Your crown just got corked!",
    "Tell the king I'm coming!",
    "One less prickly problem!",
    "Should've stayed in the fruit bowl!",
    "Next time bring more fiber!",
    "You're all pulp and no punch!",
    "I drink your kind for breakfast!",
    "Consider yourself distilled!",
    "Another tropical takeover!",
    "The bottle always wins!",
    "Crown's been claimed!",
    "Sweet, sticky defeat!",
    "You're finished... and fermented!",
    "Rum bottle: 1. Pineapple: 0.",
    "Big pineapple? Bigger bottle.",
    "Crown crushed, case closed.",
    "That was... tropical.",
    "You were ripe for this.",
    "Enjoy the aftertaste.",
    "From throne to compost.",
    "Juice extracted successfully.",
    "Prickles neutralized.",
    "Core integrity: zero.",
    "Final slice served.",
    "Hasta la vista, pineapple!",
    "Consider yourself juiced!",
    "I'll be back... for the rest of your family!",
    "Come get some, fruit!",
    "Time to kick ass and chew pineapple!",
    "You're terminated, tropical!",
    "Get to the compost!",
    "Hail to the bottle, baby!",
    "Who's the king now?!",
    "That's one dead pineapple!",
    "Another one bites the pulp!",
    "I came, I saw, I juiced!",
    "You're all out of juice, amigo!",
    "This bottle just went nuclear!",
    "Pineapple? More like pine-FAIL!",
    "I eat fruit like you for breakfast!",
    "Your reign ends here, prickly!",
    "Nobody puts pineapple in the corner!",
    "I'm the last thing you'll ever taste!",
    "Bottoms up... permanently!",
    "Time to make some pineapple juice!",
    "You're about to get cored, hard!",
    "Say hello to my little bottle!",
    "I came to make pulp!",
    "Kiss my cork, fruit!",
    "You're going down smoother than rum!",
    "This is what peak performance looks like!",
    "I just turned you into a pina colada!",
    "From crown to crushed in 3 seconds!",
    "Who's laughing now, tropical trash?!",
    "Cored, baby!",
    "Get juiced!",
    "Crown's mine!",
    "You're done, fruit!",
    "Bottle wins!",
    "Next!",
    "Game over, pineapple!",
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
