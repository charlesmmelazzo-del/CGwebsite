// ─── Behind the Stick — the micro games ──────────────────────────────────────
//
// WarioWare interruptions that cut into a build: a word flashes up, the player
// gets a few seconds, and it's SUCCESS or FAIL. They never end a run — they're
// big points either way.
//
// Each one is a small pure simulation fed pointer positions in logical units
// (the whole screen is theirs while they run) and stepped by `update`, which
// returns "win" or "lose" on the frame it's decided. The view reads the fields
// to draw; nothing in here knows about a canvas.

import { H } from "./constants";

export type MicroKind = "beer" | "shots" | "pop";
export type MicroOutcome = "win" | "lose" | null;

export const MICRO_KINDS: MicroKind[] = ["beer", "shots", "pop"];

/** The words that flash up before each one. */
export const MICRO_TITLE: Record<MicroKind, string> = {
  beer: "GIMME A BEER!",
  shots: "LET'S DO SHOTS!",
  pop: "POP IT!",
};

/** The one-line instruction under the title. */
export const MICRO_HINT: Record<MicroKind, string> = {
  beer: "HOLD HIGHER TO TILT. DON'T FOAM OVER THE LINE!",
  shots: "GRAB THE BOTTLE! POUR THE SHOTS!",
  pop: "TAP TO POP. HIT THE BUCKET, NOT A GUEST!",
};

interface Base {
  t: number;
  duration: number;
  outcome: MicroOutcome;
}

// ─── GIMME A BEER ────────────────────────────────────────────────────────────
//
// The higher the thumb, the further the bottle tips. Tip it gently and the
// glass fills clean; slam it and the foam climbs past the line.

export const BEER_TARGET = 0.72;
export const BEER_LINE = 0.92;

export interface BeerSim extends Base {
  kind: "beer";
  /** 0 upright .. 1 upside down. Chases `aim`, so a slam still takes a moment. */
  tilt: number;
  aim: number;
  /** Fractions of the glass. */
  liquid: number;
  foam: number;
  pointer: number | null;
}

export function newBeer(level: number): BeerSim {
  return {
    kind: "beer",
    t: 0,
    duration: Math.max(5, 6.5 - 0.12 * (level - 1)),
    outcome: null,
    tilt: 0,
    aim: 0,
    liquid: 0,
    foam: 0,
    pointer: null,
  };
}

/** Where on the screen a thumb has to be for a given tilt. */
export function beerAimFor(y: number): number {
  return Math.max(0, Math.min(1, (H - 40 - y) / (H - 100)));
}

export function beerFlow(tilt: number): { flow: number; foam: number } {
  const p = Math.max(0, (tilt - 0.15) / 0.85);
  const flow = 0.42 * p;
  return { flow, foam: flow * (0.06 + 3 * Math.max(0, p - 0.55)) };
}

function updateBeer(s: BeerSim, dt: number): MicroOutcome {
  const rate = 6 * dt;
  s.tilt += Math.max(-rate, Math.min(rate, s.aim - s.tilt));
  const { flow, foam } = beerFlow(s.tilt);
  // Foam settles, and some of it turns back into beer as it does.
  const settle = Math.min(s.foam, s.foam * 0.1 * dt);
  s.foam += foam * dt - settle;
  s.liquid += flow * dt + settle * 0.3;
  if (s.liquid + s.foam > BEER_LINE) return "lose";
  if (s.liquid >= BEER_TARGET) return "win";
  return null;
}

// ─── LET'S DO SHOTS ──────────────────────────────────────────────────────────
//
// The bottle stands on the bar until a thumb grabs it. Held, it tips upside
// down and pours through its speed pourer, following the thumb; let go and it
// goes back down where it is. Liquor that isn't going into a glass with room in
// it is on the bar.

