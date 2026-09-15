// ─── Tater Tales — the cast ──────────────────────────────────────────────────
//
// Everyone who turns up in the game, and — for the bottles waiting on the
// shelves — what they say when somebody finally hands them a mixer.
//
// The bottle and mixer ids are the CONTRACT WITH THE ART: thanks-<id>.png and
// mixer-<id>.png are cut by scripts/tater-art.mjs under exactly these names.

export const CHARACTERS = [
  "elmer",     // the hero: a bonded bourbon, nothing fancy, delicious
  "allie",     // Allie Kated: a rare bottle who dreams of being drunk
  "tater",     // Mr. Tater: the collector who never opens anything
  "mixey",     // Elmer's cola-can sidekick and engine
  "guillermo", // blanco tequila, holds the bottom shelf
  "johnny",    // scotch, older and wiser
  "alistaire", // gin
  "sodey",     // a club soda can, and a cat
] as const;
export type CharacterId = (typeof CHARACTERS)[number];

// ─── The dusty bottles ───────────────────────────────────────────────────────

/**
 * The bottles stranded up the shaft, waiting to be made into a drink.
 *
 * Land on one of these with a mixer in hand and it says thank you and goes —
 * off Tater's shelf and into somebody's glass, which is the entire point
 * Guillermo makes on the way out of the intro. Each has an animation row on
 * the sheet (rows K through Q), which is why the list is exactly seven long.
 */
export const LONELY_BOTTLES = [
  { id: "gin",        label: "GIN",        tint: "#7FD8C8" },
  { id: "tequila",    label: "TEQUILA",    tint: "#E8DFA8" },
  { id: "rum",        label: "RUM",        tint: "#C8703A" },
  { id: "scotch",     label: "SCOTCH",     tint: "#D8A038" },
  { id: "brandy",     label: "BRANDY",     tint: "#A8481E" },
  { id: "malort",     label: "MALORT",     tint: "#C8D848" },
  { id: "chartreuse", label: "CHARTREUSE", tint: "#9CE800" },
] as const;

export type BottleId = (typeof LONELY_BOTTLES)[number]["id"];
export const BOTTLE_IDS = LONELY_BOTTLES.map((b) => b.id) as BottleId[];

export function bottleById(id: BottleId) {
  const found = LONELY_BOTTLES.find((b) => b.id === id);
  if (!found) throw new Error(`unknown bottle: ${id}`);
  return found;
}

// ─── The mixers ──────────────────────────────────────────────────────────────

/**
 * The little ones. Pets to the liquor bottles, fuel to Elmer.
 *
 * Three kinds purely so the shelves are not all carrying the same picture —
 * mechanically they are identical, and deliberately so. A player deciding
 * whether a shelf is worth the blast should be reading the DISTANCE, not
 * working out whether tonic is better than cola.
 */
export const MIXERS = [
  { id: "cola",       label: "COLA",       tint: "#D8281C" },
  { id: "gingerbeer", label: "GINGER",     tint: "#E0A030" },
  { id: "tonic",      label: "TONIC",      tint: "#B8E8F0" },
] as const;
export type MixerId = (typeof MIXERS)[number]["id"];
export const MIXER_IDS = MIXERS.map((m) => m.id) as MixerId[];

// ─── What they say ───────────────────────────────────────────────────────────
//
// Every line in the game is drawn with the 5x7 font in arcade.ts, which has no
// lowercase and no punctuation beyond a small set. The test checks every string
// here against it — a curly apostrophe arriving from an autocorrect renders as
// a question mark, the game does not error, and a guest reads THANK YOU?

/** A bottle being handed its mixer. Picked at random so the shaft is not a chant. */
export const THANK_YOU: string[] = [
  "THANK YOU!",
  "AT LAST!",
  "FINALLY!",
  "BLESS YOU!",
  "IM FREE!",
  "SOMEBODY DRINK ME!",
];

/** Guillermo, holding the bottom shelf so you always know where the floor is. */
export const GUILLERMO_LINE = "GOOD LUCK!";

/** Allie, when her shelf comes into view. */
export const ALLIE_LINE = "HELP ME!";

/** Mr. Tater, taking her away again. */
export const TATER_LINE = "YOU DON'T BELONG WITH THIS BOTTOM SHELF RIFF RAFF!";

/** Mixey, out of fizz. The end of the run. */
export const FLAT_LINE = "MIXEY IS FLAT";

// ─── The summit ──────────────────────────────────────────────────────────────

/** Tater, waiting on his top shelf with Allie. Lap one. */
export const TATER_TAUNT = "HA! NO BOTTOM SHELF BOTTLE IS TAKING HER OFF MY TOP SHELF!";

/** Tater, alone on his top shelf. Every lap after the first. */
export const TATER_TAUNT_AGAIN = "YOU AGAIN?! MY BOTTLES STAY ON MY SHELF!";

/** Tater, soaked, going over the edge. */
export const TATER_SOAKED = "MY SHIRT!!";

/**
 * Tater at the top of each world, in ladder order: the bottom shelf, the sky,
 * space, the moon, deeper space, Mars, deep space, Pluto, the long dark, the
 * alien ship, the far side. Heaven's top is the summit, which has its own lines.
 */
export const SHOWDOWN_TAUNTS: string[] = [
  "GET BACK ON THE BOTTOM SHELF WHERE YOU BELONG!",
  "THE SKY'S THE LIMIT... FOR ME, NOT YOU!",
  "IN SPACE, NOBODY CAN HEAR YOU FIZZ!",
  "ONE SMALL STEP FOR A POTATO. NO STEPS FOR YOU!",
  "STILL CLIMBING? HOW VERY BOTTOM SHELF.",
  "MARS IS MY WINE CELLAR, RIFF RAFF!",
  "BONDED BUT ONLY 4 YEAR? BARELY A DRAIN POUR!",
  "COLD UP HERE, ISN'T IT? STAY ON ICE!",
  "NOBODY DRINKS THE GOOD STUFF. IT'S FOR COLLECTING!",
  "EVEN THE ALIENS KNOW NOT TO TOUCH MY BOTTLES!",
  "HEAVEN IS FOR ALLOCATED BOTTLES ONLY!",
];

/** Soaked at a world's top, before he leaps away. */
export const SHOWDOWN_HIT = "ARGH! SODA! ON MY BOURBON SHIRT!";

/** Getting away up the shelves. Lap one he still has Allie. */
export const SHOWDOWN_ESCAPE = "YOU'LL NEVER GET HER BACK!";
export const SHOWDOWN_ESCAPE_AGAIN = "SEE YOU AT THE NEXT SHELF!";

/** Allie, back on the bottom shelf after the rescue. From the design. */
export const ALLIE_KEEP_GOING = "KEEP GOING! SEE IF YOU CAN REACH TATER AGAIN AND TAKE HIM ON!";

/** Allie, cheering Elmer off on every lap after that. */
export const ALLIE_AGAIN = "YOU DID IT AGAIN! HE'S BACK UP THERE. GO GET HIM!";

/**
 * The rare bottle freed from Tater's cabinet at the top of each lap after the
 * first, in order, repeating. Guillermo is left out: he is standing at the
 * bottom the whole time, and seeing him at the top too would read as a bug.
 */
export const SUMMIT_BOTTLES: BottleId[] = ["gin", "scotch", "rum", "brandy", "malort", "chartreuse"];

export function summitBottleFor(lap: number): BottleId | null {
  return lap >= 2 ? SUMMIT_BOTTLES[(lap - 2) % SUMMIT_BOTTLES.length] : null;
}
