// ─── Let's Do Shots! — the difficulty curve ──────────────────────────────────
//
// One stage's rules, generated rather than authored. A hundred orders times
// twenty-two guests is more nights out than anyone will play, and the point of
// generating is that the pop-up never runs out of stages and nobody at the bar
// is looking at the same board as the person beside them.
//
// The curve is deliberately SHALLOW. This is a game somebody plays standing up,
// once, holding a drink; it has to be winnable for four or five stages before
// it starts asking anything, and it should only become genuinely hard well past
// the point most people put the phone down.
//
// Everything is a pure function of the stage number and a seeded generator, so
// the whole curve can be tabulated in a test rather than discovered at the bar.

import { BOTTLE_IDS, type BottleId } from "./bottles";
import { ORDERS, recipeBottles } from "./orders";
import { GUEST_COUNT } from "./guestArt";
import { pick, shuffled, type Rng, type StageRules, type Target } from "./shotsCore";

/**
 * How many of the ten spirits are in play.
 *
 * The single biggest lever on difficulty, and the one the player never sees.
 * Five bottles on a 7x8 board is generous — runs turn up by accident and the
 * job is spotting them. Eight is genuinely tight. Ten is never used: with the
 * full cast, three in a row is rare enough that the board reads as broken.
 */
export function paletteSize(stage: number): number {
  if (stage <= 2) return 5;
  if (stage <= 6) return 6;
  return 7;
}

/** How many different bottles the guest's order asks for. */
export function targetTypeCount(stage: number): number {
  if (stage <= 2) return 1;
  if (stage <= 6) return 2;
  return 3;
}

/**
 * Total bottles to break across every target.
 *
 * These numbers are MEASURED, not guessed. A swipe breaks six to fifteen cells
 * once its cascade is counted and about 2.8 of those are a kind being asked
 * for, and the coffee cups hand back roughly another half a swipe's worth of
 * moves — so the honest budget is around four and a half useful bottles per
 * swipe, not the two or three it looks like from the board.
 *
 * Against that, this curve puts a competent player at about 100% for the first
 * few stages, 80% around stage ten and a shade over 70% from stage sixteen on.
 * Three continues then make a typical good run somewhere around fourteen
 * stages, which is ten or fifteen minutes — the right length for a game played
 * standing at a bar with a drink in the other hand.
 *
 * Stops climbing at stage 40. Past there nothing gets harder and the only
 * thing still going up is the score, which is where a cabinet game should end
 * up: the leaderboard, not the wall.
 */
export function totalNeed(stage: number): number {
  return Math.round(40 + Math.min(stage, 40) * 3.4);
}

/** Swipes allowed. Grows too, just more slowly than the order does. */
export function swipesFor(stage: number): number {
  return Math.min(30, 20 + Math.floor(stage / 4));
}

/**
 * Odds that a refilled cell is a coffee cup.
 *
 * Low, and rising only slightly. Roughly one cup every eight or nine swipes,
 * which is what makes it read as luck rather than as supply — and, with
 * MAX_COFFEE_PER_MOVE, is what keeps the swipe counter falling on average
 * instead of climbing. A cup is a reprieve, never an income.
 */
export function coffeeChanceFor(stage: number): number {
  return Math.min(0.03, 0.008 + stage * 0.0008);
}

function withoutRecent(count: number, avoid: number[], rng: Rng): number {
  const free = [];
  for (let i = 0; i < count; i++) if (avoid.indexOf(i) < 0) free.push(i);
  return pick(rng, free.length ? free : Array.from({ length: count }, (_, i) => i));
}

/** Split a total across `parts` as evenly as it goes, biggest first. */
function split(total: number, parts: number): number[] {
  const base = Math.floor(total / parts);
  const out = new Array(parts).fill(base);
  for (let i = 0; i < total - base * parts; i++) out[i]++;
  return out;
}

export interface StageOptions {
  /** Order indices to skip, so the same shot is not ordered twice in a row. */
  avoidOrders?: number[];
  /** Guest indices to skip, likewise. */
  avoidGuests?: number[];
}

export function buildStage(stage: number, rng: Rng, opts: StageOptions = {}): StageRules {
  const orderIndex = withoutRecent(ORDERS.length, opts.avoidOrders ?? [], rng);
  const order = ORDERS[orderIndex];
  const guest = withoutRecent(GUEST_COUNT, opts.avoidGuests ?? [], rng);

  // The recipe's own bottles are always in play — a shot the board cannot pour
  // would be a bonus that exists only as a taunt at the bottom of the screen.
  const core = recipeBottles(order.recipe);
  const palette: BottleId[] = core.slice();
  for (const b of shuffled(rng, BOTTLE_IDS)) {
    if (palette.length >= paletteSize(stage)) break;
    if (palette.indexOf(b) < 0) palette.push(b);
  }

  // Targets are drawn from the recipe first. That is what ties the two halves
  // of the stage together: pouring the guest's shot is also the fastest way to
  // fill the order, rather than a side quest you can ignore for the score.
  const preferred = shuffled(rng, core);
  const rest = shuffled(rng, palette.filter((b) => core.indexOf(b) < 0));
  const kinds = preferred.concat(rest).slice(0, targetTypeCount(stage));
  const needs = split(totalNeed(stage), kinds.length);
  const targets: Target[] = kinds.map((kind, i) => ({ kind, need: needs[i] }));

  return {
    stage,
    palette,
    recipe: order.recipe,
    shotName: order.name,
    quip: order.quip,
    guest,
    targets,
    swipes: swipesFor(stage),
    coffeeChance: coffeeChanceFor(stage),
  };
}

/** The order index a stage used, for the "don't repeat" list. */
export function orderIndexOf(rules: StageRules): number {
  return ORDERS.findIndex((o) => o.name === rules.shotName);
}
