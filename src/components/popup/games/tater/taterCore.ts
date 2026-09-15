// ─── Tater Tales — the rules ─────────────────────────────────────────────────
//
// The whole game with no canvas, no React and no wall clock. The shaft is
// generated from a seed, the physics run on a fixed substep, and `step` is a
// pure function of (state, dt) — so the same seed and the same taps produce the
// same climb, every time, on any machine.
//
// That matters more here than it did for the match-three. A climbing game lives
// or dies on whether the platform above you can actually be reached, and
// "actually be reached" is a claim about GRAVITY, V_MAX and ROW_GAP together.
// It is not a thing you can eyeball at the bar. __tests__/tater.test.ts blasts
// a bot up several thousand rows and asserts the invariant directly.
//
// COORDINATES. World y increases DOWNWARD, screen-style, so gravity is simply
// positive and none of the physics below is written in double negatives. The
// bottom shelf is y = 0 and row r's surface is y = -r * ROW_GAP, which means
// altitude is -y and the renderer only has to subtract the camera. Elmer's
// (x, y) is the middle of his feet.
//
// See docs/tater-tales-sprites.md for the design this implements.

import {
  AIM_MAX, AIM_PERIOD, ELMER_W, FIZZ_MAX, FIZZ_PER_BLAST,
  FIZZ_PER_MIXER, FIZZ_PER_NEW_ROW, FIZZ_REFUND_MAX, FIZZ_START, GRAVITY,
  LAND_SPEED, MAX_FALL,
  PLATFORM_BOUNCE, PLATFORM_W, POWER_PERIOD, REST_SPEED, ROW_GAP,
  SCORE_ALLIE, SCORE_MATCH, SCORE_MIXER, SCORE_NEW_ZONE, SCORE_PER_ROW,
  SCORE_RESCUE, SCORE_SUMMIT_PER_LAP, SCORE_SHOWDOWN, FIZZ_PER_ZONE, KNOCKDOWN_ROWS, OVERSHAKE_CYCLES,
  SLIDE_FRICTION, V_MAX, V_MIN, W, WALL_BOUNCE, WALL_MARGIN,
  aimPeriodFor, lapDifficulty, powerPeriodFor,
  type PlatformSize,
} from "./constants";
import { BOTTLE_IDS, MIXER_IDS, summitBottleFor, type BottleId, type MixerId } from "./cast";
import { ROWS_PER_ZONE, SUMMIT_ROW, zoneIndexForRow } from "./zones";

// ─── Randomness ──────────────────────────────────────────────────────────────

export type Rng = () => number;

/** mulberry32 — small, fast, and never lays out a shaft that looks patterned. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[Math.floor(rng() * list.length) % list.length];
}

// ─── The shaft ───────────────────────────────────────────────────────────────

export type Item =
  | { kind: "mixer"; id: MixerId }
  | { kind: "bottle"; id: BottleId }
  | { kind: "allie" }
  | { kind: "guillermo" }
  /** Mr. Tater, blocking the top of a world. Spray him off to go on. */
  | { kind: "tater" }
  /** Tater's golden top shelf. Landing here ends the lap. */
  | { kind: "summit" };

export interface Platform {
  id: number;
  row: number;
  size: PlatformSize;
  /** Left edge. */
  x: number;
  /** Top surface. */
  y: number;
  w: number;
  /** What is standing on it, or null. */
  item: Item | null;
  /** Set once the item has been dealt with, so a shelf pays out only once. */
  spent: boolean;
  /**
   * A shelf that slides from side to side. `x` is kept current by `step`;
   * `baseX` is where it was generated, and it swings `amp` either side of that.
   */
  move?: { baseX: number; amp: number; speed: number; phase: number };
}

/** Where a shelf is at a given moment. */
export function platformX(p: Platform, time: number): number {
  if (!p.move) return p.x;
  return p.move.baseX + p.move.amp * Math.sin(p.move.phase + time * p.move.speed);
}

/**
 * How far sideways one row's worth of climb can carry you.
 *
 * Derived, not chosen. Rising one ROW_GAP under GRAVITY needs an upward
 * component of sqrt(2 * 900 * 62) = 334 px/s, and the blast's total speed is
 * capped at V_MAX = 560, so at most sqrt(560^2 - 334^2) = 449 is left for
 * sideways. Apex arrives 334/900 = 0.371s later, by which time that has carried
 * you 167px.
 *
 * 150 is that with the margin a real player needs, since nobody stops the arrow
 * on the exact degree. Every platform is generated within this of something on
 * the row above, so no shelf in the game is ever a dead end — see placeRow.
 */
export const REACH_X = 150;

/** First row that can have a moving shelf. */
const MOVING_FROM_ROW = 8;

/** Rows apart, roughly, that mixers turn up. Stretches by up to two rows on later laps. */
const MIXER_EVERY: [number, number] = [3, 5];
/** Rows apart, roughly, that a dusty bottle is waiting. Closer together on later laps. */
const BOTTLE_EVERY: [number, number] = [6, 9];

/**
 * Where Allie is being carried to, one shelf at a time.
 *
 * Fixed rows rather than random ones: she is the story beat of the run, and a
 * story beat that might not happen is not one. Spaced far enough apart that
 * seeing her again is an event and not a checkpoint.
 */
