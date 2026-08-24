// ─── Let's Do Shots! — geometry and palette ──────────────────────────────────
//
// Same arrangement as Tiki Wars: a FIXED logical width so a cell is the same
// size on every phone, and a FLEXIBLE height so the screen fills edge to edge
// rather than letterboxing. Deliberately separate from arcade.ts, which is
// pinned to the 224x288 the two string-art games share.

/** Logical width, fixed. Every measurement below is in these units. */
export const W = 270;

/**
 * Logical height, flexible.
 *
 * The BOARD never changes size — seven by eight at thirty-four pixels, on every
 * device — because a taller board on a taller phone would be a different game
 * with a different difficulty. The slack goes into the furniture instead: the
 * HUD breathes, the back bar gets deeper, and the recipe strip sits further
 * from the thumb.
 */
export const H_MIN = 460;
export const H_MAX = 640;
export const H_REF = 560;

export function heightFor(viewportW: number, viewportH: number): number {
  if (viewportW <= 0 || viewportH <= 0) return H_REF;
  return Math.round(Math.min(H_MAX, Math.max(H_MIN, (viewportH / viewportW) * W)));
}

/**
 * Device pixels per logical pixel.
 *
 * At 2 the buffer is 540 across, so one logical pixel is about 1.4 CSS pixels
 * on a phone — chunky enough to read as a console game, fine enough that a
 * bottle label survives at cell size.
 */
export const PIXEL_SCALE = 2;

// ─── The board ───────────────────────────────────────────────────────────────

export const COLS = 7;
export const ROWS = 8;

/**
 * One cell, in logical pixels.
 *
 * Seven columns at 34 is 238 across, which leaves a 16px margin either side —
 * enough for the playfield's frame and for a thumb to swipe the outermost
 * column without its own knuckle covering the target.
 */
export const CELL = 34;
export const BOARD_W = COLS * CELL;
export const BOARD_H = ROWS * CELL;
export const BOARD_X = Math.round((W - BOARD_W) / 2);

/**
 * The HUD: stage, score, swipes and the guest's order.
 *
 * A range, not a number. The content is a fixed 68 tall and is anchored to the
 * BOTTOM of whatever box it gets, so on a short phone it sits tight under the
 * top edge and on a tall one it drifts down with air above it — rather than the
 * whole game floating in the middle of a black field, which is what a fixed
 * HUD plus a centred stack produced.
 */
export const HUD_MIN = 76;
export const HUD_MAX = 112;
/** Content height inside the HUD, anchored to its bottom edge. */
export const HUD_CONTENT = 68;

/**
 * The bar itself: the strip between the HUD and the board.
 *
 * The bartender stands here for the whole stage and the bar back runs past him
 * to restock, so it is the one part of the layout that WANTS the spare height a
 * tall phone has going. Hence the wide range and the split below favouring it —
 * on a short screen it is a shelf, on a tall one it is a room.
 */
export const BACKBAR_MIN = 52;
export const BACKBAR_MAX = 132;

/** The bonus shot's recipe, under the board. */
export const RECIPE_H = 46;
/** Between the board and the recipe strip. */
export const GAP = 8;
/** Above the HUD. Small: the top of a phone is the least useful space there is. */
export const TOP_MARGIN = 6;

/**
 * The top-right corner GameShell puts its EXIT button over, in logical pixels.
 *
 * A full-bleed game draws its own everything, so the only way out of the stage
 * is the button the cabinet floats on top — and it is a 44px tap target, which
 * on a 375px-wide phone is about this much of a 270-wide field. Nothing the HUD
 * draws may go here. The score used to, and on a short screen it sat directly
 * underneath the button.
 */
export const EXIT_CLEARANCE_W = 64;
export const EXIT_CLEARANCE_H = 38;

export interface Layout {
  h: number;
  /** Top of the HUD box. Its content hangs from the bottom — see HUD_CONTENT. */
  hudY: number;
  backbarY: number;
  boardY: number;
  recipeY: number;
}

/**
 * Where everything sits, for a given screen height.
 *
 * Spare height goes into the FURNITURE first, and mostly into the BAR: the HUD
 * only needs so much room, while the bar is where the bartender stands and the
 * bar back runs, and both of them read better the more of it there is. What is
 * left over falls below the recipe strip, which is not waste — it is where the
 * thumb rests, directly under the control the thumb is on.
 */
export function layoutFor(h: number): Layout {
  const fixed = BOARD_H + GAP + RECIPE_H + TOP_MARGIN;
  const spare = Math.max(HUD_MIN + BACKBAR_MIN, h - fixed);
  const hudH = Math.round(Math.min(HUD_MAX, Math.max(HUD_MIN, spare * 0.45)));
  const backbarH = Math.round(Math.min(BACKBAR_MAX, Math.max(BACKBAR_MIN, spare - hudH)));
  const hudY = TOP_MARGIN;
  const backbarY = hudY + hudH;
  const boardY = backbarY + backbarH;
  return { h, hudY, backbarY, boardY, recipeY: boardY + BOARD_H + GAP };
}

/** Logical position of a cell's top-left corner. */
export function cellX(x: number): number {
  return BOARD_X + x * CELL;
}
export function cellY(layout: Layout, y: number): number {
  return layout.boardY + y * CELL;
}

// ─── Palette ─────────────────────────────────────────────────────────────────
//
// A back bar at night: near-black, one warm accent, and the bottles doing all
// the shouting. The NES palette this is imitating had no room for subtlety, so
// neither does this — every colour here is either furniture or a signal, and
// nothing is in between.

export const C = {
  black: "#07060C",
  night: "#12101F",
  panel: "#1B1830",
  panelLip: "#2C2848",
  well: "#0C0A16",
  wellLine: "#191530",

  white: "#FFFFFF",
  bone: "#F0E8D4",
  dim: "#8A82A8",

  brass: "#FFC02E",
  brassDark: "#8A5E00",
  neon: "#3CE0E0",
  hot: "#FF3B6B",
  good: "#5BE07A",

  shadow: "rgba(0,0,0,0.45)",
} as const;

// ─── The bar back's run ──────────────────────────────────────────────────────

/**
 * A run is TWO passes: in from the right, a turn, then back out to the right.
 *
 * Turning round rather than looping off one edge and reappearing at the other
 * is what makes it read as one man fetching stock instead of a queue of
 * identical ones.
 */
export const BARBACK_RUN = 2.2;

/** How tall he is, crossing the middle of the screen. About two cells. */
export const BARBACK_BODY_H = 64;

/** How far past each edge he starts and finishes, so he is never popped in. */
const BARBACK_EDGE = 40;

/**
 * Where he is, and which way he is facing, `t` seconds into a run.
 *
 * HIS SHEET IS DRAWN FACING LEFT. So `flip` is true exactly when he is heading
 * RIGHT, and the rule this encodes is simply that he faces the way he is going.
 * If the sheet is ever re-exported facing the other way, this is the one place
 * that changes — and the test on it will say so.
 */
export function barBackPass(t: number): { x: number; flip: boolean } {
  const half = BARBACK_RUN / 2;
  const span = W + BARBACK_EDGE * 2;
  if (t < half) return { x: W + BARBACK_EDGE - (t / half) * span, flip: false };
  return { x: -BARBACK_EDGE + ((t - half) / half) * span, flip: true };
}
