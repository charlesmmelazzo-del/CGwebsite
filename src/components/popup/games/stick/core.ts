// ─── Behind the Stick — rules ────────────────────────────────────────────────
//
// The whole simulation, with no React and no canvas. The component owns
// drawing and listening; everything that decides a score, a strike, who holds
// the phone or when the run is over lives here, so the tests can step it frame
// by frame (a hidden browser tab throttles requestAnimationFrame to nothing).
//
// THE LOOP
//
//   GRAB (both thumbs)   card: "grab the colour bottles!", then bottles and
//     ↓                  junk are tossed up; only the wanted ones are in colour
//   BUILD                card: "let's build the drink!", then bottles slide
//     ↓                  down the bar into the tap zones, bartender reacting
//     ↓                  (micro games cut in and hand back)
//   FINISH               card: "shake it!", the right thumb shakes alone for a
//     ↓                  beat, then card: "order up! grab with your left
//     ↓                  thumb!" and both run at once until the shake's clock
//     ↓                  runs out and the guest gets the drink
//   BUILD → FINISH → BUILD → ... forever, a little faster every drink.
//
// Every new task gets a card, and nothing moves while it's up.
//
// SOLO has three lives. PARTY is a last-one-standing relay: every served
// drink hands the phone to a random teammate who's still in, any strike
// knocks the holder out, and the team's combined score goes on its own board.

import type { Cocktail } from "../cocktails";
import { COCKTAILS, pickCocktail } from "../cocktails";
import * as K from "./constants";
import type { Layout } from "./constants";
import {
  MICRO_KINDS,
  microMove,
  microPress,
  microRelease,
  newMicro,
  updateMicro,
  type MicroKind,
  type MicroSim,
} from "./micro";

export type Mode = "solo" | "party";
export type Stage = "grab" | "build" | "micro" | "finish" | "handoff" | "over";

export interface Player {
  name: string;
  alive: boolean;
  /** This player's share of the team score. */
  points: number;
  drinks: number;
}

// ─── Grab ────────────────────────────────────────────────────────────────────

export type JunkKind = "can" | "glass" | "napkin" | "phone";
export type ItemKind = "bottle" | JunkKind | "vodka" | "jug" | "bomb";

export const JUNK: JunkKind[] = ["can", "glass", "napkin", "phone"];

export interface Flying {
  id: number;
  side: 0 | 1;
  kind: ItemKind;
  /** The ingredient, for a bottle. */
  ing: string | null;
  /** Across the panel, 0..1, so a resize doesn't move anything out of its panel. */
  x: number;
  /** Panel widths a second. */
  vx: number;
  y: number;
  vy: number;
  /** Radians, for a tumble. */
  spin: number;
  spinV: number;
}

/** Which words the card at the top of a grab says. */
export type GrabCard = "fresh" | "left" | "retry" | "turn";

export interface Grab {
  /**
   * Not started yet: the order is picked but the left thumb hasn't been
   * brought in. Only while a finish is in its solo lead.
   */
  pending: boolean;
  /** Seconds of instruction card left. Nothing is tossed and no clock runs while it's up. */
  cardT: number;
  card: GrabCard;
  /** Which panels are in play. Both on a fresh order, the left while finishing. */
  sides: [boolean, boolean];
  items: Flying[];
  spawnT: [number, number];
  sinceNeeded: number;
  got: string[];
  timeLeft: number;
  timeMax: number;
  done: boolean;
  /** A vodka cloud over a panel. */
  stinkT: [number, number];
}

// ─── Build ───────────────────────────────────────────────────────────────────

export type Judgement = "perfect" | "good" | "miss";
export type BartenderMood = "happy" | "worried" | "panic";

export interface Note {
  lane: number;
  /** Build-clock time it reaches the tap zone. */
  t: number;
  judged: Judgement | null;
}

export interface Build {
  /** Seconds of "let's build the drink!" left. The clock waits for it. */
  cardT: number;
  clock: number;
  travel: number;
  notes: Note[];
  hits: number;
  misses: number;
  combo: number;
  bestCombo: number;
  /** Build-clock times micro games cut in, soonest first. */
  microAt: number[];
  /** Last press per lane, in build-clock time, for the button flash. */
  pressedAt: number[];
  /** The bartender in the middle, reacting. */
  mood: BartenderMood;
  moodT: number;
  /** Bottles tossed into the tin; drives a little bounce on it. */
  tossed: number;
}

// ─── Micro ───────────────────────────────────────────────────────────────────

export interface Micro {
  kind: MicroKind;
  phase: "intro" | "play" | "result" | "resume";
  t: number;
  sim: MicroSim;
  won: boolean;
}

// ─── Finish ──────────────────────────────────────────────────────────────────