export const ALLIE_ROWS = [35, 95, 155, 215];

function spanFor(rng: Rng, [lo, hi]: [number, number]): number {
  return lo + Math.floor(rng() * (hi - lo + 1));
}

interface RowContext {
  nextId: number;
  nextMixerRow: number;
  nextBottleRow: number;
  /** Which lap this shaft is for. Later laps build a meaner one. */
  lap: number;
}

/**
 * One row of shelves, guaranteed reachable from the row below it.
 *
 * Two passes. The first scatters one to three platforms across the shaft; the
 * second REPAIRS the row, because a scatter that happens to put everything on
 * the left while the row below is all on the right builds a shaft with a rung
 * missing — and a rung missing in a game where you cannot die is not a
 * challenge, it is a run that quietly cannot continue.
 *
 * The repair is stated as an invariant over the row BELOW: every platform down
 * there must have something up here within REACH_X. Not "the row is connected
 * somewhere", which is the weaker claim it is easy to write by accident and
 * which still strands a player who lands on the wrong end of a wide row.
 */
function placeRow(rng: Rng, row: number, below: Platform[], ctx: RowContext): Platform[] {
  const y = -row * ROW_GAP;
  const out: Platform[] = [];
  const hard = lapDifficulty(ctx.lap);

  // The summit: one gold floor wall to wall, so every shelf below reaches it.
  if (row === SUMMIT_ROW) {
    return [{
      id: ctx.nextId++, row, size: "large", x: WALL_MARGIN, y, w: W - WALL_MARGIN * 2,
      item: { kind: "summit" }, spent: false,
    }];
  }

  // The top of every world below heaven: Tater, on a floor wall to wall, so
  // nobody climbs into the next world without facing him.
  if (isShowdownRow(row)) {
    return [{
      id: ctx.nextId++, row, size: "large", x: WALL_MARGIN, y, w: W - WALL_MARGIN * 2,
      item: { kind: "tater" }, spent: false,
    }];
  }

  const push = (size: PlatformSize, cx: number) => {
    const w = PLATFORM_W[size];
    const x = Math.round(Math.min(W - WALL_MARGIN - w, Math.max(WALL_MARGIN, cx - w / 2)));
    // Never overlap, and never sit so close that two shelves read as one.
    for (const p of out) if (x < p.x + p.w + 10 && p.x < x + w + 10) return null;
    const p: Platform = { id: ctx.nextId++, row, size, x, y, w, item: null, spent: false };
    out.push(p);
    return p;
  };

  // Two or three, and mostly the wider two sizes. Coverage across a row lands
  // around half the shaft, which is what makes a blast aimed at a shelf a
  // gamble worth taking rather than one worth avoiding.
  // Later laps: more often only two, and more of them small.
  const count = 2 + (rng() < 0.5 - hard * 0.3 ? 1 : 0);
  const smallOdds = 0.28 + hard * 0.3;
  const largeOdds = 0.26 - hard * 0.18;
  for (let i = 0; i < count; i++) {
    const roll = rng();
    const size: PlatformSize = roll < smallOdds ? "small" : roll < 1 - largeOdds ? "medium" : "large";
    push(size, WALL_MARGIN + rng() * (W - WALL_MARGIN * 2));
  }

  // ── Repair ───────────────────────────────────────────────────────────────
  const centre = (p: Platform) => p.x + p.w / 2;
  for (const under of below) {
    const from = centre(under);
    if (out.some((p) => Math.abs(centre(p) - from) <= REACH_X)) continue;
    // Straight above, jittered so a repaired row does not read as a ladder.
    const jitter = (rng() - 0.5) * REACH_X;
    if (push("medium", from + jitter)) continue;
    if (push("small", from)) continue;
    // Everything in the way: widen the nearest platform toward him instead.
    let best = out[0];
    for (const p of out) if (Math.abs(centre(p) - from) < Math.abs(centre(best) - from)) best = p;
    if (from < centre(best)) {
      const grow = Math.min(best.x - WALL_MARGIN, Math.abs(centre(best) - from) - REACH_X + 12);
      best.x -= Math.max(0, grow);
      best.w += Math.max(0, grow);
    } else {
      best.w += Math.max(0, Math.min(W - WALL_MARGIN - (best.x + best.w), Math.abs(centre(best) - from) - REACH_X + 12));
    }
  }

  // ── What is standing on them ─────────────────────────────────────────────
  // Allie is only snatched on the way up during lap one. After the rescue she
  // stays safe on the bottom shelf.
  if (ctx.lap === 1 && ALLIE_ROWS.includes(row)) {
    // Far right of the shaft, always. The design pins her there so the cutscene
    // that follows only ever has to be animated running one direction.
    let right = out[0];
    for (const p of out) if (p.x + p.w > right.x + right.w) right = p;
    right.item = { kind: "allie" };
  } else if (row >= ctx.nextBottleRow) {
    pick(rng, out).item = { kind: "bottle", id: pick(rng, BOTTLE_IDS) };
    ctx.nextBottleRow = row + Math.max(3, spanFor(rng, BOTTLE_EVERY) - Math.round(hard * 3));
  }

  if (row >= ctx.nextMixerRow) {
    const free = out.filter((p) => !p.item);
    if (free.length) {
      pick(rng, free).item = { kind: "mixer", id: pick(rng, MIXER_IDS) };
      ctx.nextMixerRow = row + spanFor(rng, MIXER_EVERY) + Math.round(hard * 2);
    }
  }

  // ── Moving shelves ───────────────────────────────────────────────────────
  // None on the first few rows, then more of them the higher the climb and the
  // later the lap. At most one per row, and it swings only through the gap its
  // neighbours leave, so shelves never overlap and never leave the shaft.
  // Never Allie's: her scene is staged against a shelf that stays put.
  if (row >= MOVING_FROM_ROW) {
    const odds = Math.min(0.7, 0.22 + (row / SUMMIT_ROW) * 0.3 + hard * 0.25);
    if (rng() < odds) {
      const candidates = out.filter((p) => p.item?.kind !== "allie");
      if (candidates.length) {
        const p = pick(rng, candidates);
        const sorted = [...out].sort((a, b) => a.x - b.x);
        const i = sorted.indexOf(p);
        const leftBound = i > 0 ? sorted[i - 1].x + sorted[i - 1].w + 10 : WALL_MARGIN;
        const rightBound = i < sorted.length - 1 ? sorted[i + 1].x - 10 : W - WALL_MARGIN;
        const amp = Math.min(p.x - leftBound, rightBound - (p.x + p.w), 64);
        if (amp >= 14) {
          p.move = {
            baseX: p.x,
            amp,
            speed: 0.7 + rng() * 0.6 + hard * 0.5,
            phase: rng() * Math.PI * 2,
          };
        }
      }
    }
  }

  return out;
}

