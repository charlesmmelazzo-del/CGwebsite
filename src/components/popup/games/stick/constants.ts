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

// ─── Instruction beats ───────────────────────────────────────────────────────
//
// Every new thing the player is asked to do gets a card first, and nothing
// moves while it's up. The chaos is doing two things at once; being dropped
// into one without knowing what it is only reads as unfair.

/** "Grab the colour bottles! Avoid the rest!" at the start of a fresh order. */
export const GRAB_CARD = 2.2;
/** "Keep shaking! Order up..." when the left thumb joins in. */
export const GRAB_CARD_LEFT = 2.6;
/** After a timed-out grab, or a new bartender picking up a grab mid-way. */
export const GRAB_CARD_SHORT = 1.6;
/** "We got our bottles. Let's build the drink!" */
export const BUILD_CARD = 2.8;
/** "Shake it! Drag up and down." */
export const FINISH_CARD = 2;

// ─── Grab ────────────────────────────────────────────────────────────────────

/** Drawn height of a flying thing. */
export const ITEM_H = 46;
/** How close a tap has to land to a thing's centre. Generous: it's a thumb. */
export const TAP_RADIUS = 32;
export const PTS_GRAB = 100;
export const PTS_WRONG_BOTTLE = -50;
export const PTS_JUNK = -75;
export const PTS_VODKA = -100;
export const WRONG_TIME_COST = 1;
export const JUNK_TIME_COST = 1.5;
export const STINK_SECONDS = 2.5;
/** A wanted bottle is forced up if none has come for this long. */
export const NEEDED_DROUGHT = 1.8;

/**
 * Things are tossed up from below the panel and fall back, Fruit Ninja style.
 * Gravity sets the pace: a low one hangs each toss in the air for longer.
 */
export function gravity(level: number): number {
  return Math.min(460, 250 + 16 * (level - 1));
}

export function spawnGap(level: number): number {
  return Math.max(0.5, 1.05 - 0.04 * (level - 1));
}

/** Seconds to grab an order, counted once its card has gone. */
export function grabTime(level: number, bothSides: boolean): number {
  return bothSides ? Math.max(11, 16 - 0.4 * (level - 1)) : Math.max(10, 15 - 0.4 * (level - 1));
}

// ─── Build (the highway) ─────────────────────────────────────────────────────

export const LANES = 4;
export const PERFECT_WINDOW = 0.07;
export const GOOD_WINDOW = 0.15;
export const PTS_PERFECT = 100;
export const PTS_GOOD = 60;
export const PTS_STRAY = -10;
export const COMBO_BONUS = 4;
export const COMBO_CAP = 30;
/** Below this share of notes hit, the drink is sent back. */
export const SEND_BACK_BELOW = 0.6;
export const PTS_BUILD_BONUS = 400;
/** Seconds between the card leaving and the first note reaching the line. */
export const BUILD_LEAD = 0.6;

export function noteCount(level: number): number {
  return Math.min(18, 9 + level);
}

export function beatSeconds(level: number): number {
  return Math.max(0.42, 0.72 - 0.02 * (level - 1));
}

/** Seconds a bottle takes to slide from the far end of the bar to the tap zone. */
export function travelTime(level: number): number {
  return Math.max(1.3, 2.2 - 0.06 * (level - 1));
}

/** Chance a note brings a partner on the other thumb, from level 4. */
export function chordChance(level: number): number {
  return level < 4 ? 0 : Math.min(0.25, 0.06 + 0.03 * (level - 4));
}

/** How many micro games interrupt a build. */
export function microCount(level: number, rand: () => number): number {
  if (level <= 1) return 0;
  if (level === 2) return rand() < 0.6 ? 1 : 0;
  if (level < 7) return 1;
  return 2;
}

// ─── Micro games ─────────────────────────────────────────────────────────────

export const MICRO_INTRO = 1.8;
export const MICRO_RESULT = 1.4;
export const MICRO_RESUME = 1.1;

export function microWin(level: number): number {
  return 600 + 50 * level;
}
export const PTS_MICRO_FAIL = -300;

// ─── Finish (shake / stir) ───────────────────────────────────────────────────
//
// A shake is timed, not counted: keep the tin going above the line until the
// clock runs out. That's what lets it overlap the next grab — a drink that
// finished the moment the meter filled would be done before the left thumb
// ever started.

/** Seconds of shaking or stirring after the card. */
export const FINISH_PLAY = 9.5;
/** Seconds of the right thumb alone before the next order comes up. */
export const FINISH_LEAD = 2.5;
/** The meter starts here, above the line, so the first second isn't a scolding. */
export const FINISH_START = 0.7;
export const FINISH_LINE = 0.45;
/** Seconds under the line, after the grace, before the drink is ruined. */
export const FINISH_SLOW_TOLERANCE = 1.6;
export const FINISH_GRACE = 1.2;
/** The shaker and mixing glass sit this far right of their panel's middle, clear of the thermometer. */
export const FINISH_TOOL_DX = 18;
/** Thumb travel that counts as one shake stroke. */
export const STROKE_PX = 22;
export const STROKE_GAIN = 0.11;
export const STIR_GAIN_PER_REV = 0.5;
/** How long "Good job!" and the guest hold before the build can start. */
export const RESULT_HOLD = 1.8;

export function finishDrain(level: number): number {
  return Math.min(0.5, 0.3 + 0.02 * (level - 1));
}

export function finishPoints(level: number): number {
  return 300 + 100 * level;
}

export function servePoints(level: number): number {
  return 250 * level;
}