export interface Finish {
  cocktail: Cocktail;
  /** Seconds of "shake it!" card left. Input doesn't count while it's up. */
  cardT: number;
  /** Seconds of play since the card. Keeps running after the result, to time the next grab. */
  clock: number;
  meter: number;
  /** Seconds spent under the line. */
  slowFor: number;
  /** null while working, then how it went. */
  result: "served" | "ruined" | null;
  /** Seconds since `result` was set. */
  resultT: number;
  /** Party: this served drink has already passed the phone. */
  passed: boolean;
  pointer: number | null;
  // Shake
  strokes: number;
  dir: -1 | 0 | 1;
  extreme: number;
  /** Where the tin is drawn, 0 top .. 1 bottom of its travel. */
  tinY: number;
  // Stir
  lastAngle: number | null;
  /** Net turns, signed by direction. */
  revs: number;
  /** Furthest the net turn has reached, either way. */
  stirBest: number;
}

// ─── Handoff ─────────────────────────────────────────────────────────────────

export interface Handoff {
  reason: "start" | "served" | "out";
  /** Who just lost the phone (null at the start). */
  from: number | null;
  to: number;
  t: number;
  /** Where play picks up. */
  resume: "grab" | "finish";
}

// ─── Effects the view animates ───────────────────────────────────────────────

export type FxKind = "grab" | "boom" | "shatter" | "stink" | "splash" | "sparkle" | "word" | "toss";

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
  /** Where a toss lands. */
  tx?: number;
  ty?: number;
  t: number;
  dur: number;
  text?: string;
  color?: string;
  ing?: string;
}

export interface Banner {
  text: string;
  t: number;
  dur: number;
  color: string;
}

export interface State {
  mode: Mode;
  layout: Layout;
  rand: () => number;
  /** Attract mode: no micro games, since the bot can't read them. */
  demo: boolean;

  stage: Stage;
  stageT: number;
  t: number;

  score: number;
  lives: number;
  players: Player[];
  current: number;
  served: number;

  /** The order being grabbed or built. */
  order: Cocktail;
  grab: Grab;
  build: Build | null;
  micro: Micro | null;
  lastMicro: MicroKind | null;
  microWins: number;
  microLosses: number;
  finish: Finish | null;
  handoff: Handoff | null;

  strikes: number;
  lastStrike: string;
  fx: Fx[];
  banner: Banner | null;
  shakeT: number;
  flash: { color: string; t: number } | null;
  nextId: number;
  /** Pointer id → what it went down on, for drags that must stay put. */
  pointers: Map<number, "finish" | "micro" | "lane">;
}

export interface Options {
  mode?: Mode;
  names?: string[];
  w?: number;
  rand?: () => number;
  demo?: boolean;
}

/** Whether the order being grabbed calls for this ingredient. */
export function wants(st: State, ing: string): boolean {
  return (st.order.recipe as readonly string[]).includes(ing);
}

/** Whether a flying thing is one the player should tap — the only ones drawn in colour. */
export function isWanted(st: State, it: Flying): boolean {
  return it.kind === "bottle" && !!it.ing && wants(st, it.ing) && !st.grab.got.includes(it.ing);
}

export function level(st: State): number {
  return st.served + 1;
}

export function freshState(opts: Options = {}): State {
  const rand = opts.rand ?? Math.random;
  const mode = opts.mode ?? "solo";
  const names = mode === "party" ? (opts.names ?? []).slice(0, K.MAX_PLAYERS) : ["YOU"];
  const order = COCKTAILS[Math.floor(rand() * COCKTAILS.length)];
  const st: State = {
    mode,
    layout: K.layoutFor(opts.w ?? K.W_REF),
    rand,
    demo: opts.demo ?? false,
    stage: "grab",
    stageT: 0,
    t: 0,
    score: 0,
    lives: K.SOLO_LIVES,
    players: names.map((name) => ({ name, alive: true, points: 0, drinks: 0 })),
    current: 0,
    served: 0,
    order,
    grab: newGrab(1, true, "fresh"),
    build: null,
    micro: null,
    lastMicro: null,
    microWins: 0,
    microLosses: 0,
    finish: null,
    handoff: null,
    strikes: 0,
    lastStrike: "",
    fx: [],
    banner: null,
    shakeT: 0,
    flash: null,
    nextId: 1,
    pointers: new Map(),
  };
  if (mode === "party" && st.players.length > 0) {
    const first = Math.floor(rand() * st.players.length);
    st.current = first;
    st.handoff = { reason: "start", from: null, to: first, t: 0, resume: "grab" };
    st.stage = "handoff";
  }
  return st;
}

/** Keep playing on a new width — only the panels' pixel edges change. */
export function setWidth(st: State, w: number): void {
  if (w !== st.layout.w) st.layout = K.layoutFor(w);
}

const CARD_SECONDS: Record<GrabCard, number> = {
  fresh: K.GRAB_CARD,
  left: K.GRAB_CARD_LEFT,
  retry: K.GRAB_CARD_SHORT,
  turn: K.GRAB_CARD_SHORT,
};