/**
 * The last row of each world, heaven excepted — heaven's top is the summit
 * itself, one row further up.
 */
export function isShowdownRow(row: number): boolean {
  return row > 0 && (row + 1) % ROWS_PER_ZONE === 0 && row < SUMMIT_ROW - ROWS_PER_ZONE;
}

/** The bottom shelf: one unbroken floor, with Guillermo on it wishing you luck. */
function groundRow(ctx: RowContext): Platform[] {
  const w = W - WALL_MARGIN * 2;
  return [{
    id: ctx.nextId++, row: 0, size: "large", x: WALL_MARGIN, y: 0, w,
    item: { kind: "guillermo" }, spent: false,
  }];
}

// ─── Events ──────────────────────────────────────────────────────────────────
//
// The core never animates anything. It reports what happened and the renderer
// decides how long to dwell on it — which is what lets a cutscene play at
// whatever pace reads well without the simulation waiting on a frame rate.

export type TaterEvent =
  | { kind: "blast"; angle: number; power: number }
  | { kind: "wall"; x: number; y: number; speed: number }
  /** Kept for the renderer's sake; shelves are one-way, so nothing emits it. */
  | { kind: "bonk"; y: number }
  | { kind: "bounce"; x: number; y: number; speed: number }
  | { kind: "land"; platformId: number; row: number; speed: number }
  | { kind: "rest"; platformId: number; row: number }
  | { kind: "height"; row: number }
  | { kind: "zone"; index: number }
  | { kind: "pickup"; id: MixerId; x: number; y: number }
  | { kind: "match"; id: BottleId; x: number; y: number }
  | { kind: "allie"; platformId: number; x: number; y: number }
  /** Standing on Tater's top shelf. The renderer plays the finale, then calls nextLap. */
  | { kind: "summit"; lap: number; bottle: BottleId | null; bonus: number; y: number }
  /** Standing on a world's top shelf with Tater on it. The renderer plays the showdown. */
  | { kind: "showdown"; zone: number; lap: number; bonus: number; y: number }
  /** Held the gauge too long: Mixey blew. Elmer is knocked down `rows` rows. */
  | { kind: "explode"; x: number; y: number; rows: number }
  | { kind: "flat" };

// ─── State ───────────────────────────────────────────────────────────────────

export type Phase =
  /** The arrow sweeps. Pressing down locks the direction and starts the fill. */
  | "aim"
  /** Held down: the carbonation gauge fills and empties. Letting go fires. */
  | "power"
  /** He stops shaking, points Mixey down and cracks the tab. Fixed length. */
  | "charge"
  /** Airborne, at the mercy of the physics. */
  | "flight"
  /** Down on a shelf and still moving. Friction is taking it from here. */
  | "slide"
  /** Standing still. Whatever is on the shelf resolves, then back to aim. */
  | "settle"
  /** Something is being played out — Allie, Tater. The simulation is paused. */
  | "scene"
  | "over";

/** Seconds of wind-up between locking the strength and actually leaving. */
export const CHARGE_TIME = 0.42;
/** Seconds Elmer stands still after stopping before the arrow comes back. */
export const SETTLE_TIME = 0.3;

export interface Elmer {
  /** Middle of his feet. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Which way he is looking. 1 is right. */
  facing: 1 | -1;
  /** The shelf under his feet, or null in the air. */
  standing: number | null;
}

export interface TaterState {
  seed: number;
  rng: Rng;
  ctx: RowContext;

