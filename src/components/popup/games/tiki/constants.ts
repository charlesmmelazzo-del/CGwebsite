// ─── Tiki Wars — field geometry ──────────────────────────────────────────────
//
// Tiki Wars does NOT share the 224x288 grid the other two games draw into. It
// is the showpiece of the cabinet: higher resolution, full-bleed, 90s console
// sprite art rather than string art. Everything here is deliberately separate
// from arcade.ts so that changing it cannot disturb Behind the Stick or Top
// Shelf.
//
// See docs/tiki-wars.md for the design this implements.

/**
 * Logical width, FIXED.
 *
 * Every distance, hitbox and lane position in this game is written in these
 * units, so the width has to mean the same thing on every device or the game
 * is subtly different on a tall phone than a short one.
 */
export const W = 270;

/**
 * Logical height, FLEXIBLE.
 *
 * Phones are not one shape — a 9:16 tablet-ish screen and a 9:20.5 modern phone
 * both want to be filled edge to edge. Rather than letterbox (black bars in a
 * game that is meant to be immersive) or stretch (a distorted picture), the
 * height flexes and the difference goes into SKY.
 *
 * The play field itself never changes size: the horizon sits a fixed distance
 * above the player, so gameplay is identical everywhere and only the amount of
 * air above it varies. That is why the background art has to carry generous
 * empty sky and tile vertically.
 */
export const H_MIN = 480;
export const H_MAX = 620;
export const H_REF = 540;

/** Clamp a viewport aspect into a logical height. */
export function heightFor(viewportW: number, viewportH: number): number {
  if (viewportW <= 0 || viewportH <= 0) return H_REF;
  return Math.round(Math.min(H_MAX, Math.max(H_MIN, (viewportH / viewportW) * W)));
}

/**
 * Device pixels per logical pixel in the backing buffer.
 *
 * At 2 the buffer is 540 wide. On a phone that is roughly 390 CSS px across,
 * one logical pixel lands on about 1.4 CSS pixels — visibly chunky, which is
 * the intent, while still leaving the sprites enough resolution to carry the
 * Metal Slug style. Going higher stops reading as pixel art; going lower loses
 * the detail the art is being drawn for.
 */
export const PIXEL_SCALE = 2;

// ─── The field ───────────────────────────────────────────────────────────────

/** Distance from the player's feet to the horizon, in logical pixels. */
export const FIELD_DEPTH_PX = 250;

/** Where the player stands, measured UP from the bottom edge. */
export const PLAYER_FROM_BOTTOM = 110;

export function playerY(h: number): number {
  return h - PLAYER_FROM_BOTTOM;
}

export function horizonY(h: number): number {
  return playerY(h) - FIELD_DEPTH_PX;
}

/**
 * Half-width of the road at the player. The horizon width falls out of the
 * perspective divide below.
 *
 * NEAR is deliberately less than W/2: at full deflection the hero's centre sits
 * at W/2 - ROAD_HALF_NEAR, and the sprite is about 35 logical px wide, so a
 * wider road would clip him against the edge of the screen exactly when the
 * guest is dodging hardest.
 */
export const ROAD_HALF_NEAR = 110;

// ─── Depth ───────────────────────────────────────────────────────────────────
//
// Every actor carries a depth `z`: 1 at the horizon, 0 at the player's feet.
// Screen position and size both derive from it, through a real perspective
// divide rather than a hand-rolled curve.
//
// Why it matters: an eased polynomial (z squared, say) crushes the NEAR field —
// the last third of the approach ends up occupying a couple of dozen pixels,
// so an enemy hangs in the distance and then teleports through exactly the band
// where the guest has to decide whether to shoot it or dodge it. A 1/d divide
// distributes the field the way an eye actually would: close things are large
// and well separated, distant things bunch up at the horizon.

/** Camera distance at the player's feet, and at the horizon. */
export const NEAR = 1;
export const FAR = 5;

function clamp01(v: number): number {
  return v < 0 ? 0 : v > 1 ? 1 : v;
}

/** Camera-space distance for a depth. */
function distance(z: number): number {
  return NEAR + clamp01(z) * (FAR - NEAR);
}

/**
 * How far toward the horizon a depth sits, 0 at the player and 1 at the horizon.
 *
 * The reciprocals are what make this perspective rather than interpolation.
 */
export function ease(z: number): number {
  const d = distance(z);
  return (1 / NEAR - 1 / d) / (1 / NEAR - 1 / FAR);
}

/** Screen y for a depth. z=1 is the horizon, z=0 the player's feet. */
export function projectY(z: number, h: number): number {
  const hy = horizonY(h);
  const py = playerY(h);
  return py + (hy - py) * ease(z);
}

/**
 * Sprite scale for a depth.
 *
 * Straight 1/d, so a sprite's feet stay planted on the ground plane as it
 * approaches. If this used a different curve from projectY, actors would
 * visibly skate or sink as they came at you.
 */
export function projectScale(z: number): number {
  return NEAR / distance(z);
}

/** Half-width of the road at a depth, for placing scenery and clamping actors. */
export function roadHalf(z: number): number {
  return ROAD_HALF_NEAR * projectScale(z);
}

/**
 * Screen x for an actor.
 *
 * Actors store x as a normalised -1..+1 across the road rather than in pixels,
 * so "directly in front of me" is true at every distance. Without this, an
 * enemy lined up at the horizon would drift off-target as it approached.
 */
export function projectX(nx: number, z: number): number {
  return W / 2 + nx * roadHalf(z);
}

// ─── Palette ─────────────────────────────────────────────────────────────────
//
// Warmer and broader than the arcade palette in arcade.ts — that one is
// deliberately restricted to what a 1981 board could put on screen, and this
// game is imitating hardware fifteen years newer.

export const C = {
  black: "#0A0A12",
  outline: "#141018",
  white: "#FFFFFF",
  bone: "#F4ECD8",

  // Sky and sea
  skyHigh: "#1FA8C8",
  skyLow: "#FFD98A",
  sun: "#FFE24A",
  sea: "#1C86A8",
  seaFoam: "#BFEFF5",

  // Ground
  sand: "#E8C87A",
  sandDark: "#C9A455",
  sandLight: "#F6E2A8",

  // Cast
  rumGlass: "#DCE4E6",
  rumLabel: "#F2D024",
  rumGreen: "#1E9A3C",
  lime: "#8CD32B",
  lemon: "#F5DE2E",
  orange: "#FF8A1E",
  kiwi: "#9AD64A",
  kiwiSkin: "#8A6A3A",
  cane: "#CFE08A",
  caneDark: "#9BB055",
  pineapple: "#F2B01E",
  pineappleLeaf: "#2FA84A",

  // Feedback
  hp: "#E4342A",
  hpBack: "#4A1210",
  armor: "#4FC3F7",
  armorBack: "#12384A",
  money: "#4CD964",
  danger: "#FF3B30",
  flame: "#FF6A00",
  flameHot: "#FFD028",
  shadow: "rgba(0,0,0,0.32)",
} as const;
