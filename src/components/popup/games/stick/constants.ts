// ─── Behind the Stick — the landscape screen and the numbers that tune it ────
//
// The game is played sideways with a thumb on each side. The height is fixed
// at H logical units on every phone, so a fall speed or a hit radius means the
// same thing everywhere; the width flexes with the device between W_MIN and
// W_MAX, and anything wider or narrower is letterboxed.
//
//   ┌──────────┬──────────────────────┬──────────┐
//   │  LEFT    │        CENTRE        │  RIGHT   │
//   │  thumb   │  recipe, highway,    │  thumb   │
//   │  panel   │  feedback            │  panel   │
//   └──────────┴──────────────────────┴──────────┘

export const H = 320;
export const W_MIN = 540;
export const W_MAX = 720;
/** The shape attract mode draws at. */
export const W_REF = 640;

/** Logical width for a box of this CSS size. */
export function widthFor(cssW: number, cssH: number): number {
  if (cssW <= 0 || cssH <= 0) return W_REF;
  return Math.round(Math.min(W_MAX, Math.max(W_MIN, (H * cssW) / cssH)));
}

export interface Layout {
  w: number;
  /** Width of each thumb panel. */
  side: number;
  /** Left edge of the right panel. */
  rightX: number;
}

export function layoutFor(w: number): Layout {
  const side = Math.round(w * 0.27);
  return { w, side, rightX: w - side };
}

/** Which panel a point is in: 0 left, 1 right, or null for the centre. */
export function sideAt(l: Layout, x: number): 0 | 1 | null {
  if (x < l.side) return 0;
  if (x >= l.rightX) return 1;
  return null;
}

/** Left edge of a panel. */
export function panelX(l: Layout, side: 0 | 1): number {
  return side === 0 ? 0 : l.rightX;
}

// ─── Run ─────────────────────────────────────────────────────────────────────

export const SOLO_LIVES = 3;
export const MAX_PLAYERS = 10;
export const MIN_PARTY_PLAYERS = 2;
export const NAME_MAX = 12;
/** How long the phone is handed over for, in seconds. */
export const HANDOFF_SECONDS = 5;
/** A tap only skips the handoff after this, so the last player's thumb can't. */
export const HANDOFF_TAP_GUARD = 1;
export const OVER_SECONDS = 3;

// ─── Grab ────────────────────────────────────────────────────────────────────

/** Drawn height of a falling thing. */
export const ITEM_H = 44;
/** How close a tap has to land to a falling thing's centre. Generous: it's a thumb. */
export const TAP_RADIUS = 30;
export const PTS_GRAB = 100;
export const PTS_WRONG_BOTTLE = -50;
export const PTS_JUNK = -75;
export const PTS_VODKA = -100;
export const PTS_TIPS = 250;
export const PTS_CHERRY = 500;
export const WRONG_TIME_COST = 1;
export const JUNK_TIME_COST = 1.5;
export const WATCH_TIME = 4;
export const ICE_SECONDS = 4;
export const STINK_SECONDS = 2.5;
/** A wanted bottle is forced onto the screen if none has come for this long. */
export const NEEDED_DROUGHT = 1.6;

export function fallSpeed(level: number): number {
  return Math.min(240, 85 + 14 * (level - 1));
}

export function spawnGap(level: number): number {
  return Math.max(0.36, 0.9 - 0.06 * (level - 1));
}

/** Seconds to grab an order. Two panels on the first drink, one while shaking. */
export function grabTime(level: number, bothSides: boolean): number {
  return bothSides ? Math.max(9, 15 - 0.6 * (level - 1)) : Math.max(8, 13 - 0.5 * (level - 1));
}

// ─── Build (the highway) ─────────────────────────────────────────────────────

export const LANES = 4;
export const PERFECT_WINDOW = 0.065;
export const GOOD_WINDOW = 0.14;
export const PTS_PERFECT = 100;
export const PTS_GOOD = 60;
export const PTS_STRAY = -10;
export const COMBO_BONUS = 4;
export const COMBO_CAP = 30;
/** Below this share of notes hit, the drink is sent back. */
export const SEND_BACK_BELOW = 0.6;
export const PTS_BUILD_BONUS = 400;
/** Seconds between the build banner and the first note reaching the line. */
export const BUILD_LEAD = 0.9;

export function noteCount(level: number): number {
  return Math.min(22, 11 + level);
}

export function beatSeconds(level: number): number {
  return Math.max(0.3, 0.62 - 0.025 * (level - 1));
}

/** Seconds a note takes from the vanishing point to the line. */
export function travelTime(level: number): number {
  return Math.max(0.95, 1.7 - 0.07 * (level - 1));
}

/** Chance a note brings a partner on the other thumb, from level 3. */
export function chordChance(level: number): number {
  return level < 3 ? 0 : Math.min(0.3, 0.08 + 0.03 * (level - 3));
}

/** How many micro games interrupt a build. */
export function microCount(level: number, rand: () => number): number {
  if (level <= 1) return 0;
  if (level === 2) return rand() < 0.6 ? 1 : 0;
  if (level < 6) return 1;
  return 2;
}

// ─── Micro games ─────────────────────────────────────────────────────────────

export const MICRO_INTRO = 1.4;
export const MICRO_RESULT = 1.3;
export const MICRO_RESUME = 0.9;

export function microWin(level: number): number {
  return 600 + 50 * level;
}
export const PTS_MICRO_FAIL = -300;

// ─── Finish (shake / stir) ───────────────────────────────────────────────────

export const FINISH_SECONDS = 8;
/** Thumb travel that counts as one shake stroke. */
export const STROKE_PX = 22;
/** The frost/stir meter drains this much a second if the thumb stops. */
export const FINISH_DECAY = 0.05;
export const SERVE_HOLD = 1.1;

export function shakeStrokes(level: number): number {
  return Math.min(36, 18 + 2 * (level - 1));
}

export function stirRevs(level: number): number {
  return Math.min(8, 4 + 0.35 * (level - 1));
}

export function finishPoints(level: number): number {
  return 300 + 100 * level;
}

export function servePoints(level: number): number {
  return 250 * level;
}