  phase: Phase;
  /** Seconds spent in the current phase. */
  t: number;
  elapsed: number;

  elmer: Elmer;

  /** Live sweep values, and what the taps locked them at. */
  angle: number;
  power: number;
  lockedAngle: number;
  lockedPower: number;

  fizz: number;
  mixers: number;
  /** Everything that is not height. Height is recomputed from maxRow. */
  bonus: number;
  /** Which lap. Starts at 1. */
  lap: number;
  /** Height points from laps already finished. */
  banked: number;
  maxRow: number;
  maxZone: number;
  blasts: number;
  /** Times the can blew up from holding too long. */
  explosions: number;
  /**
   * Knocked down: shelves above this row do not catch him until he lands on
   * one at or below it.
   */
  dropTo: number | null;

  platforms: Platform[];
  /**
   * The same shelves, bucketed by row, and by id.
   *
   * Not a micro-optimisation. The shaft has no ceiling, so `platforms` grows
   * for as long as the run does — a good climb passes row 120 and carries
   * getting on for four hundred shelves. Collision runs at a 1/240 substep, and
   * the attract bot flies about a hundred candidate shots every turn, so a
   * linear scan there is roughly eighty million comparisons per decision. It
   * took the test suite past two minutes and would have dropped frames on a
   * phone somewhere around the moon.
   *
   * Both are rebuilt by `build` and by nothing else, so anything that adds a
   * shelf has to go through it.
   */
  byRow: Map<number, Platform[]>;
  byId: Map<number, Platform>;
  /** Highest row laid down so far. */
  builtTo: number;

  events: TaterEvent[];
  over: boolean;

  /**
   * This state is a throwaway copy being flown by simulateBlast.
   *
   * It exists because a probe shares `rng` and `ctx` with the game it was
   * copied from — cloning a seeded generator is not something you can do by
   * spreading an object — so a probe that reached `rest` would bank a score
   * nobody earned AND pull numbers out of the real shaft's generator. The bot
   * flies about a hundred shots per turn, so that is a hundred rows' worth of
   * randomness consumed before the player has moved.
   */
  probe?: boolean;
}

/** Rows kept above the highest one reached, so there is always somewhere to aim. */
const BUILD_AHEAD = 14;

export function createGame(seed: number, opts: { startRow?: number } = {}): TaterState {
  const rng = makeRng(seed);
  const ctx: RowContext = { nextId: 1, nextMixerRow: 3, nextBottleRow: 6, lap: 1 };
  const platforms = groundRow(ctx);
  const ground = platforms[0];

  const g: TaterState = {
    seed, rng, ctx,
    phase: "aim", t: 0, elapsed: 0,
    elmer: {
      x: ground.x + ground.w * 0.28,
      y: 0, vx: 0, vy: 0, facing: 1, standing: ground.id,
    },
    angle: 0, power: 0, lockedAngle: 0, lockedPower: 0,
    fizz: FIZZ_START, mixers: 0, bonus: 0, lap: 1, banked: 0, maxRow: 0, maxZone: 0, blasts: 0,
    explosions: 0, dropTo: null,
    platforms,
    // A COPY for row 0: `platforms` itself grows with every row built, and the
    // bucket must not.
    byRow: new Map([[0, [...platforms]]]),
    byId: new Map(platforms.map((p) => [p.id, p])),
    builtTo: 0,
    events: [], over: false,
  };
  build(g, BUILD_AHEAD);
  if (opts.startRow) startAt(g, opts.startRow);
  return g;
}

/**
 * Put Elmer on a shelf part way up, as if he had climbed there.
 *
 * Practice only — the front page's hidden "start near the top" — so the owner
 * can see the finale without climbing seventy rows first. A practice run never
 * posts a score, so nothing here needs to be fair.
 */
function startAt(g: TaterState, row: number): void {
  const target = Math.min(SUMMIT_ROW - 1, row);
  build(g, target + BUILD_AHEAD);
  const shelf = g.byRow.get(target)?.[0];
  if (!shelf) return;
  g.elmer.x = shelf.x + shelf.w / 2;
  g.elmer.y = shelf.y;
  g.elmer.standing = shelf.id;
  g.maxRow = target;
  g.maxZone = zoneIndexForRow(target);
  g.fizz = FIZZ_MAX;
}

/**
 * Start the next lap: a fresh, harder shaft from the bottom shelf, with the
 * score carried over and the can refilled as the reward for reaching the top.
 */
export function nextLap(g: TaterState): void {
  g.banked += g.maxRow * SCORE_PER_ROW;
  g.lap += 1;
  g.rng = makeRng((g.seed + g.lap * 7919) >>> 0);
  g.ctx = { nextId: 1, nextMixerRow: 3, nextBottleRow: 6, lap: g.lap };
  const platforms = groundRow(g.ctx);
  const ground = platforms[0];
  g.platforms = platforms;
  g.byRow = new Map([[0, [...platforms]]]);
  g.byId = new Map(platforms.map((p) => [p.id, p]));
  g.builtTo = 0;
  g.elmer = { x: ground.x + ground.w * 0.28, y: 0, vx: 0, vy: 0, facing: 1, standing: ground.id };
  g.maxRow = 0;
  g.maxZone = 0;
  g.fizz = FIZZ_MAX;
  g.dropTo = null;
  g.phase = "aim";
  g.t = 0;
  g.angle = 0;
  build(g, BUILD_AHEAD);
}