export const SHOT_MOUTH = 16;
export const SHOT_POUR = 1.1;
export const SHOT_FULL = 0.85;
export const SHOT_SPILL_MAX = 1;
export const SHOT_BOTTLE_SPEED = 900;
/** How close to the standing bottle a tap has to be to pick it up. */
export const SHOT_GRAB_RADIUS = 60;
/** Where the standing bottle's middle is, from the top. */
export const SHOT_REST_Y = H - 100;

export interface ShotsSim extends Base {
  kind: "shots";
  glasses: { x: number; fill: number }[];
  bottleX: number;
  targetX: number;
  /** In a thumb, tipped over and pouring. */
  pouring: boolean;
  /** Has it been picked up yet — the prompt stays until it has. */
  grabbed: boolean;
  spill: number;
  pointer: number | null;
  /** Where the stream is landing this frame, for the view: a glass index, or -1 for the bar. */
  landing: number;
}

export function newShots(level: number, w: number): ShotsSim {
  const n = level >= 5 ? 5 : 4;
  const glasses = Array.from({ length: n }, (_, i) => ({ x: (w * (i + 1)) / (n + 1), fill: 0 }));
  const start = Math.max(40, glasses[0].x - 60);
  return {
    kind: "shots",
    t: 0,
    duration: Math.max(5.5, 7.5 - 0.15 * (level - 1)),
    outcome: null,
    glasses,
    bottleX: start,
    targetX: start,
    pouring: false,
    grabbed: false,
    spill: 0,
    pointer: null,
    landing: -1,
  };
}

function updateShots(s: ShotsSim, dt: number): MicroOutcome {
  const step = SHOT_BOTTLE_SPEED * dt;
  s.bottleX += Math.max(-step, Math.min(step, s.targetX - s.bottleX));
  s.landing = -1;
  if (s.pouring) {
    const amount = SHOT_POUR * dt;
    const i = s.glasses.findIndex((g) => Math.abs(g.x - s.bottleX) <= SHOT_MOUTH);
    if (i >= 0) {
      s.landing = i;
      const g = s.glasses[i];
      const room = Math.max(0, 1 - g.fill);
      g.fill += Math.min(room, amount);
      s.spill += Math.max(0, amount - room);
    } else {
      s.spill += amount;
    }
  }
  if (s.spill > SHOT_SPILL_MAX) return "lose";
  if (s.glasses.every((g) => g.fill >= SHOT_FULL)) return "win";
  return null;
}

// ─── POP IT ──────────────────────────────────────────────────────────────────
//
// The bottle sways. One tap fires the cork along whatever way it's pointing.
// Land it in the ice bucket; anywhere near a guest is a bonk.

export const POP_PIVOT_DY = 22;
export const POP_TARGET_Y = 76;
export const POP_MAX_ANGLE = 1;
export const POP_FLIGHT = 0.35;
export const POP_BUCKET_HALF = 34;
export const POP_GUEST_HALF = 30;
const POP_SLOTS = 5;

export interface PopSim extends Base {
  kind: "pop";
  w: number;
  swaySpeed: number;
  phase: number;
  angle: number;
  /** Slot index of the bucket; the other slots hold guests. */
  bucketSlot: number;
  /** Bucket drifts from level 4. */
  bucketDrift: number;
  bucketX: number;
  guests: number[];
  /** Set when the cork has been fired. */
  cork: { angle: number; t: number; landX: number } | null;
  /** Which guest was bonked, for the view. */
  bonked: number | null;
}

export function popSlotX(w: number, slot: number): number {
  const spread = Math.min(w * 0.38, 250);
  return w / 2 + ((slot - (POP_SLOTS - 1) / 2) / ((POP_SLOTS - 1) / 2)) * spread;
}