function newGrab(lvl: number, both: boolean, card: GrabCard, pending = false): Grab {
  const time = K.grabTime(lvl, both);
  return {
    pending,
    cardT: CARD_SECONDS[card],
    card,
    sides: [true, both],
    items: [],
    spawnT: [0.15, 0.5],
    sinceNeeded: K.NEEDED_DROUGHT,
    got: [],
    timeLeft: time,
    timeMax: time,
    done: false,
    stinkT: [0, 0],
  };
}

function setStage(st: State, s: Stage) {
  st.stage = s;
  st.stageT = 0;
}

function showBanner(st: State, text: string, color: string, dur = 1.1) {
  st.banner = { text, t: 0, dur, color };
}

function addFx(st: State, fx: Omit<Fx, "t">) {
  st.fx.push({ ...fx, t: 0 });
}

function word(st: State, x: number, y: number, text: string, color: string) {
  addFx(st, { kind: "word", x, y, dur: 0.8, text, color });
}

function addScore(st: State, pts: number) {
  const before = st.score;
  st.score = Math.max(0, st.score + pts);
  const p = st.players[st.current];
  if (p) p.points += st.score - before;
}

function aliveIndexes(st: State): number[] {
  return st.players.map((p, i) => (p.alive ? i : -1)).filter((i) => i >= 0);
}

/** A random teammate still in, never the one handing over unless they're the last. */
function pickNext(st: State, exclude: number): number {
  const alive = aliveIndexes(st);
  const others = alive.filter((i) => i !== exclude);
  const pool = others.length ? others : alive;
  return pool[Math.min(pool.length - 1, Math.floor(st.rand() * pool.length))];
}

// ─── Strikes ─────────────────────────────────────────────────────────────────

/**
 * Something went wrong enough to cost a life.
 *
 * Returns true when the run carries on in place (solo, lives left) so the
 * caller can apply the local consequence; false when the strike took over —
 * a knockout handing the phone on, or the end of the run.
 */
function strike(st: State, reason: string): boolean {
  st.strikes++;
  st.lastStrike = reason;
  st.shakeT = 0.45;
  st.flash = { color: "#E42B20", t: 0 };

  if (st.mode === "solo") {
    st.lives--;
    showBanner(st, reason, "#FF4A3A", 1.2);
    if (st.lives <= 0) {
      endRun(st);
      return false;
    }
    return true;
  }

  const out = st.current;
  st.players[out].alive = false;
  releaseAll(st);
  if (aliveIndexes(st).length === 0) {
    showBanner(st, reason, "#FF4A3A", 1.2);
    endRun(st);
    return false;
  }
  // A knockout scraps whatever was in progress: the next bartender starts
  // clean on a fresh order with both thumbs.
  st.order = pickCocktail(st.order.key, st.rand);
  st.grab = newGrab(level(st), true, "fresh");
  st.build = null;
  st.micro = null;
  st.finish = null;
  st.banner = null;
  const to = pickNext(st, out);
  st.handoff = { reason: "out", from: out, to, t: 0, resume: "grab" };
  setStage(st, "handoff");
  return false;
}

function endRun(st: State) {
  releaseAll(st);
  setStage(st, "over");
}

function releaseAll(st: State) {
  st.pointers.clear();
  if (st.finish) st.finish.pointer = null;
}

// ─── Update ──────────────────────────────────────────────────────────────────

export interface UpdateResult {
  /** True on the one frame the run is over and the score should be reported. */
  finished: boolean;
}

export function update(st: State, dt: number): UpdateResult {
  st.t += dt;
  st.stageT += dt;
  if (st.shakeT > 0) st.shakeT = Math.max(0, st.shakeT - dt);
  if (st.flash) {
    st.flash.t += dt;
    if (st.flash.t > 0.35) st.flash = null;
  }
  if (st.banner) {
    st.banner.t += dt;
    if (st.banner.t > st.banner.dur) st.banner = null;
  }
  for (const f of st.fx) f.t += dt;
  st.fx = st.fx.filter((f) => f.t < f.dur);

  let finished = false;
  switch (st.stage) {
    case "handoff":
      updateHandoff(st, dt);
      break;
    case "grab":
      updateGrab(st, dt);
      if (st.stage === "grab" && st.grab.done) toBuild(st);
      break;
    case "build":
      updateBuild(st, dt);
      break;
    case "micro":
      updateMicroStage(st, dt);
      break;
    case "finish":
      updateFinishStage(st, dt);
      break;
    case "over":
      // Once, on the frame it crosses.
      finished = st.stageT >= K.OVER_SECONDS && st.stageT - dt < K.OVER_SECONDS;
      break;
  }
  return { finished };
}

function updateHandoff(st: State, dt: number) {
  const h = st.handoff;
  if (!h) return setStage(st, "grab");
  h.t += dt;
  if (h.t >= K.HANDOFF_SECONDS) beginTurn(st);
}

