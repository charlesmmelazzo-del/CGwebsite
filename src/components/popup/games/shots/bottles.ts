// ─── Let's Do Shots! — the ten bottles ───────────────────────────────────────
//
// The cast of the whole game, and deliberately the only file that knows what a
// bottle IS. The engine matches on these ids, the stage builder draws palettes
// from them, the renderer looks up a colour here, and the art importer writes
// `bottle-<id>.png` for each — so adding an eleventh spirit is one entry plus
// one drawing, and nothing else has to be found and changed.
//
// No import of anything. This file has to stay loadable by the test runner and
// by a server route, neither of which has a canvas.

export const BOTTLE_IDS = [
  "bourbon", "gin", "tequila", "scotch", "rum",
  "chartreuse", "amaro", "aperitivo", "liqueur", "malort",
] as const;

export type BottleId = (typeof BOTTLE_IDS)[number];

/** A bottle, or the coffee cup that is not one. See CellKind in shotsCore. */
export type CellKind = BottleId | "coffee";

export function isBottle(kind: CellKind): kind is BottleId {
  return kind !== "coffee";
}

export interface BottleDef {
  id: BottleId;
  /** Shown in the HUD and the recipe strip. Font is uppercase-only. */
  label: string;
  /**
   * The bottle's signature colour, taken off the artwork.
   *
   * Every tile is backed with this and every shard thrown by a break is this
   * colour, which is the game's answer to a real problem: ten spirits is twice
   * what a match-3 board normally carries, and at 34 logical pixels a dark rum
   * and a dark bourbon are the same brown smudge in peripheral vision. The
   * backing plate is what actually gets read while scanning for a run; the
   * bottle on top of it is the detail you confirm with.
   */
  color: string;
  /** Darker partner for the plate's shadow and the tile's lower bevel. */
  shade: string;
}

/**
 * Ordered exactly as the sprite sheet is drawn, top row then bottom. Several
 * things index by position — keep this in step with BOTTLE_ORDER in
 * scripts/shots-art.mjs.
 */
export const BOTTLES: Record<BottleId, BottleDef> = {
  bourbon:    { id: "bourbon",    label: "BOURBON",    color: "#C46A18", shade: "#6E3606" },
  gin:        { id: "gin",        label: "GIN",        color: "#26B3AE", shade: "#0C5F5E" },
  tequila:    { id: "tequila",    label: "TEQUILA",    color: "#E4DCC8", shade: "#7A6A4E" },
  scotch:     { id: "scotch",     label: "SCOTCH",     color: "#E42B20", shade: "#7A0F0A" },
  rum:        { id: "rum",        label: "RUM",        color: "#2456D8", shade: "#0E2472" },
  chartreuse: { id: "chartreuse", label: "CHARTREUSE", color: "#7FC81E", shade: "#2E5C0A" },
  amaro:      { id: "amaro",      label: "AMARO",      color: "#FFC81E", shade: "#7A5A00" },
  aperitivo:  { id: "aperitivo",  label: "APERITIVO",  color: "#FF5A3C", shade: "#8A1E0C" },
  liqueur:    { id: "liqueur",    label: "LIQUEUR",    color: "#A63CD8", shade: "#4A0E6E" },
  malort:     { id: "malort",     label: "MALORT",     color: "#F2D024", shade: "#8A6A00" },
};

/** Parse a whitespace-separated recipe. Throws on a name that is not a bottle. */
export function parseBottles(spec: string): BottleId[] {
  return spec.trim().split(/\s+/).map((word) => {
    const id = word.toLowerCase() as BottleId;
    if (!(id in BOTTLES)) throw new Error(`Unknown bottle "${word}"`);
    return id;
  });
}