export function newPop(level: number, w: number, rand: () => number): PopSim {
  const bucketSlot = Math.floor(rand() * POP_SLOTS);
  const guests: number[] = [];
  for (let i = 0; i < POP_SLOTS; i++) if (i !== bucketSlot) guests.push(popSlotX(w, i));
  return {
    kind: "pop",
    t: 0,
    duration: Math.max(4, 5 - 0.08 * (level - 1)),
    outcome: null,
    w,
    swaySpeed: Math.min(4.2, 2.4 + 0.15 * (level - 1)),
    phase: rand() * Math.PI * 2,
    angle: 0,
    bucketSlot,
    bucketDrift: level >= 4 ? 40 : 0,
    bucketX: popSlotX(w, bucketSlot),
    guests,
    cork: null,
    bonked: null,
  };
}

/** Where a cork fired at `angle` crosses the guests' line. */
export function popLandX(w: number, angle: number): number {
  return w / 2 + Math.tan(angle) * (H - POP_PIVOT_DY - POP_TARGET_Y);
}

function updatePop(s: PopSim, dt: number): MicroOutcome {
  if (!s.cork) {
    s.angle = Math.sin(s.t * s.swaySpeed + s.phase) * POP_MAX_ANGLE;
    s.bucketX = popSlotX(s.w, s.bucketSlot) + Math.sin(s.t * 1.7) * s.bucketDrift;
    return null;
  }
  s.cork.t += dt;
  if (s.cork.t < POP_FLIGHT) return null;
  const x = s.cork.landX;
  if (Math.abs(x - s.bucketX) <= POP_BUCKET_HALF) return "win";
  const hit = s.guests.findIndex((g) => Math.abs(g - x) <= POP_GUEST_HALF);
  if (hit >= 0) s.bonked = hit;
  return "lose";
}

// ─── Shared ──────────────────────────────────────────────────────────────────

export type MicroSim = BeerSim | ShotsSim | PopSim;

export function newMicro(kind: MicroKind, level: number, w: number, rand: () => number): MicroSim {
  if (kind === "beer") return newBeer(level);
  if (kind === "shots") return newShots(level, w);
  return newPop(level, w, rand);
}

/** Step a micro game. Returns the outcome on the frame it's decided, once. */
export function updateMicro(s: MicroSim, dt: number): MicroOutcome {
  if (s.outcome) return null;
  s.t += dt;
  let out: MicroOutcome;
  if (s.kind === "beer") out = updateBeer(s, dt);
  else if (s.kind === "shots") out = updateShots(s, dt);
  else out = updatePop(s, dt);
  // Out of time. A cork already in the air gets to land first.
  if (!out && s.t >= s.duration && !(s.kind === "pop" && s.cork)) out = "lose";
  if (out) s.outcome = out;
  return out;
}

export function microPress(s: MicroSim, x: number, y: number, id: number): void {
  if (s.outcome) return;
  if (s.kind === "beer") {
    s.pointer = id;
    s.aim = beerAimFor(y);
  } else if (s.kind === "shots") {
    // Only a tap on the bottle picks it up. Pouring starts in the hand.
    if (s.pointer !== null) return;
    if (Math.abs(x - s.bottleX) > SHOT_GRAB_RADIUS || Math.abs(y - SHOT_REST_Y) > SHOT_GRAB_RADIUS * 1.5) return;
    s.pointer = id;
    s.targetX = x;
    s.pouring = true;
    s.grabbed = true;
  } else if (!s.cork) {
    s.cork = { angle: s.angle, t: 0, landX: popLandX(s.w, s.angle) };
  }
}

export function microMove(s: MicroSim, x: number, y: number, id: number): void {
  if (s.outcome) return;
  if (s.kind === "beer" && s.pointer === id) s.aim = beerAimFor(y);
  else if (s.kind === "shots" && s.pointer === id) s.targetX = x;
}

export function microRelease(s: MicroSim, id: number): void {
  if (s.kind === "beer" && s.pointer === id) {
    s.pointer = null;
    s.aim = 0;
  } else if (s.kind === "shots" && s.pointer === id) {
    s.pointer = null;
    s.pouring = false;
  }
}