function beginTurn(st: State) {
  const h = st.handoff;
  if (!h) return;
  st.current = h.to;
  st.handoff = null;
  setStage(st, h.resume);
  const lastOne = aliveIndexes(st).length === 1 && st.players.length > 1;
  if (lastOne && h.reason === "out") showBanner(st, "LAST ONE STANDING!", "#FFD500", 1.6);
  // Someone picking up a grab halfway gets their own beat to see what's wanted.
  if (h.resume === "finish" && !st.grab.pending && !st.grab.done) {
    st.grab.cardT = K.GRAB_CARD_SHORT;
    st.grab.card = "turn";
  }
}

// ── Grab ──

function neededLeft(st: State): string[] {
  return st.order.recipe.filter((k) => !st.grab.got.includes(k));
}

function pickSpawn(st: State): { kind: ItemKind; ing: string | null } {
  const g = st.grab;
  const lvl = level(st);
  const need = neededLeft(st);
  if (need.length && g.sinceNeeded >= K.NEEDED_DROUGHT) {
    return { kind: "bottle", ing: need[Math.floor(st.rand() * need.length)] };
  }
  const bomb = Math.min(0.12, 0.03 + 0.01 * lvl);
  const table: [number, () => { kind: ItemKind; ing: string | null }][] = [
    [need.length ? 0.36 : 0, () => ({ kind: "bottle", ing: need[Math.floor(st.rand() * need.length)] })],
    [0.24, () => ({ kind: "bottle", ing: decoy(st) })],
    [0.24, () => ({ kind: JUNK[Math.floor(st.rand() * JUNK.length)], ing: null })],
    [0.12, () => ({ kind: st.rand() < 0.6 ? "vodka" : "jug", ing: null })],
    [bomb, () => ({ kind: "bomb", ing: null })],
  ];
  const total = table.reduce((a, [w]) => a + w, 0);
  let r = st.rand() * total;
  for (const [w, make] of table) {
    if (r < w) return make();
    r -= w;
  }
  return { kind: "can", ing: null };
}

/** A bottle this drink doesn't use — or one it already has. */
function decoy(st: State): string {
  const pool = Array.from(new Set(COCKTAILS.flatMap((c) => c.recipe))).filter(
    (k) => !neededLeft(st).includes(k)
  );
  return pool[Math.floor(st.rand() * pool.length)] ?? "ice";
}

/** Toss something up from below the panel. It peaks somewhere in the top half and falls back. */
function spawn(st: State, side: 0 | 1) {
  const { kind, ing } = pickSpawn(st);
  const g = st.grab;
  if (kind === "bottle" && ing && wants(st, ing) && !g.got.includes(ing)) g.sinceNeeded = 0;
  const grav = K.gravity(level(st));
  const startY = K.H + K.ITEM_H / 2;
  const apex = 50 + st.rand() * 110;
  const x = 0.2 + st.rand() * 0.6;
  // Drift toward the middle of the panel so nothing sails off its edge.
  const vx = (0.5 - x) * (0.12 + st.rand() * 0.12);
  g.items.push({
    id: st.nextId++,
    side,
    kind,
    ing,
    x,
    vx,
    y: startY,
    vy: -Math.sqrt(2 * grav * (startY - apex)),
    spin: 0,
    spinV: kind === "bottle" ? (st.rand() - 0.5) * 1.2 : (st.rand() - 0.5) * 5,
  });
}

function updateGrab(st: State, dt: number) {
  const g = st.grab;
  if (g.done || g.pending) return;
  if (g.cardT > 0) {
    g.cardT = Math.max(0, g.cardT - dt);
    return;
  }
  g.stinkT = [Math.max(0, g.stinkT[0] - dt), Math.max(0, g.stinkT[1] - dt)];
  g.sinceNeeded += dt;

  for (const side of [0, 1] as const) {
    if (!g.sides[side]) continue;
    g.spawnT[side] -= dt;
    if (g.spawnT[side] <= 0) {
      spawn(st, side);
      g.spawnT[side] = K.spawnGap(level(st)) * (0.75 + st.rand() * 0.5);
    }
  }
  const grav = K.gravity(level(st));
  for (const it of g.items) {
    it.vy += grav * dt;
    it.y += it.vy * dt;
    it.x = Math.max(0.1, Math.min(0.9, it.x + it.vx * dt));
    it.spin += it.spinV * dt;
  }
  g.items = g.items.filter((it) => it.vy < 0 || it.y < K.H + K.ITEM_H);

  g.timeLeft -= dt;
  if (g.timeLeft <= 0) {
    if (strike(st, "TOO SLOW!")) {
      st.order = pickCocktail(st.order.key, st.rand);
      st.grab = newGrab(level(st), g.sides[1], "retry");
    }
  }
}