/** Lay down shelves up to `row`, if they are not there already. */
export function build(g: TaterState, row: number): void {
  // Nothing above the summit.
  while (g.builtTo < Math.min(row, SUMMIT_ROW)) {
    const next = g.builtTo + 1;
    const made = placeRow(g.rng, next, g.byRow.get(g.builtTo) ?? [], g.ctx);
    g.platforms.push(...made);
    g.byRow.set(next, made);
    for (const p of made) g.byId.set(p.id, p);
    g.builtTo = next;
  }
}

export function platformById(g: TaterState, id: number): Platform | undefined {
  return g.byId.get(id);
}

/** Every shelf between two rows, inclusive. What the renderer draws. */
export function rowsFor(g: TaterState, from: number, to: number): Platform[] {
  const out: Platform[] = [];
  for (let r = Math.max(0, from); r <= to; r++) {
    const list = g.byRow.get(r);
    if (list) out.push(...list);
  }
  return out;
}

/** Altitude in rows, fractional. What the HUD counts and the score is built on. */
export function heightRows(g: TaterState): number {
  return -g.elmer.y / ROW_GAP;
}

export function score(g: TaterState): number {
  return g.banked + g.maxRow * SCORE_PER_ROW + g.bonus;
}

// ─── The sweeps ──────────────────────────────────────────────────────────────

/**
 * The arrow, `t` seconds into the aim.
 *
 * A sine, so it eases at the limits — the arrow lingers where the interesting
 * shots are, at full lean either side, and hurries through straight-up, which
 * is the shot nobody has to be precise about.
 */
export function aimAt(t: number, period: number = AIM_PERIOD): number {
  return AIM_MAX * Math.sin((2 * Math.PI * t) / period);
}

/**
 * The carbonation gauge, `t` seconds in, 0 to 1.
 *
 * A triangle. See the note on POWER_PERIOD in constants.ts — a sine here makes
 * the same tap timing mean different things depending on where in the sweep it
 * lands, which is noise rather than difficulty.
 */
export function powerAt(t: number, period: number = POWER_PERIOD): number {
  const p = (t % period) / period;
  return p < 0.5 ? p * 2 : 2 - p * 2;
}

/** Speed off the shelf for a gauge reading. */
export function speedFor(power: number): number {
  return V_MIN + Math.max(0, Math.min(1, power)) * (V_MAX - V_MIN);
}

/** The blast itself. Angle is measured from straight up, positive to the right. */
export function velocityFor(angle: number, power: number): { vx: number; vy: number } {
  const v = speedFor(power);
  return { vx: v * Math.sin(angle), vy: -v * Math.cos(angle) };
}

// ─── Input ───────────────────────────────────────────────────────────────────

/**
 * The control, one gesture: PRESS when the arrow points where you want to go —
 * that locks it and starts the fizz filling — HOLD while the gauge rises and
 * falls, and LET GO at the strength you want. Hold through OVERSHAKE_CYCLES
 * full fills and the can blows, knocking Elmer down.
 *
 * Input in any other phase is IGNORED rather than queued — a queued press fires
 * a blast the player made while watching a cutscene and had forgotten about.
 */
export function press(g: TaterState): boolean {
  if (g.phase !== "aim") return false;
  g.lockedAngle = g.angle;
  g.elmer.facing = g.angle >= 0 ? 1 : -1;
  g.phase = "power";
  g.t = 0;
  g.power = 0;
  return true;
}

/** Finger up while filling: blast at whatever the gauge reads. */
export function release(g: TaterState): boolean {
  if (g.phase !== "power") return false;
  g.lockedPower = g.power;
  g.phase = "charge";
  g.t = 0;
  return true;
}

/** The hold was interrupted (the game was paused): back to aiming, no blast. */
export function cancelHold(g: TaterState): void {
  if (g.phase === "power") {
    g.phase = "aim";
    g.t = 0;
    g.power = 0;
  }
}

/** How many full fills the current hold has been through, fractional. */
export function holdCycles(g: TaterState): number {
  return g.phase === "power" ? g.t / powerPeriodFor(g.lap) : 0;
}

/** End a cutscene the renderer was playing, and hand the simulation back. */
export function endScene(g: TaterState): void {
  if (g.phase === "scene") {
    g.phase = "aim";
    g.t = 0;
  }
}

// ─── Stepping ────────────────────────────────────────────────────────────────

/**
 * Physics substep.
 *
 * Fixed and small, because the collision test below is a point-in-time overlap
 * check rather than a swept one. At terminal velocity a 1/60 frame moves Elmer
 * ten pixels — more than a shelf is thick — so at frame rate he would drop
 * clean through the bottom shelf roughly whenever a phone stuttered. At 1/240
 * the worst-case move is 2.6px against a 9px shelf.
 */
const SUBSTEP = 1 / 240;

