// ─── Behind the Stick — rules ────────────────────────────────────────────────
//
// The whole simulation, with no React and no canvas. The component owns
// drawing and listening; everything that decides a score, a strike, who holds
// the phone or when the run is over lives here, so the tests can step it frame
// by frame (a hidden browser tab throttles requestAnimationFrame to nothing).
//
// THE LOOP
//
//   GRAB (both thumbs)      tap the order's bottles as they fall, dodge junk
//     ↓
//   BUILD                   Guitar Hero highway, two lanes per thumb
//     ↓  (micro games cut in and hand back)
//   FINISH                  right thumb shakes or stirs that drink while the
//     ↓                     left thumb GRABS the next order at the same time
//   BUILD → FINISH → BUILD → ... forever, faster every drink.
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
export type ItemKind = "bottle" | JunkKind | "vodka" | "jug" | "bomb" | "tips" | "cherry" | "ice" | "watch";

export const JUNK: JunkKind[] = ["can", "glass", "napkin", "phone"];

export interface Falling {
  id: number;
  side: 0 | 1;
  kind: ItemKind;
  /** The ingredient, for a bottle. */
  ing: string | null;
  /** Across the panel, 0..1, so a resize doesn't move anything out of its panel. */
  x: number;
  y: number;
  vy: number;
  /** Radians, for a tumble. */
  spin: number;
  spinV: number;
}

export interface Grab {
  /** Which panels are raining. Both on a fresh order, the left while finishing. */
  sides: [boolean, boolean];
  items: Falling[];
  spawnT: [number, number];
  sinceNeeded: number;
  got: string[];
  timeLeft: number;
  timeMax: number;
  done: boolean;
  /** The ice cube's slow-motion. */
  iceT: number;
  /** A vodka cloud over a panel. */
  stinkT: [number, number];
}

// ─── Build ───────────────────────────────────────────────────────────────────

export type Judgement = "perfect" | "good" | "miss";

export interface Note {
  lane: number;
  /** Build-clock time it reaches the line. */
  t: number;
  judged: Judgement | null;
}

export interface Build {
  clock: number;
  travel: number;
  notes: Note[];
  hits: number;
  combo: number;
  bestCombo: number;
  /** Build-clock times micro games cut in, soonest first. */
  microAt: number[];
  /** Last press per lane, in build-clock time, for the button flash. */
  pressedAt: number[];
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
  meter: number;
  timeLeft: number;
  /** null while working, then how it went. */
  result: "served" | "ruined" | null;
  /** Seconds since `result` was set. */
  resultT: number;
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
  resume: Stage;
}

// ─── Effects the view animates ───────────────────────────────────────────────

export type FxKind = "grab" | "boom" | "shatter" | "stink" | "splash" | "sparkle" | "word" | "serve";

export interface Fx {
  kind: FxKind;
  x: number;
  y: number;
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
    grab: newGrab(1, true),
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
  } else {
    showBanner(st, "GRAB!", "#FFD500", 1.1);
  }
  return st;
}

/** Keep playing on a new width — only the panels' pixel edges change. */
export function setWidth(st: State, w: number): void {
  if (w !== st.layout.w) st.layout = K.layoutFor(w);
}