/** A tap on a thumb panel while things are flying. */
function tapGrab(st: State, side: 0 | 1, x: number, y: number) {
  const g = st.grab;
  if (g.done || g.pending || g.cardT > 0 || !g.sides[side]) return;
  const l = st.layout;
  const px = K.panelX(l, side);
  let best: Flying | null = null;
  let bestD = K.TAP_RADIUS;
  for (const it of g.items) {
    if (it.side !== side || it.y > K.H) continue;
    const d = Math.hypot(px + it.x * l.side - x, it.y - y);
    // A wanted bottle wins a close call: a thumb on the colour one means it.
    const bias = isWanted(st, it) ? 8 : 0;
    if (d - bias <= bestD) {
      best = it;
      bestD = d - bias;
    }
  }
  if (!best) return;
  const it = best;
  const ix = px + it.x * l.side;
  g.items = g.items.filter((o) => o !== it);

  switch (it.kind) {
    case "bottle": {
      const ing = it.ing ?? "";
      if (wants(st, ing) && !g.got.includes(ing)) {
        g.got.push(ing);
        addScore(st, K.PTS_GRAB);
        addFx(st, { kind: "grab", x: ix, y: it.y, dur: 0.45, ing });
        word(st, ix, it.y - 26, "GOT IT", "#9CE800");
        if (g.got.length === st.order.recipe.length) grabComplete(st);
      } else {
        addScore(st, K.PTS_WRONG_BOTTLE);
        g.timeLeft -= K.WRONG_TIME_COST;
        addFx(st, { kind: "splash", x: ix, y: it.y, dur: 0.5, ing });
        word(st, ix, it.y - 26, "WRONG!", "#FF4A3A");
      }
      break;
    }
    case "can":
    case "napkin":
    case "phone":
    case "glass":
      addScore(st, K.PTS_JUNK);
      g.timeLeft -= K.JUNK_TIME_COST;
      st.shakeT = 0.2;
      addFx(st, { kind: it.kind === "glass" ? "shatter" : "splash", x: ix, y: it.y, dur: 0.5 });
      word(st, ix, it.y - 26, it.kind === "glass" ? "OUCH!" : "GROSS!", "#FF4A3A");
      break;
    case "vodka":
    case "jug":
      addScore(st, K.PTS_VODKA);
      g.stinkT[side] = K.STINK_SECONDS;
      addFx(st, { kind: "stink", x: ix, y: it.y, dur: K.STINK_SECONDS });
      word(st, ix, it.y - 26, "YUCK!", "#C8D040");
      break;
    case "bomb":
      addFx(st, { kind: "boom", x: ix, y: it.y, dur: 0.7 });
      g.items = g.items.filter((o) => o.side !== side);
      strike(st, "BOOM!");
      break;
  }
}

function grabComplete(st: State) {
  const g = st.grab;
  g.done = true;
  for (const it of g.items) {
    addFx(st, { kind: "sparkle", x: K.panelX(st.layout, it.side) + it.x * st.layout.side, y: it.y, dur: 0.4 });
  }
  g.items = [];
  // A clean order is worth something, and faster is worth more.
  addScore(st, Math.round(20 * Math.max(0, g.timeLeft)));
}

// ── Build ──

/** The rhythm of a build, as phrases — the gaps after each note, in beats. */
export const PHRASES: { beats: number[]; from: number }[] = [
  { beats: [1, 1], from: 1 },
  { beats: [2], from: 1 },
  { beats: [0.5, 1.5], from: 2 },
  { beats: [1.5, 0.5], from: 3 },
  { beats: [0.5, 0.5, 1], from: 3 },
  { beats: [0.75, 0.75, 0.5], from: 4 },
  { beats: [0.5, 0.5, 0.5, 1.5], from: 5 },
  { beats: [1 / 3, 1 / 3, 4 / 3], from: 7 },
];

export function chartFor(lvl: number, rand: () => number): Note[] {
  const count = K.noteCount(lvl);
  const beat = K.beatSeconds(lvl);
  const pool = PHRASES.filter((p) => p.from <= lvl);
  const gaps: number[] = [1, 1];
  let last = -1;
  while (gaps.length < count) {
    let i = Math.floor(rand() * pool.length);
    if (i === last && pool.length > 1) i = (i + 1) % pool.length;
    last = i;
    gaps.push(...pool[i].beats);
  }
  const notes: Note[] = [];
  let t = 0;
  let prev = -1;
  let prev2 = -1;
  for (let n = 0; n < count; n++) {
    let lane = Math.floor(rand() * K.LANES);
    // Never the same lane three times running: that's a drum roll, not a chart.
    if (lane === prev && lane === prev2) lane = (lane + 1 + Math.floor(rand() * 3)) % K.LANES;
    notes.push({ lane, t, judged: null });
    if (rand() < K.chordChance(lvl)) {
      // A partner on the other thumb, so the two presses are two hands.
      const other = lane < 2 ? 2 + Math.floor(rand() * 2) : Math.floor(rand() * 2);
      notes.push({ lane: other, t, judged: null });
    }
    prev2 = prev;
    prev = lane;
    t += Math.max(0.3, gaps[n] * beat);
  }
  return notes;
}