export function step(g: TaterState, dt: number): void {
  if (g.over || g.phase === "scene") return;

  // Clamped: a backgrounded tab handing over a four-second frame must not
  // resolve an entire flight in one go, skipping the animation and, worse,
  // skipping the substepping that keeps collisions honest.
  const d = Math.min(0.05, Math.max(0, dt));
  g.t += d;
  g.elapsed += d;
  movePlatforms(g);

  switch (g.phase) {
    case "aim":
      g.angle = aimAt(g.t, aimPeriodFor(g.lap));
      break;

    case "power": {
      const period = powerPeriodFor(g.lap);
      g.power = powerAt(g.t, period);
      if (g.t >= OVERSHAKE_CYCLES * period) explode(g);
      break;
    }

    case "charge":
      if (g.t >= CHARGE_TIME) launch(g);
      break;

    case "flight":
    case "slide": {
      let left = d;
      while (left > 0 && (g.phase === "flight" || g.phase === "slide")) {
        const h = Math.min(SUBSTEP, left);
        left -= h;
        if (g.phase === "flight") integrate(g, h);
        else slide(g, h);
      }
      break;
    }

    case "settle":
      if (g.t >= SETTLE_TIME) {
        g.phase = "aim";
        g.t = 0;
        g.angle = 0;
      }
      break;
  }
}

/** Rows either side of Elmer whose moving shelves are kept up to date. */
const MOVE_WINDOW = 24;

/**
 * Slide the moving shelves to where they are now, and carry Elmer along if he
 * is standing on one. Positions are a pure function of `elapsed`, so a replay
 * is exact and nothing accumulates drift.
 */
function movePlatforms(g: TaterState): void {
  const row = Math.round(heightRows(g));
  const standing = g.elmer.standing;
  for (let r = Math.max(1, row - MOVE_WINDOW); r <= row + MOVE_WINDOW; r++) {
    const list = g.byRow.get(r);
    if (!list) continue;
    for (const p of list) {
      if (!p.move) continue;
      const nx = platformX(p, g.elapsed);
      if (standing === p.id) g.elmer.x += nx - p.x;
      p.x = nx;
    }
  }
}

/**
 * Held too long. Mixey blows his top, Elmer is thrown off the shelf and falls
 * past the next KNOCKDOWN_ROWS rows before anything can catch him.
 */
function explode(g: TaterState): void {
  const e = g.elmer;
  const p = e.standing != null ? platformById(g, e.standing) : undefined;
  const from = p ? p.row : Math.max(0, Math.round(heightRows(g)));
  const to = Math.max(0, from - KNOCKDOWN_ROWS);
  g.fizz -= FIZZ_PER_BLAST;
  g.explosions++;
  g.dropTo = to;
  g.events.push({ kind: "explode", x: e.x, y: e.y, rows: from - to });
  // Popped up and away from the middle, so he clears the shelf he was on.
  const away = e.x < W / 2 ? 1 : -1;
  e.vx = away * 110;
  e.vy = -240;
  e.standing = null;
  e.y -= 1;
  g.power = 0;
  g.phase = "flight";
  g.t = 0;
}

function launch(g: TaterState): void {
  const { vx, vy } = velocityFor(g.lockedAngle, g.lockedPower);
  g.elmer.vx = vx;
  g.elmer.vy = vy;
  g.elmer.standing = null;
  g.fizz -= FIZZ_PER_BLAST;
  g.blasts++;
  g.phase = "flight";
  g.t = 0;
  // Lift him clear of the shelf he is leaving, or the very first substep sees
  // his feet still touching it and lands him again where he started.
  g.elmer.y -= 1;
  g.events.push({ kind: "blast", angle: g.lockedAngle, power: g.lockedPower });
  build(g, g.maxRow + BUILD_AHEAD);
}

function integrate(g: TaterState, h: number): void {
  const e = g.elmer;
  const px = e.x;
  const py = e.y;

  e.vy = Math.min(MAX_FALL, e.vy + GRAVITY * h);
  e.x += e.vx * h;
  e.y += e.vy * h;

  // ── Walls ────────────────────────────────────────────────────────────────
  const half = ELMER_W / 2;
  if (e.x - half < 0) {
    e.x = half;
    if (e.vx < 0) {
      e.vx = -e.vx * WALL_BOUNCE;
      g.events.push({ kind: "wall", x: 0, y: e.y, speed: Math.abs(e.vx) });
    }
  } else if (e.x + half > W) {
    e.x = W - half;
    if (e.vx > 0) {
      e.vx = -e.vx * WALL_BOUNCE;
      g.events.push({ kind: "wall", x: W, y: e.y, speed: Math.abs(e.vx) });
    }
  }

  collide(g, px, py);
}

/**
 * Elmer against the shelves, having already moved.
 *
 * SHELVES ARE ONE-WAY. He passes up through them and only ever collides with
 * the top surface, coming down. That is the standard of the genre — Ice
 * Climber's ledges, and everything since — and here it is not a convenience,
 * it is what makes the game playable at all.
 *
 * The first cut had them solid on all four sides, which is the obvious reading
 * of "they bounce off of walls and platforms". Measured, it was brutal: with
 * two or three shelves on a row and a blast that climbs nearly three rows, a
 * shot aimed at anything worth reaching spent its rise cracking its head on the
 * underside of the shelf below the one it wanted. A bot playing perfectly
 * landed above its own row in about one blast in twenty.
 *
 * Walls still bounce — that is in `integrate`, and the bank shot off the side
 * of the shaft is the game's best move. It is only the shelves that let him by.
 */
