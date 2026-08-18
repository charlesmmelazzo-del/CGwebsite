// ─── Ingredient sprites and colours ──────────────────────────────────────────
//
// Every ingredient the bar stocks, as an 11x15 sprite with its own palette.
//
// Pure and free of React so the tests can import it — the rule below is worth
// guarding automatically and can't be checked from a component.
//
// THE RULE: colour alone isn't enough to read a note at speed on a phone, and
// neither is shape. Each ingredient needs both, and crucially NO TWO
// INGREDIENTS IN THE SAME RECIPE MAY SHARE A SILHOUETTE — a Negroni asks for
// vermouth and aperitivo together, and if both were the same bottle outline in
// slightly different reds the player would be guessing. There are more
// ingredients than plausible bottle shapes, so silhouettes are reused across
// the book, just never within one drink. gather.test.ts enforces it.

import type { Sprite } from "./arcade";
import { P } from "./arcade";
import type { IngredientKey } from "./cocktails";
import { INGREDIENT_LABELS } from "./cocktails";

// ─── Silhouettes ─────────────────────────────────────────────────────────────
// Key legend: c cap · g glass · l label · b base · plus per-shape extras.

/** The standard spirit bottle. Short neck, square shoulders. */
export const BOTTLE: Sprite = [
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "....ggg....",
  "...ggggg...",
  "..ggggggg..",
  "..ggggggg..",
  "..glllllg..",
  "..glllllg..",
  "..glllllg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..bbbbbbb..",
];

/** A cut citrus wheel. */
export const CITRUS: Sprite = [
  "...........",
  "...fffff...",
  "..fffffff..",
  ".fffffffff.",
  ".ffffwffff.",
  "ffffwwwffff",
  "fffwwwwwfff",
  "ffwwwwwwwff",
  "fffwwwwwfff",
  "ffffwwwffff",
  ".ffffwffff.",
  ".fffffffff.",
  "..fffffff..",
  "...fffff...",
  "...........",
];

/** A lidded jar, for honey. */
export const JAR: Sprite = [
  "...ddd.....",
  "....d......",
  "....d......",
  "..hhhhhhh..",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  "..hhhhhhh..",
  "..bbbbbbb..",
  "...........",
];

/** The narrow dasher bottle bitters come in. */
export const DASHER: Sprite = [
  "...........",
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "...ggggg...",
  "...ggggg...",
  "...glllg...",
  "...glllg...",
  "...glllg...",
  "...ggggg...",
  "...ggggg...",
  "...ggggg...",
  "...bbbbb...",
  "...........",
  "...........",
];

/** Wide and low — the fortified-wine shape. */
export const SQUAT: Sprite = [
  "...........",
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "...ggggg...",
  "..ggggggg..",
  ".ggggggggg.",
  ".ggggggggg.",
  ".gglllllgg.",
  ".gglllllgg.",
  ".ggggggggg.",
  ".ggggggggg.",
  ".ggggggggg.",
  ".bbbbbbbbb.",
  "...........",
];

/** Bulbous body under a narrow neck. */
export const FLASK: Sprite = [
  "...........",
  "....ccc....",
  "....ggg....",
  "....ggg....",
  "....ggg....",
  "...ggggg...",
  "..ggggggg..",
  ".ggggggggg.",
  ".gglllllgg.",
  ".gglllllgg.",
  ".ggggggggg.",
  ".ggggggggg.",
  "..ggggggg..",
  "..bbbbbbb..",
  "...........",
];

/** A long neck over a small body — the liqueur shape. */
export const LONGNECK: Sprite = [
  "....ccc....",
  "....ggg....",
  "....ggg....",
  "....ggg....",
  "....ggg....",
  "....ggg....",
  "...ggggg...",
  "..ggggggg..",
  "..glllllg..",
  "..glllllg..",
  "..glllllg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..bbbbbbb..",
];

/** An ice cube, drawn with a lit top face so it reads as a solid. */
export const CUBE: Sprite = [
  "...........",
  "...ttttt...",
  "..ttttttt..",
  ".ttttttttt.",
  ".iiiiiiiii.",
  ".iiwwiiiii.",
  ".iiwwiiiii.",
  ".iiiiiiiii.",
  ".iiiiiiiii.",
  ".iiiiiiiii.",
  ".iiiiiiiii.",
  ".iiiiiiiii.",
  ".iiiiiiiii.",
  "...........",
  "...........",
];