function toBuild(st: State) {
  const lvl = level(st);
  const travel = K.travelTime(lvl);
  const notes = chartFor(lvl, st.rand);
  const lead = K.BUILD_LEAD + travel;
  for (const n of notes) n.t += lead;
  const end = notes[notes.length - 1].t;
  const microAt: number[] = [];
  const count = st.demo ? 0 : K.microCount(lvl, st.rand);
  for (let i = 0; i < count; i++) {
    const frac = count === 1 ? 0.35 + st.rand() * 0.3 : i === 0 ? 0.3 : 0.7;
    microAt.push(lead + (end - lead) * frac);
  }
  st.build = {
    cardT: K.BUILD_CARD,
    clock: 0,
    travel,
    notes,
    hits: 0,
    misses: 0,
    combo: 0,
    bestCombo: 0,
    microAt,
    pressedAt: [-9, -9, -9, -9],
    mood: "happy",
    moodT: 0,
    tossed: 0,
  };
  st.finish = null;
  st.banner = null;
  setStage(st, "build");
}

function setMood(b: Build, mood: BartenderMood, hold: number) {
  b.mood = mood;
  b.moodT = hold;
}

function updateBuild(st: State, dt: number) {
  const b = st.build;
  if (!b) return;
  if (b.cardT > 0) {
    b.cardT = Math.max(0, b.cardT - dt);
    return;
  }
  b.clock += dt;
  if (b.moodT > 0) {
    b.moodT -= dt;
    if (b.moodT <= 0) b.mood = b.misses >= 3 && b.combo < 3 ? "worried" : "happy";
  }

  if (b.microAt.length && b.clock >= b.microAt[0]) {
    b.microAt.shift();
    startMicro(st);
    return;
  }

  for (const n of b.notes) {
    if (!n.judged && b.clock > n.t + K.GOOD_WINDOW) {
      n.judged = "miss";
      b.misses++;
      b.combo = 0;
      setMood(b, b.misses >= 3 ? "panic" : "worried", 0.9);
    }
  }

  const end = b.notes[b.notes.length - 1].t + 0.5;
  if (b.clock < end) return;

  const acc = b.hits / b.notes.length;
  if (acc < K.SEND_BACK_BELOW) {
    st.build = null;
    if (strike(st, "SENT BACK!")) {
      st.order = pickCocktail(st.order.key, st.rand);
      st.grab = newGrab(level(st), true, "fresh");
      setStage(st, "grab");
    }
    return;
  }
  addScore(st, Math.round(K.PTS_BUILD_BONUS * acc));
  startFinish(st);
}

/** Where the tin (or mixing glass) sits on the bar, in front of the bartender. */
export function vesselPos(l: Layout): { x: number; y: number } {
  return { x: l.w / 2 + 64, y: K.H - 54 };
}

function pressLane(st: State, lane: number) {
  const b = st.build;
  if (!b || b.cardT > 0) return;
  b.pressedAt[lane] = b.clock;
  let best: Note | null = null;
  for (const n of b.notes) {
    if (n.judged || n.lane !== lane) continue;
    if (Math.abs(n.t - b.clock) > K.GOOD_WINDOW) continue;
    if (!best || Math.abs(n.t - b.clock) < Math.abs(best.t - b.clock)) best = n;
  }
  const bx = laneButtonX(st.layout, lane);
  if (!best) {
    addScore(st, K.PTS_STRAY);
    word(st, bx, LANE_BUTTON_Y - 50, "OOPS", "#A0A0A0");
    return;
  }
  const perfect = Math.abs(best.t - b.clock) <= K.PERFECT_WINDOW;
  best.judged = perfect ? "perfect" : "good";
  b.hits++;
  b.combo++;
  b.tossed++;
  b.bestCombo = Math.max(b.bestCombo, b.combo);
  setMood(b, "happy", 0.6);
  addScore(st, (perfect ? K.PTS_PERFECT : K.PTS_GOOD) + Math.min(b.combo, K.COMBO_CAP) * K.COMBO_BONUS);
  const v = vesselPos(st.layout);
  addFx(st, { kind: "toss", x: bx, y: LANE_BUTTON_Y, tx: v.x, ty: v.y - 30, dur: 0.45, ing: st.order.recipe[lane] });
  word(st, bx, LANE_BUTTON_Y - 50, perfect ? "PERFECT" : "GOOD", perfect ? "#FFD500" : "#9CE800");
}

/** Where each lane's tap zone sits: two per thumb panel, side by side. */
export const LANE_BUTTON_Y = K.H - 62;