function collide(g: TaterState, px: number, py: number): void {
  const e = g.elmer;
  const half = ELMER_W / 2;

  // Only ever on the way down. Rising through a shelf is free.
  if (e.vy <= 0) return;

  // A shelf he could have crossed has its surface between where his feet were
  // and where they are, and row r's surface is exactly -r * ROW_GAP — so the
  // handful of rows worth testing can be named rather than searched for.
  const rLo = Math.floor(-e.y / ROW_GAP);
  const rHi = Math.ceil(-py / ROW_GAP);

  for (let r = rLo; r <= rHi; r++) {
    const list = g.byRow.get(r);
    if (!list) continue;
    // Knocked down: shelves above the target row let him fall straight past.
    if (g.dropTo !== null && r > g.dropTo) continue;
    for (const p of list) {
      if (!(e.x + half > p.x && e.x - half < p.x + p.w)) continue;
      // His feet were above this surface a substep ago and are through it now.
      if (!(py <= p.y && e.y >= p.y)) continue;

      e.y = p.y;
      if (Math.abs(e.vy) > LAND_SPEED) {
        // Too fast to stick. One bounce, and it comes back down slower.
        g.events.push({ kind: "bounce", x: e.x, y: p.y, speed: Math.abs(e.vy) });
        e.vy = -Math.abs(e.vy) * PLATFORM_BOUNCE;
        e.y -= 1;
        return;
      }
      land(g, p);
      return;
    }
  }
}

function land(g: TaterState, p: Platform): void {
  const e = g.elmer;
  g.dropTo = null;
  e.vy = 0;
  e.standing = p.id;
  g.phase = "slide";
  g.t = 0;
  g.events.push({ kind: "land", platformId: p.id, row: p.row, speed: Math.abs(e.vx) });
  if (Math.abs(e.vx) < REST_SPEED) rest(g, p);
}

/** Friction along a shelf, and the chance of sliding straight off the end. */
function slide(g: TaterState, h: number): void {
  const e = g.elmer;
  const p = e.standing != null ? platformById(g, e.standing) : undefined;
  if (!p) {
    g.phase = "flight";
    e.standing = null;
    return;
  }

  const drag = SLIDE_FRICTION * h;
  if (Math.abs(e.vx) <= drag) e.vx = 0;
  else e.vx -= Math.sign(e.vx) * drag;
  e.x += e.vx * h;

  const half = ELMER_W / 2;
  if (e.x - half < 0) { e.x = half; e.vx = -e.vx * WALL_BOUNCE; }
  else if (e.x + half > W) { e.x = W - half; e.vx = -e.vx * WALL_BOUNCE; }

  // Off the end. His feet leave the shelf and gravity takes over — no ledge
  // grab, no snap back. Sliding off the edge of a shelf you just made is one of
  // the two things this game is actually about.
  if (e.x < p.x || e.x > p.x + p.w) {
    e.standing = null;
    g.phase = "flight";
    return;
  }

  if (Math.abs(e.vx) < REST_SPEED) {
    e.vx = 0;
    rest(g, p);
  }
}

/**
 * Standing still on a shelf. Everything a landing is worth is paid out here.
 *
 * On coming to REST, not on touching down, and the difference is the design:
 * skimming a shelf on the way past is not landing on it. Handing out Allie's
 * bonus for a graze would also fire her cutscene mid-flight.
 */