function newGrab(lvl: number, both: boolean): Grab {
  const time = K.grabTime(lvl, both);
  return {
    sides: [true, both],
    items: [],
    spawnT: [0.5, 0.75],
    sinceNeeded: 0,
    got: [],
    timeLeft: time,
    timeMax: time,
    done: false,
    iceT: 0,
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
  st.grab = newGrab(level(st), true);
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
      if (st.stage === "grab" && st.grab.done && st.stageT > 0) toBuild(st);
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
  const lastOne = aliveIndexes(st).length === 1 && st.players.length > 1;
  setStage(st, h.resume);
  if (lastOne && h.reason === "out") showBanner(st, "LAST ONE STANDING!", "#FFD500", 1.6);
  else if (h.resume === "grab" || h.resume === "finish") showBanner(st, "GRAB!", "#FFD500", 1);
  else if (h.resume === "build") showBanner(st, "BUILD IT!", "#FF9A2A", 1);
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
  const bomb = Math.min(0.12, 0.03 + 0.012 * lvl);
  const table: [number, () => { kind: ItemKind; ing: string | null }][] = [
    [need.length ? 0.34 : 0, () => ({ kind: "bottle", ing: need[Math.floor(st.rand() * need.length)] })],
    [0.2, () => ({ kind: "bottle", ing: decoy(st) })],
    [0.22, () => ({ kind: JUNK[Math.floor(st.rand() * JUNK.length)], ing: null })],
    [0.1, () => ({ kind: st.rand() < 0.6 ? "vodka" : "jug", ing: null })],
    [bomb, () => ({ kind: "bomb", ing: null })],
    [0.03, () => ({ kind: "tips", ing: null })],
    [0.012, () => ({ kind: "cherry", ing: null })],
    [0.014, () => ({ kind: "ice", ing: null })],
    [0.014, () => ({ kind: "watch", ing: null })],
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

function spawn(st: State, side: 0 | 1) {
  const { kind, ing } = pickSpawn(st);
  const g = st.grab;
  if (kind === "bottle" && ing && wants(st, ing) && !g.got.includes(ing)) g.sinceNeeded = 0;
  const base = K.fallSpeed(level(st));
  g.items.push({
    id: st.nextId++,
    side,
    kind,
    ing,
    x: 0.18 + st.rand() * 0.64,
    y: -K.ITEM_H / 2,
    vy: base * (0.8 + st.rand() * 0.4),
    spin: 0,
    spinV: kind === "bottle" ? 0 : (st.rand() - 0.5) * 3,
  });
}

function updateGrab(st: State, dt: number) {
  const g = st.grab;
  if (g.done) return;
  const slow = g.iceT > 0 ? 0.5 : 1;
  g.iceT = Math.max(0, g.iceT - dt);
  g.stinkT = [Math.max(0, g.stinkT[0] - dt), Math.max(0, g.stinkT[1] - dt)];
  g.sinceNeeded += dt;

  for (const side of [0, 1] as const) {
    if (!g.sides[side]) continue;
    g.spawnT[side] -= dt * slow;
    if (g.spawnT[side] <= 0) {
      spawn(st, side);
      g.spawnT[side] = K.spawnGap(level(st)) * (0.75 + st.rand() * 0.5);
    }
  }
  for (const it of g.items) {
    it.y += it.vy * dt * slow;
    it.spin += it.spinV * dt;
  }
  g.items = g.items.filter((it) => it.y < K.H + K.ITEM_H);

  // The clock doesn't start until the first thing has had time to fall into reach.
  if (st.stageT > 0.6 || st.stage === "finish") g.timeLeft -= dt;
  if (g.timeLeft <= 0) {
    if (strike(st, "TOO SLOW!")) {
      st.order = pickCocktail(st.order.key, st.rand);
      const both = g.sides[1];
      st.grab = newGrab(level(st), both);
      showBanner(st, "NEW ORDER!", "#FFD500", 1);
    }
  }
}

/** A tap on a thumb panel while it's raining. */
function tapGrab(st: State, side: 0 | 1, x: number, y: number) {
  const g = st.grab;
  if (g.done || !g.sides[side]) return;
  const l = st.layout;
  const px = K.panelX(l, side);
  let best: Falling | null = null;
  let bestD = K.TAP_RADIUS;
  for (const it of g.items) {
    if (it.side !== side) continue;
    const d = Math.hypot(px + it.x * l.side - x, it.y - y);
    if (d <= bestD) {
      best = it;
      bestD = d;
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
    case "tips":
      addScore(st, K.PTS_TIPS);
      addFx(st, { kind: "sparkle", x: ix, y: it.y, dur: 0.6 });
      word(st, ix, it.y - 26, `+${K.PTS_TIPS}`, "#FFD500");
      break;
    case "cherry":
      addScore(st, K.PTS_CHERRY);
      addFx(st, { kind: "sparkle", x: ix, y: it.y, dur: 0.6 });
      word(st, ix, it.y - 26, `+${K.PTS_CHERRY}`, "#FFD500");
      break;
    case "ice":
      g.iceT = K.ICE_SECONDS;
      addFx(st, { kind: "sparkle", x: ix, y: it.y, dur: 0.6 });
      word(st, ix, it.y - 26, "CHILL", "#9CE8FF");
      break;
    case "watch":
      g.timeLeft = Math.min(g.timeMax, g.timeLeft + K.WATCH_TIME);
      addFx(st, { kind: "sparkle", x: ix, y: it.y, dur: 0.6 });
      word(st, ix, it.y - 26, "+TIME", "#9CE8FF");
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
  if (st.stage === "grab") showBanner(st, "BUILD IT!", "#FF9A2A", 1);
}

// ── Build ──

/** The rhythm of a build, as phrases — the gaps after each note, in beats. */
export const PHRASES: { beats: number[]; from: number }[] = [
  { beats: [1, 1], from: 1 },
  { beats: [2], from: 1 },
  { beats: [0.5, 1.5], from: 1 },
  { beats: [1.5, 0.5], from: 2 },
  { beats: [0.5, 0.5, 1], from: 2 },
  { beats: [0.75, 0.75, 0.5], from: 3 },
  { beats: [0.5, 0.5, 0.5, 1.5], from: 4 },
  { beats: [1 / 3, 1 / 3, 4 / 3], from: 5 },
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
    t += Math.max(0.28, gaps[n] * beat);
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
  st.build = { clock: 0, travel, notes, hits: 0, combo: 0, bestCombo: 0, microAt, pressedAt: [-9, -9, -9, -9] };
  st.finish = st.finish?.result ? null : st.finish;
  setStage(st, "build");
}

function updateBuild(st: State, dt: number) {
  const b = st.build;
  if (!b) return;
  b.clock += dt;

  if (b.microAt.length && b.clock >= b.microAt[0]) {
    b.microAt.shift();
    startMicro(st);
    return;
  }

  for (const n of b.notes) {
    if (!n.judged && b.clock > n.t + K.GOOD_WINDOW) {
      n.judged = "miss";
      b.combo = 0;
    }
  }

  const end = b.notes[b.notes.length - 1].t + 0.45;
  if (b.clock < end) return;

  const acc = b.hits / b.notes.length;
  if (acc < K.SEND_BACK_BELOW) {
    st.build = null;
    if (strike(st, "SENT BACK!")) {
      st.order = pickCocktail(st.order.key, st.rand);
      st.grab = newGrab(level(st), true);
      setStage(st, "grab");
    }
    return;
  }
  addScore(st, Math.round(K.PTS_BUILD_BONUS * acc));
  showBanner(st, st.order.finish === "shake" ? "SHAKE IT!" : "STIR IT!", "#FF6A3A", 1.1);
  startFinish(st);
}

function pressLane(st: State, lane: number) {
  const b = st.build;
  if (!b) return;
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
  b.bestCombo = Math.max(b.bestCombo, b.combo);
  addScore(st, (perfect ? K.PTS_PERFECT : K.PTS_GOOD) + Math.min(b.combo, K.COMBO_CAP) * K.COMBO_BONUS);
  addFx(st, { kind: "grab", x: bx, y: LANE_BUTTON_Y, dur: 0.35, ing: st.order.recipe[lane] });
  word(st, bx, LANE_BUTTON_Y - 50, perfect ? "PERFECT" : "GOOD", perfect ? "#FFD500" : "#9CE800");
}

/** Where each lane's button sits: two per thumb panel, side by side. */
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
    meter: 0,
    timeLeft: K.FINISH_SECONDS,
    result: null,
    resultT: 0,
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
  // And straight away, the next order starts falling down the left.
  st.order = pickCocktail(st.order.key, st.rand);
  st.grab = newGrab(lvl, false);
  setStage(st, "finish");
}

function updateFinishStage(st: State, dt: number) {
  const f = st.finish;
  updateGrab(st, dt);
  if (st.stage !== "finish" || !f) return;

  if (!f.result) {
    f.timeLeft -= dt;
    // Judged before it drains, or a meter topped out this frame would read 0.999.
    if (f.meter < 1) f.meter = Math.max(0, f.meter - K.FINISH_DECAY * dt);
    if (f.meter >= 1) {
      f.result = "served";
      f.resultT = 0;
      f.pointer = null;
      const lvl = level(st);
      addScore(st, K.finishPoints(lvl) + K.servePoints(lvl));
      st.served++;
      const p = st.players[st.current];
      if (p) p.drinks++;
      addFx(st, { kind: "serve", x: st.layout.rightX + st.layout.side / 2, y: K.H * 0.45, dur: K.SERVE_HOLD });
    } else if (f.timeLeft <= 0) {
      f.result = "ruined";
      f.resultT = 0;
      f.pointer = null;
      if (!strike(st, f.cocktail.finish === "shake" ? "WATERY!" : "TOO WARM!")) return;
    }
  } else {
    f.resultT += dt;
  }

  if (f.result === "served" && st.mode === "party" && f.resultT >= K.SERVE_HOLD && !st.handoff) {
    // Drink's up: pass the phone. The next bartender picks up the grab in progress.
    st.finish = null;
    const from = st.current;
    const to = pickNext(st, from);
    if (to === from) {
      showBanner(st, "KEEP GOING!", "#FFD500", 0.9);
    } else {
      releaseAll(st);
      st.handoff = { reason: "served", from, to, t: 0, resume: st.grab.done ? "build" : "finish" };
      setStage(st, "handoff");
      return;
    }
  }

  const finishOver = !st.finish || (st.finish.result !== null && st.finish.resultT >= K.SERVE_HOLD);
  if (finishOver && st.grab.done) toBuild(st);
}

function finishCentre(l: Layout) {
  return { x: l.rightX + l.side / 2, y: K.H * 0.52 };
}

function finishDrag(st: State, x: number, y: number) {
  const f = st.finish;
  if (!f || f.result) return;
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
      f.meter = Math.min(1, f.meter + 1 / K.shakeStrokes(level(st)));
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
      if (Math.abs(d) <= Math.PI / 2) {
        // Only new ground counts: rocking back and forth along an arc winds
        // the net turn up and down without ever passing its furthest point.
        f.revs += d / (Math.PI * 2);
        const gained = Math.max(0, Math.abs(f.revs) - f.stirBest);
        f.stirBest = Math.max(f.stirBest, Math.abs(f.revs));
        f.meter = Math.min(1, f.meter + gained / K.stirRevs(level(st)));
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
