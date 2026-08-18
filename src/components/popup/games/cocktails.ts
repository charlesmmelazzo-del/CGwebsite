// ─── The bar's book ──────────────────────────────────────────────────────────
//
// Every ingredient the game knows and every drink it can call for. Pure data
// with no React and no canvas, so the gather phase, the rhythm phase, the
// button layout and the tests all read one source rather than each keeping
// their own copy of what a Negroni is.
//
// A round picks a cocktail at random, gathers its four ingredients, plays the
// rhythm phase using ONLY those four, and finishes with that drink's own shake
// or stir. So the recipe drives everything downstream — get it wrong here and
// the player is asked to pour something that isn't in the glass.

export const INGREDIENT_KEYS = [
  // The original seven.
  "whiskey",
  "gin",
  "tequila",
  "lemon",
  "lime",
  "honey",
  "bitters",
  // Added for the full book.
  "rum",
  "vermouth",
  "liqueur",
  "aperitivo",
  "genepy",
  "absinthe",
  "sugar",
  "ice",
  "egg",
] as const;

export type IngredientKey = (typeof INGREDIENT_KEYS)[number];

/** How a drink is finished. Decides which minigame ends the round. */
export type Finish = "shake" | "stir";

export interface Cocktail {
  key: string;
  name: string;
  /** Exactly the ingredients the player must gather, then pour. */
  recipe: IngredientKey[];
  finish: Finish;
}

export const COCKTAILS: Cocktail[] = [
  { key: "tommys-margarita", name: "Tommy's Margarita", finish: "shake", recipe: ["tequila", "lime", "sugar", "ice"] },
  { key: "gimlet", name: "Gimlet", finish: "shake", recipe: ["gin", "lime", "sugar", "ice"] },
  { key: "margarita", name: "Margarita", finish: "shake", recipe: ["tequila", "lime", "liqueur", "ice"] },
  { key: "manhattan", name: "Manhattan", finish: "stir", recipe: ["whiskey", "vermouth", "bitters", "ice"] },
  { key: "old-fashioned", name: "Old Fashioned", finish: "stir", recipe: ["whiskey", "bitters", "sugar", "ice"] },
  { key: "whiskey-sour", name: "Whiskey Sour", finish: "shake", recipe: ["whiskey", "lemon", "sugar", "egg"] },
  { key: "negroni", name: "Negroni", finish: "stir", recipe: ["gin", "vermouth", "aperitivo", "ice"] },
  { key: "martini", name: "Martini", finish: "stir", recipe: ["gin", "vermouth", "bitters", "ice"] },
  { key: "last-word", name: "Last Word", finish: "shake", recipe: ["gin", "liqueur", "genepy", "lime"] },
  { key: "sazerac", name: "Sazerac", finish: "stir", recipe: ["whiskey", "bitters", "sugar", "absinthe"] },
  { key: "corpse-reviver", name: "Corpse Reviver #2", finish: "shake", recipe: ["gin", "liqueur", "lemon", "absinthe"] },
  { key: "daiquiri", name: "Daiquiri", finish: "shake", recipe: ["rum", "lime", "sugar", "ice"] },
  { key: "mai-tai", name: "Mai Tai", finish: "shake", recipe: ["rum", "liqueur", "lime", "sugar"] },
  { key: "saturn", name: "Saturn", finish: "shake", recipe: ["gin", "liqueur", "lime", "sugar"] },
];

/** Display labels. Kept beside the keys so a rename can't miss one. */
export const INGREDIENT_LABELS: Record<IngredientKey, string> = {
  whiskey: "Whiskey",
  gin: "Gin",
  tequila: "Tequila",
  lemon: "Lemon",
  lime: "Lime",
  honey: "Honey",
  bitters: "Bitters",
  rum: "Rum",
  vermouth: "Vermouth",
  liqueur: "Liqueur",
  aperitivo: "Aperitivo",
  genepy: "Genepy",
  absinthe: "Absinthe",
  sugar: "Sugar",
  ice: "Ice",
  egg: "Egg",
};

const BY_KEY = new Map(COCKTAILS.map((c) => [c.key, c]));

export function getCocktail(key: string): Cocktail | null {
  return BY_KEY.get(key) ?? null;
}

/**
 * Pick a drink at random, avoiding an immediate repeat.
 *
 * `rand` is injectable so the tests can drive this deterministically — a
 * random picker that can't be pinned down is a random picker that can't be
 * tested for the no-repeat rule.
 */
export function pickCocktail(previousKey?: string, rand: () => number = Math.random): Cocktail {
  const pool = previousKey ? COCKTAILS.filter((c) => c.key !== previousKey) : COCKTAILS;
  return pool[Math.min(pool.length - 1, Math.floor(rand() * pool.length))];
}

/** Every ingredient used by at least one drink — the gather phase's spawn pool. */
export function ingredientsInUse(): IngredientKey[] {
  const seen = new Set<IngredientKey>();
  for (const c of COCKTAILS) for (const k of c.recipe) seen.add(k);
  return INGREDIENT_KEYS.filter((k) => seen.has(k));
}