/** A tied sack, for sugar. */
export const SACK: Sprite = [
  "...........",
  "....sss....",
  "...s...s...",
  "..sssssss..",
  ".sssssssss.",
  ".sssssssss.",
  ".sssssssss.",
  ".ssswwwsss.",
  ".sssssssss.",
  ".sssssssss.",
  ".sssssssss.",
  ".sssssssss.",
  "..sssssss..",
  "...........",
  "...........",
];

/** An egg. The only ingredient with no straight edges anywhere. */
export const EGG_SPRITE: Sprite = [
  "...........",
  "....eee....",
  "...eeeee...",
  "..eeeeeee..",
  "..eeeeeee..",
  ".eeeeeeeee.",
  ".eeeeeeeee.",
  ".eewweeeee.",
  ".eeeeeeeee.",
  ".eeeeeeeee.",
  ".eeeeeeeee.",
  "..eeeeeee..",
  "..eeeeeee..",
  "...eeeee...",
  "...........",
];

// ─── The stock ───────────────────────────────────────────────────────────────

export interface Ingredient {
  key: IngredientKey;
  label: string;
  /** The colour its note and its button carry. */
  color: string;
  sprite: Sprite;
  colors: Record<string, string>;
  /** Named so the silhouette rule can be checked without comparing arrays. */
  shape: string;
}

const ing = (
  key: IngredientKey,
  color: string,
  shape: string,
  sprite: Sprite,
  colors: Record<string, string>
): Ingredient => ({ key, label: INGREDIENT_LABELS[key], color, sprite, colors, shape });

export const INGREDIENTS: Ingredient[] = [
  ing("whiskey", P.amber, "bottle", BOTTLE, { c: P.yellow, g: P.amber, l: P.bone, b: P.brown }),
  ing("gin", P.cyan, "bottle", BOTTLE, { c: P.white, g: P.cyan, l: P.white, b: P.teal }),
  ing("tequila", P.bone, "bottle", BOTTLE, { c: P.grey, g: P.bone, l: P.lime, b: P.grey }),
  ing("rum", P.brown, "bottle", BOTTLE, { c: P.tan, g: P.brown, l: P.bone, b: "#4A2408" }),

  ing("lemon", P.yellow, "citrus", CITRUS, { f: P.yellow, w: P.bone }),
  ing("lime", P.green, "citrus", CITRUS, { f: P.green, w: P.lime }),

  ing("honey", P.orange, "jar", JAR, { d: P.tan, h: P.orange, b: P.brown }),
  ing("bitters", P.red, "dasher", DASHER, { c: P.bone, g: P.red, l: P.bone, b: P.crimson }),

  // Squat: vermouth and genepy. Never called for in the same drink.
  ing("vermouth", "#8A2A3A", "squat", SQUAT, {
    c: P.tan, g: "#8A2A3A", l: P.bone, b: "#4A1018",
  }),
  ing("genepy", P.lime, "squat", SQUAT, { c: P.bone, g: P.lime, l: P.white, b: P.forest }),

  // Flask: aperitivo and absinthe. Never called for in the same drink.
  ing("aperitivo", P.orange, "flask", FLASK, {
    c: P.bone, g: P.orange, l: P.white, b: "#8A3F00",
  }),
  ing("absinthe", P.forest, "flask", FLASK, { c: P.tan, g: P.forest, l: P.lime, b: "#003A12" }),

  ing("liqueur", P.purple, "longneck", LONGNECK, {
    c: P.yellow, g: P.purple, l: P.bone, b: "#3A0A5A",
  }),

  ing("ice", P.cyan, "cube", CUBE, { t: P.white, i: "#9CD8E8", w: P.white }),
  ing("sugar", P.white, "sack", SACK, { s: P.bone, w: P.white }),
  ing("egg", P.tan, "egg", EGG_SPRITE, { e: P.bone, w: P.white }),
];

/**
 * Keyed by plain string, not IngredientKey. The core's note stream carries
 * strings — `pickIngredient` is injectable so the tests can force a note — and
 * a Map typed to the union would reject every lookup from the draw code.
 */
export const ING_BY_KEY: Map<string, Ingredient> = new Map(
  INGREDIENTS.map((i) => [i.key as string, i])
);

export function ingredient(key: IngredientKey): Ingredient {
  const found = ING_BY_KEY.get(key);
  if (!found) throw new Error(`No ingredient defined for "${key}"`);
  return found;
}

export const colorFor = (key: string): string =>
  ING_BY_KEY.get(key as IngredientKey)?.color ?? P.white;