export function laneButtonX(l: Layout, lane: number): number {
  const inPanel = lane % 2 === 0 ? 0.3 : 0.72;
  return lane < 2 ? l.side * inPanel : l.rightX + l.side * (1 - (lane === 2 ? 0.72 : 0.3));
}

/** Which lane a press on a thumb panel means: the half of the panel it landed in. */
export function laneAt(l: Layout, x: number): number | null {
  const side = K.sideAt(l, x);
  if (side === null) return null;
  const local = (x - K.panelX(l, side)) / l.side;
  return side === 0 ? (local < 0.5 ? 0 : 1) : local < 0.5 ? 2 : 3;
}

// ── Micro ──

function startMicro(st: State) {
  const kinds = MICRO_KINDS.filter((k) => k !== st.lastMicro);
  const kind = kinds[Math.floor(st.rand() * kinds.length)];
  st.lastMicro = kind;
  st.micro = { kind, phase: "intro", t: 0, sim: newMicro(kind, level(st), st.layout.w, st.rand), won: false };
  st.pointers.clear();
  setStage(st, "micro");
}

function updateMicroStage(st: State, dt: number) {
  const m = st.micro;
  if (!m) return setStage(st, "build");
  m.t += dt;
  if (m.phase === "intro") {
    if (m.t >= K.MICRO_INTRO) {
      m.phase = "play";
      m.t = 0;
    }
  } else if (m.phase === "play") {
    const out = updateMicro(m.sim, dt);
    if (out) {
      m.won = out === "win";
      m.phase = "result";
      m.t = 0;
      if (m.won) {
        st.microWins++;
        addScore(st, K.microWin(level(st)));
      } else {
        st.microLosses++;
        addScore(st, K.PTS_MICRO_FAIL);
        st.shakeT = 0.3;
      }
    }
  } else if (m.phase === "result") {
    if (m.t >= K.MICRO_RESULT) {
      m.phase = "resume";
      m.t = 0;
    }
  } else if (m.t >= K.MICRO_RESUME) {
    st.micro = null;
    st.pointers.clear();
    // The build clock was frozen the whole time; it picks up exactly where it stopped.
    st.stage = "build";
  }
}

// ── Finish ──

function startFinish(st: State) {
  const lvl = level(st);
  st.finish = {
    cocktail: st.order,
    cardT: K.FINISH_CARD,
    clock: 0,
    meter: K.FINISH_START,
    slowFor: 0,
    result: null,
    resultT: 0,
    passed: false,
    pointer: null,
    strokes: 0,
    dir: 0,
    extreme: 0,
    tinY: 0.5,
    lastAngle: null,
    revs: 0,
    stirBest: 0,
  };
  st.build = null;
  // The next order is picked now, but the left thumb isn't brought in until
  // the right one has had a beat on its own.
  st.order = pickCocktail(st.order.key, st.rand);
  st.grab = newGrab(lvl, false, "left", true);
  setStage(st, "finish");
}

function updateFinishStage(st: State, dt: number) {
  const f = st.finish;
  if (!f) return;

  if (f.cardT > 0) {
    f.cardT = Math.max(0, f.cardT - dt);
    return;
  }
  f.clock += dt;
  if (st.grab.pending && f.clock >= K.FINISH_LEAD) st.grab.pending = false;
  updateGrab(st, dt);
  if (st.stage !== "finish") return;

  if (!f.result) {
    f.meter = Math.max(0, f.meter - K.finishDrain(level(st)) * dt);
    if (f.clock > K.FINISH_GRACE && f.meter < K.FINISH_LINE) f.slowFor += dt;
    else f.slowFor = 0;

    if (f.slowFor > K.FINISH_SLOW_TOLERANCE) {
      f.result = "ruined";
      f.resultT = 0;
      f.pointer = null;
      if (!strike(st, f.cocktail.finish === "shake" ? "WATERY!" : "TOO WARM!")) return;
    } else if (f.clock >= K.FINISH_PLAY) {
      f.result = "served";
      f.resultT = 0;
      f.pointer = null;
      const lvl = level(st);
      addScore(st, K.finishPoints(lvl) + K.servePoints(lvl));
      st.served++;
      const p = st.players[st.current];
      if (p) p.drinks++;
      addFx(st, { kind: "sparkle", x: st.layout.rightX + st.layout.side / 2, y: K.H * 0.45, dur: 0.8 });
    }
  } else {
    f.resultT += dt;
  }

  if (f.result === "served" && st.mode === "party" && f.resultT >= K.RESULT_HOLD && !f.passed) {
    // Drink's up: pass the phone. The next bartender picks up the grab in progress.
    f.passed = true;
    const from = st.current;
    const to = pickNext(st, from);
    if (to !== from) {
      releaseAll(st);
      st.handoff = { reason: "served", from, to, t: 0, resume: "finish" };
      setStage(st, "handoff");
      return;
    }
  }

  const finishOver = f.result !== null && f.resultT >= K.RESULT_HOLD;
  if (finishOver && st.grab.done) toBuild(st);
}