function rest(g: TaterState, p: Platform): void {
  g.phase = "settle";
  g.t = 0;
  // A probe only ever wanted to know WHERE it stopped.
  if (g.probe) return;
  g.events.push({ kind: "rest", platformId: p.id, row: p.row });

  if (p.row > g.maxRow) {
    const gained = Math.min(FIZZ_REFUND_MAX, (p.row - g.maxRow) * FIZZ_PER_NEW_ROW);
    g.maxRow = p.row;
    g.fizz = Math.min(FIZZ_MAX, g.fizz + gained);
    g.events.push({ kind: "height", row: p.row });

    const zone = zoneIndexForRow(p.row);
    if (zone > g.maxZone) {
      g.maxZone = zone;
      g.bonus += SCORE_NEW_ZONE;
      g.fizz = Math.min(FIZZ_MAX, g.fizz + FIZZ_PER_ZONE);
      g.events.push({ kind: "zone", index: zone });
    }
    build(g, g.maxRow + BUILD_AHEAD);
  }

  if (p.item && !p.spent) {
    const centreX = p.x + p.w / 2;
    switch (p.item.kind) {
      case "mixer":
        g.mixers++;
        g.fizz = Math.min(FIZZ_MAX, g.fizz + FIZZ_PER_MIXER);
        g.bonus += SCORE_MIXER;
        g.events.push({ kind: "pickup", id: p.item.id, x: centreX, y: p.y });
        p.spent = true;
        p.item = null;
        break;

      case "bottle":
        // No mixer, no drink. The bottle stays put and can be come back for,
        // which is the only reason to ever climb back DOWN the shaft.
        if (g.mixers > 0) {
          g.mixers--;
          g.bonus += SCORE_MATCH;
          g.events.push({ kind: "match", id: p.item.id, x: centreX, y: p.y });
          p.spent = true;
          p.item = null;
        }
        break;

      case "allie":
        g.bonus += SCORE_ALLIE;
        g.events.push({ kind: "allie", platformId: p.id, x: centreX, y: p.y });
        p.spent = true;
        p.item = null;
        // Tater is on his way. The renderer plays it out and calls endScene.
        g.phase = "scene";
        break;

      case "guillermo":
        break;

      case "tater": {
        const bonus = SCORE_SHOWDOWN * g.lap;
        g.bonus += bonus;
        g.events.push({ kind: "showdown", zone: zoneIndexForRow(p.row), lap: g.lap, bonus, y: p.y });
        p.spent = true;
        p.item = null;
        g.phase = "scene";
        break;
      }

      case "summit": {
        const bottle = summitBottleFor(g.lap);
        const bonus = g.lap === 1 ? SCORE_RESCUE : SCORE_SUMMIT_PER_LAP * g.lap;
        g.bonus += bonus;
        g.events.push({ kind: "summit", lap: g.lap, bottle, bonus, y: p.y });
        // The shelf is not spent: the renderer needs Tater standing on it until
        // the finale is over, and nextLap throws the whole shaft away anyway.
        g.phase = "scene";
        break;
      }
    }
  }

  // ── Out of fizz ──────────────────────────────────────────────────────────
  // Checked here and nowhere else: the run ends when Elmer is STANDING with an
  // empty can, never in mid-air. Ending it during a flight would cut away from
  // a blast the player had already paid for, and — since a landing can hand
  // fizz back for a new height or a mixer — would sometimes end a run that the
  // very next shelf was about to save.
  if (g.fizz <= 0 && g.phase !== "scene") {
    g.over = true;
    g.phase = "over";
    g.events.push({ kind: "flat" });
  }
}

/** Drain the events the renderer has not read yet. */
export function drainEvents(g: TaterState): TaterEvent[] {
  const out = g.events;
  g.events = [];
  return out;
}

// ─── Where a blast would land ────────────────────────────────────────────────

/**
 * Fly the shot without touching the game state.
 *
 * Used by the attract-mode bot to choose a shot, and by the test to prove the
 * shaft is climbable. Runs the SAME integration the real thing does, walls and
 * shelves included, so what it predicts is what happens — a simplified
 * ballistic estimate would have been much shorter and would have quietly
 * disagreed with the game about every bank shot.
 */
export function simulateBlast(
  g: TaterState,
  angle: number,
  power: number,
  fromX: number,
  fromY: number,
  maxSeconds = 5
): { x: number; y: number; row: number | null; platformId: number | null } {
  const { vx, vy } = velocityFor(angle, power);
  // The shelves are shared BY REFERENCE, which is safe only because a probe
  // returns early from `rest` and so can never mark one spent. Copying them
  // was the honest version and cost four hundred object clones per candidate
  // shot, a hundred shots a turn.
  const probe: TaterState = {
    ...g,
    elmer: { x: fromX, y: fromY - 1, vx, vy, facing: 1, standing: null },
    phase: "flight",
    events: [],
    probe: true,
  };

  const steps = Math.floor(maxSeconds / SUBSTEP);
  for (let i = 0; i < steps; i++) {
    if (probe.phase === "flight") integrate(probe, SUBSTEP);
    else if (probe.phase === "slide") slide(probe, SUBSTEP);
    else break;
  }

  const id = probe.elmer.standing;
  const p = id != null ? g.byId.get(id) : undefined;
  return { x: probe.elmer.x, y: probe.elmer.y, row: p ? p.row : null, platformId: id ?? null };
}

/**
 * The best shot the bot can find from where it is standing.
 *
 * A coarse sweep of the whole envelope — every shot is actually flown — scored
 * on how much height it gains, with a shove toward anything carrying a mixer or
 * a bottle it can pay for. Coarse on purpose: a bot that solved the shaft
 * exactly would climb in a straight line and demo mode would look like a
 * cutscene rather than like somebody playing.
 */
export function bestShot(g: TaterState): { angle: number; power: number } | null {
  const from = g.elmer;
  let best: { angle: number; power: number; value: number } | null = null;

  for (let a = -7; a <= 7; a++) {
    const angle = (a / 7) * AIM_MAX;
    for (let p = 3; p <= 10; p++) {
      const power = p / 10;
      const hit = simulateBlast(g, angle, power, from.x, from.y);
      if (hit.row == null) continue;
      let value = hit.row * 10;
      const plat = hit.platformId != null ? g.platforms.find((q) => q.id === hit.platformId) : undefined;
      if (plat?.item?.kind === "mixer") value += 25;
      if (plat?.item?.kind === "bottle" && g.mixers > 0) value += 30;
      if (plat?.item?.kind === "allie") value += 60;
      if (plat?.item?.kind === "summit") value += 400;
      if (plat?.item?.kind === "tater") value += 200;
      if (!best || value > best.value) best = { angle, power, value };
    }
  }

  return best ? { angle: best.angle, power: best.power } : null;
}