function finishCentre(l: Layout) {
  return { x: l.rightX + l.side / 2, y: K.H * 0.52 };
}

function finishDrag(st: State, x: number, y: number) {
  const f = st.finish;
  if (!f || f.result || f.cardT > 0) return;
  if (f.cocktail.finish === "shake") {
    f.tinY = Math.max(0, Math.min(1, (y - 50) / (K.H - 100)));
    let stroke = false;
    if (f.dir === 0) {
      if (Math.abs(y - f.extreme) >= K.STROKE_PX) {
        f.dir = y > f.extreme ? 1 : -1;
        f.extreme = y;
        stroke = true;
      }
    } else if (f.dir === 1) {
      if (y > f.extreme) f.extreme = y;
      else if (f.extreme - y >= K.STROKE_PX) {
        f.dir = -1;
        f.extreme = y;
        stroke = true;
      }
    } else if (y < f.extreme) f.extreme = y;
    else if (y - f.extreme >= K.STROKE_PX) {
      f.dir = 1;
      f.extreme = y;
      stroke = true;
    }
    if (stroke) {
      f.strokes++;
      f.meter = Math.min(1, f.meter + K.STROKE_GAIN);
    }
  } else {
    const c = finishCentre(st.layout);
    const dx = x - c.x;
    const dy = y - c.y;
    // Too close to the middle and a wobble reads as a whole lap.
    if (Math.hypot(dx, dy) < 12) return;
    const a = Math.atan2(dy, dx);
    if (f.lastAngle !== null) {
      let d = a - f.lastAngle;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      // A jump this big in one sample is a thumb cutting across the middle,
      // not going round it — a straight scrub would otherwise count half a lap
      // every pass.
      if (Math.abs(d) <= Math.PI / 3) {
        // Only new ground counts: rocking back and forth along an arc winds
        // the net turn up and down without ever passing its furthest point.
        f.revs += d / (Math.PI * 2);
        const gained = Math.max(0, Math.abs(f.revs) - f.stirBest);
        f.stirBest = Math.max(f.stirBest, Math.abs(f.revs));
        f.meter = Math.min(1, f.meter + gained * K.STIR_GAIN_PER_REV);
      }
    }
    f.lastAngle = a;
  }
}

// ─── Input ───────────────────────────────────────────────────────────────────

export function pointerDown(st: State, id: number, x: number, y: number): void {
  switch (st.stage) {
    case "handoff":
      if (st.handoff && st.handoff.t >= K.HANDOFF_TAP_GUARD) beginTurn(st);
      return;
    case "grab": {
      const side = K.sideAt(st.layout, x);
      if (side !== null) tapGrab(st, side, x, y);
      return;
    }
    case "build": {
      const lane = laneAt(st.layout, x);
      if (lane !== null) {
        st.pointers.set(id, "lane");
        pressLane(st, lane);
      }
      return;
    }
    case "micro":
      if (st.micro?.phase === "play") {
        st.pointers.set(id, "micro");
        microPress(st.micro.sim, x, y, id);
      }
      return;
    case "finish": {
      const side = K.sideAt(st.layout, x);
      if (side === 0) tapGrab(st, 0, x, y);
      else if (side === 1 && st.finish && !st.finish.result && st.finish.pointer === null) {
        const f = st.finish;
        f.pointer = id;
        f.extreme = y;
        f.dir = 0;
        f.lastAngle = null;
        st.pointers.set(id, "finish");
        finishDrag(st, x, y);
      }
      return;
    }
  }
}

export function pointerMove(st: State, id: number, x: number, y: number): void {
  const owner = st.pointers.get(id);
  if (owner === "finish" && st.stage === "finish" && st.finish?.pointer === id) finishDrag(st, x, y);
  else if (owner === "micro" && st.micro?.phase === "play") microMove(st.micro.sim, x, y, id);
}

export function pointerUp(st: State, id: number): void {
  const owner = st.pointers.get(id);
  st.pointers.delete(id);
  if (owner === "finish" && st.finish?.pointer === id) {
    st.finish.pointer = null;
    st.finish.lastAngle = null;
  } else if (owner === "micro" && st.micro) microRelease(st.micro.sim, id);
}

// ─── Reporting ───────────────────────────────────────────────────────────────

/** What goes up with the score, for the owner to look at if a number seems too good. */
export function runDetail(st: State): Record<string, unknown> {
  return {
    mode: st.mode,
    served: st.served,
    level: level(st),
    strikes: st.strikes,
    microWins: st.microWins,
    microLosses: st.microLosses,
    seconds: Math.round(st.t),
    ...(st.mode === "party"
      ? { players: st.players.map((p) => ({ name: p.name, points: p.points, drinks: p.drinks })) }
      : {}),
  };
}
