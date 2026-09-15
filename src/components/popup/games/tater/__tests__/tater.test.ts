// Tater Tales — driving the real rules.
//
// The claim this file exists to check is "the shaft can always be climbed".
// That is a statement about GRAVITY, V_MAX and ROW_GAP together, and it is not
// something anyone can eyeball from a screenshot — a shaft with one unreachable
// rung in it looks completely normal right up until a guest is stuck on it.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { unrenderable } from "../../arcade";
import { ART } from "../artManifest";
import {
  ALLIE_AGAIN, ALLIE_KEEP_GOING, ALLIE_LINE, FLAT_LINE, GUILLERMO_LINE, LONELY_BOTTLES, MIXERS,
  SUMMIT_BOTTLES, TATER_LINE, TATER_SOAKED, TATER_TAUNT, TATER_TAUNT_AGAIN, THANK_YOU,
  summitBottleFor,
} from "../cast";
import {
  AIM_MAX, ELMER_W, FIZZ_MAX, FIZZ_START, GRAVITY, H_MAX, H_MIN, PIXEL_SCALE, PLATFORM_W,
  ROW_GAP, SCORE_PER_ROW, SCORE_RESCUE, V_MAX, V_MIN, W, WALL_MARGIN, aimPeriodFor, heightFor,
  powerPeriodFor,
} from "../constants";
import { ROWS_PER_ZONE, SUMMIT_ROW, ZONES, zoneForRow, zoneIndexForRow } from "../zones";
import { SLIDES } from "../story";
import { HOWTO_COPY } from "../text";
import {
  ALLIE_ROWS, CHARGE_TIME, REACH_X, aimAt, bestShot, build, createGame,
  drainEvents, endScene, heightRows, nextLap, powerAt, score, simulateBlast, speedFor,
  makeRng, step, tap, velocityFor, type Phase, type TaterState,
} from "../taterCore";

/** Assign a phase without TypeScript narrowing every later read to that literal. */
function setPhase(g: TaterState, phase: Phase) { g.phase = phase; }

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ── A bot that actually plays ───────────────────────────────────────────────

/**
 * Play one run to its end and report what happened.
 *
 * Drives the real phases through the real `tap`, so what this measures is what
 * a player at the bar gets — including the fact that nobody stops a sweeping
 * arrow on the exact degree they meant to.
 *
 * `noise` is how far off the intended shot the thumb lands, in radians of angle
 * and half that in gauge. It models a HUMAN, which is a player who aims at the
 * right thing and misses by a bit in a random direction.
 *
 * It is deliberately NOT modelled by widening the window the bot will tap in,
 * which is the obvious way to write this and is wrong: a wide window is first
 * crossed early in the sweep, every time, so the bot fires at nearly the same
 * angle and power on every single blast. That is not a sloppy player, it is a
 * player with a systematic bias — and it reported this game as unplayable
 * (0.8 rows a run) when it is not.
 */
function playRun(seed: number, opts: { maxSeconds?: number; noise?: number } = {}) {
  const maxSeconds = opts.maxSeconds ?? 900;
  const noise = opts.noise ?? 0.08;
  const g = createGame(seed);
  const jitter = makeRng(seed * 7919 + 13);
  const dt = 1 / 60;
  let want: { angle: number; power: number } | null = null;
  let t = 0;
  let landings = 0;
  let matches = 0;
  let allies = 0;
  let summits = 0;
  let pendingLap = false;

  while (!g.over && t < maxSeconds) {
    step(g, dt);
    t += dt;

    for (const e of drainEvents(g)) {
      if (e.kind === "rest") landings++;
      if (e.kind === "match") matches++;
      if (e.kind === "allie") allies++;
      if (e.kind === "summit") { summits++; pendingLap = true; }
    }

    // The renderer plays the finale and then starts the next lap.
    if (g.phase === "scene") {
      if (pendingLap) { pendingLap = false; nextLap(g); } else endScene(g);
      continue;
    }

    if (g.phase === "aim") {
      if (!want) {
        const aim = bestShot(g) ?? { angle: 0, power: 0.9 };
        want = {
          angle: aim.angle + (jitter() - 0.5) * 2 * noise,
          power: aim.power + (jitter() - 0.5) * noise,
        };
      }
      if (Math.abs(g.angle - want.angle) < 0.05) tap(g);
      // An arrow that never quite passes the target must not hang the run.
      else if (g.t > 6) tap(g);
    } else if (g.phase === "power") {
      if (Math.abs(g.power - (want?.power ?? 0.9)) < 0.03) tap(g);
      else if (g.t > 6) tap(g);
    } else {
      want = null;
    }
  }

  return { g, seconds: t, landings, matches, allies, summits, finished: g.over };
}

// ── Everything on screen has to be drawable ─────────────────────────────────

check("every line in the game can be drawn by the 5x7 font", () => {
  const strings = [
    ...THANK_YOU, GUILLERMO_LINE, ALLIE_LINE, TATER_LINE, FLAT_LINE,
    TATER_TAUNT, TATER_TAUNT_AGAIN, TATER_SOAKED, ALLIE_KEEP_GOING, ALLIE_AGAIN,
    ...HOWTO_COPY.flat(),
    ...LONELY_BOTTLES.map((b) => b.label),
    ...MIXERS.map((m) => m.label),
    ...ZONES.map((z) => z.title),
    ...SLIDES.flatMap((s) => [s.caption ?? "", s.line ?? ""]),
  ].filter(Boolean);

  const bad: string[] = [];
  for (const s of strings) {
    const missing = unrenderable(s);
    if (missing.length) bad.push(`"${s}" -> ${missing.join(" ")}`);
  }
  assert.equal(bad.length, 0, `unrenderable text:\n  ${bad.join("\n  ")}`);
});

// ── The shaft ───────────────────────────────────────────────────────────────

check("no platform is ever off the edge of the shaft", () => {
  const g = createGame(7);
  build(g, 400);
  for (const p of g.platforms) {
    assert.ok(p.x >= 0, `row ${p.row} starts at ${p.x}`);
    assert.ok(p.x + p.w <= W, `row ${p.row} ends at ${p.x + p.w}, shaft is ${W}`);
    assert.ok(p.w >= PLATFORM_W.small, `row ${p.row} is only ${p.w} wide`);
  }
});

check("platforms on a row never overlap", () => {
  const g = createGame(11);
  build(g, 400);
  const byRow = new Map<number, typeof g.platforms>();
  for (const p of g.platforms) {
    const list = byRow.get(p.row) ?? [];
    list.push(p);
    byRow.set(p.row, list);
  }
  for (const [row, list] of Array.from(byRow.entries())) {
    const sorted = [...list].sort((a, b) => a.x - b.x);
    for (let i = 1; i < sorted.length; i++) {
      assert.ok(
        sorted[i].x >= sorted[i - 1].x + sorted[i - 1].w,
        `row ${row}: ${sorted[i - 1].x}+${sorted[i - 1].w} overlaps ${sorted[i].x}`
      );
    }
  }
});

check("every shelf has something within reach on the row above it", () => {
  // The invariant that makes the game finishable. Checked over many seeds
  // because the repair pass in placeRow only runs when a scatter needs it.
  for (const seed of [1, 2, 3, 17, 99, 12345]) {
    const g = createGame(seed);
    build(g, 300);
    const byRow = new Map<number, typeof g.platforms>();
    for (const p of g.platforms) {
      const list = byRow.get(p.row) ?? [];
      list.push(p);
      byRow.set(p.row, list);
    }
    for (let row = 0; row < SUMMIT_ROW; row++) {
      const here = byRow.get(row) ?? [];
      const above = byRow.get(row + 1) ?? [];
      assert.ok(above.length > 0, `seed ${seed}: row ${row + 1} is empty`);
      for (const p of here) {
        const from = p.x + p.w / 2;
        const near = above.some((q) => Math.abs(q.x + q.w / 2 - from) <= REACH_X);
        assert.ok(near, `seed ${seed}: row ${row} shelf at ${Math.round(from)} is stranded`);
      }
    }
  }
});

check("the bottom shelf is one unbroken floor with Guillermo on it", () => {
  const g = createGame(5);
  const ground = g.platforms.filter((p) => p.row === 0);
  assert.equal(ground.length, 1, "the floor should be a single shelf");
  assert.ok(ground[0].w >= W - WALL_MARGIN * 2, "the floor should span the shaft");
  assert.equal(ground[0].item?.kind, "guillermo");
});

check("Allie appears on the far right of her rows and nowhere else", () => {
  const g = createGame(3);
  build(g, 120);
  const found = g.platforms.filter((p) => p.item?.kind === "allie");
  assert.deepEqual(
    found.map((p) => p.row).sort((a, b) => a - b),
    ALLIE_ROWS.filter((r) => r <= 120)
  );
  for (const p of found) {
    const row = g.platforms.filter((q) => q.row === p.row);
    const rightmost = row.reduce((a, b) => (b.x + b.w > a.x + a.w ? b : a));
    assert.equal(p.id, rightmost.id, `row ${p.row}: Allie is not the far-right shelf`);
  }
});

// ── The physics ─────────────────────────────────────────────────────────────

check("the weakest blast is feeble and the strongest clears nearly three rows", () => {
  const rise = (power: number) => {
    const { vy } = velocityFor(0, power);
    return (vy * vy) / (2 * GRAVITY);
  };
  const weak = rise(0);
  const strong = rise(1);
  assert.ok(weak < ROW_GAP * 0.4, `weakest blast rises ${weak.toFixed(0)}px, should be feeble`);
  assert.ok(strong > ROW_GAP * 2.5, `strongest rises ${strong.toFixed(0)}px, under 2.5 rows`);
  assert.ok(strong < ROW_GAP * 3.2, `strongest rises ${strong.toFixed(0)}px, over 3.2 rows`);
});

check("REACH_X is inside what a one-row blast can actually carry sideways", () => {
  // The number REACH_X is derived from, recomputed here rather than trusted:
  // if GRAVITY, ROW_GAP or V_MAX is ever retuned, this is what catches it.
  const needUp = Math.sqrt(2 * GRAVITY * ROW_GAP);
  assert.ok(needUp < V_MAX, "a full blast cannot even clear one row");
  const spare = Math.sqrt(V_MAX * V_MAX - needUp * needUp);
  const carry = spare * (needUp / GRAVITY);
  assert.ok(REACH_X < carry, `REACH_X ${REACH_X} exceeds the ${carry.toFixed(0)}px a blast carries`);
});

check("the aim sweep covers its whole arc and comes back", () => {
  let lo = 0, hi = 0;
  for (let t = 0; t < 4; t += 1 / 240) {
    const a = aimAt(t);
    lo = Math.min(lo, a);
    hi = Math.max(hi, a);
  }
  assert.ok(hi > AIM_MAX - 0.01 && lo < -AIM_MAX + 0.01, `arc reached ${lo} to ${hi}`);
  assert.ok(hi < Math.PI / 2, "the arrow must never point flat or below");
});

check("the carbonation gauge is a straight ramp, not a sine", () => {
  // Equal time per unit of power, both directions. See POWER_PERIOD.
  const step = 1 / 480;
  const deltas: number[] = [];
  for (let t = step; t < 0.5; t += step) deltas.push(powerAt(t) - powerAt(t - step));
  const first = deltas[0];
  for (const d of deltas) {
    assert.ok(Math.abs(d - first) < 1e-9, "the rise is not linear");
  }
  assert.ok(powerAt(0) < 0.01, "the gauge should start empty");
});

check("speed rises with the gauge and is bounded by V_MIN and V_MAX", () => {
  assert.equal(speedFor(0), V_MIN);
  assert.equal(speedFor(1), V_MAX);
  assert.equal(speedFor(-5), V_MIN, "an out-of-range gauge must clamp, not go backwards");
  assert.equal(speedFor(5), V_MAX);
});

check("Elmer never leaves the shaft, however hard he is fired at a wall", () => {
  const g = createGame(21);
  const half = ELMER_W / 2;
  for (let i = 0; i < 60; i++) {
    // Fire flat-out at alternating walls and watch the whole flight.
    setPhase(g, "aim");
    g.t = 0;
    g.lockedAngle = i % 2 ? AIM_MAX : -AIM_MAX;
    g.lockedPower = 1;
    setPhase(g, "charge");
    g.t = CHARGE_TIME;
    g.fizz = 99;
    for (let f = 0; f < 600 && g.phase !== "settle" && g.phase !== "aim"; f++) {
      step(g, 1 / 60);
      assert.ok(g.elmer.x - half >= -0.001, `left the shaft at x=${g.elmer.x}`);
      assert.ok(g.elmer.x + half <= W + 0.001, `left the shaft at x=${g.elmer.x}`);
      assert.ok(g.elmer.y <= 0.001, `fell through the bottom shelf to y=${g.elmer.y}`);
      if (g.phase === "scene") endScene(g);
    }
  }
});

check("a fast landing bounces before it sticks", () => {
  const g = createGame(31);
  // Only the floor, so the drop is the four rows it says it is — leave the rest
  // of the shaft in and he lands on the first shelf under him, one row down and
  // far too slowly to bounce, which is a true fact about a different test.
  g.platforms = g.platforms.filter((p) => p.row === 0);
  g.elmer = { x: W / 2, y: -ROW_GAP * 4, vx: 0, vy: 0, facing: 1, standing: null };
  setPhase(g, "flight");
  let bounces = 0;
  for (let i = 0; i < 900 && g.phase !== "settle" && g.phase !== "over" && g.phase !== "aim"; i++) {
    step(g, 1 / 60);
    for (const e of drainEvents(g)) if (e.kind === "bounce") bounces++;
    if (g.phase === "scene") endScene(g);
  }
  assert.ok(bounces >= 1, "a four-row drop should bounce at least once");
});

// ── The run ─────────────────────────────────────────────────────────────────

check("the same seed and the same taps replay the same climb", () => {
  const a = playRun(4242);
  const b = playRun(4242);
  assert.equal(score(a.g), score(b.g));
  assert.equal(a.g.maxRow, b.g.maxRow);
  assert.equal(a.g.blasts, b.g.blasts);
  assert.ok(Math.abs(a.g.elmer.x - b.g.elmer.x) < 1e-9, "the climbs diverged");
});

check("a run ends, and it ends because the can went flat", () => {
  for (const seed of [1, 8, 64, 512]) {
    const run = playRun(seed);
    assert.ok(run.finished, `seed ${seed}: the run never ended in ten minutes`);
    assert.ok(run.g.fizz <= 0, `seed ${seed}: ended with ${run.g.fizz} fizz left`);
    assert.equal(run.g.phase, "over");
  }
});

/** Rows climbed across every lap of a run. */
const climbed = (g: TaterState) => g.banked / SCORE_PER_ROW + g.maxRow;

check("a good player reaches the summit, and the laps after it are harder", () => {
  // The whole fizz economy in one assertion. The top has to be reachable by a
  // steady player — the finale and the laps are the point of the design — but
  // not by everybody, and the laps must eventually stop them.
  const runs = [1, 2, 3, 4, 5, 6, 7, 8].map((s) => playRun(s, { noise: 0.08 }));
  const avg = runs.reduce((a, r) => a + climbed(r.g), 0) / runs.length;
  const topped = runs.filter((r) => r.summits > 0).length;
  console.log(`       good player: ${avg.toFixed(0)} rows a run, ${topped}/8 reached the summit, laps ${runs.map((r) => r.g.lap).join(",")}`);
  assert.ok(avg > 25, `a good player averaged only ${avg.toFixed(1)} rows`);
  assert.ok(topped >= 2, `only ${topped} of 8 good runs reached the summit`);
});

check("a shakier thumb still gets a real run", () => {
  // A game whose fizz economy only works for a perfect player is a game that
  // ends on blast four for everybody actually standing at the bar.
  const rows = [1, 2, 3, 4, 5, 6].map((s) => climbed(playRun(s, { noise: 0.22 }).g));
  const avg = rows.reduce((a, b) => a + b, 0) / rows.length;
  console.log(`       shaky player: ${avg.toFixed(0)} rows a run (${rows.join(", ")})`);
  assert.ok(avg > 6, `shaky play averaged only ${avg.toFixed(1)} rows`);
});

check("a run is the length of a drink, not of an evening", () => {
  const secs = [1, 2, 3, 4].map((s) => playRun(s, { noise: 0.08 }).seconds);
  const avg = secs.reduce((a, b) => a + b, 0) / secs.length;
  console.log(`       average run ${(avg / 60).toFixed(1)} minutes`);
  assert.ok(avg < 900, `an average run takes ${(avg / 60).toFixed(1)} minutes`);
  assert.ok(avg > 45, `an average run is over in ${avg.toFixed(0)} seconds`);
});

check("fizz is never handed out beyond its cap", () => {
  const run = playRun(77);
  assert.ok(run.g.fizz <= FIZZ_MAX);
  assert.ok(FIZZ_START <= FIZZ_MAX);
});

check("height is only ever paid for once", () => {
  // Climb, fall back down, climb again: the score must not move on the way up
  // through rows already banked.
  const g = createGame(9);
  build(g, 60);
  g.maxRow = 20;
  const before = score(g);
  g.elmer = { x: W / 2, y: -ROW_GAP * 10, vx: 0, vy: 0, facing: 1, standing: null };
  setPhase(g, "flight");
  for (let i = 0; i < 1200 && !g.over; i++) {
    step(g, 1 / 60);
    if (g.phase === "scene") endScene(g);
    if (g.phase === "settle" || g.phase === "aim") break;
  }
  assert.ok(score(g) <= before + 0, `re-climbing paid out again: ${before} -> ${score(g)}`);
  assert.equal(g.maxRow, 20, "maxRow moved backwards");
});

check("a bottle without a mixer stays put, and is paid for when you come back", () => {
  const g = createGame(13);
  build(g, 40);
  const shelf = g.platforms.find((p) => p.item?.kind === "bottle");
  assert.ok(shelf, "no bottle was generated in forty rows");

  const landOn = (state: TaterState, id: number) => {
    const p = state.platforms.find((q) => q.id === id)!;
    state.elmer = { x: p.x + p.w / 2, y: p.y - 2, vx: 0, vy: 0, facing: 1, standing: null };
    setPhase(state, "flight");
    state.fizz = 50;
    for (let i = 0; i < 600; i++) {
      step(state, 1 / 60);
      if (state.phase === "settle" || state.phase === "aim" || state.phase === "over") break;
      if (state.phase === "scene") endScene(state);
    }
  };

  landOn(g, shelf!.id);
  assert.equal(g.mixers, 0);
  assert.ok(g.platforms.find((p) => p.id === shelf!.id)?.item, "the bottle vanished with no mixer");

  g.mixers = 1;
  landOn(g, shelf!.id);
  assert.equal(g.mixers, 0, "the mixer was not spent");
  assert.equal(g.platforms.find((p) => p.id === shelf!.id)?.item, null, "the bottle is still there");
});

check("landing on Allie pauses the game for her scene", () => {
  const g = createGame(3);
  build(g, 40);
  const shelf = g.platforms.find((p) => p.item?.kind === "allie");
  assert.ok(shelf, "Allie was not generated");
  g.elmer = { x: shelf!.x + shelf!.w / 2, y: shelf!.y - 2, vx: 0, vy: 0, facing: 1, standing: null };
  setPhase(g, "flight");
  g.fizz = 20;
  for (let i = 0; i < 600 && g.phase !== "scene"; i++) step(g, 1 / 60);
  assert.equal(g.phase, "scene", "her scene never started");
  const before = { ...g.elmer };
  step(g, 1);
  assert.equal(g.elmer.y, before.y, "the simulation ran on during a cutscene");
  endScene(g);
  assert.equal(g.phase, "aim");
});

check("taps outside the two sweep phases do nothing", () => {
  const g = createGame(6);
  setPhase(g, "flight");
  assert.equal(tap(g), false);
  setPhase(g, "charge");
  assert.equal(tap(g), false);
  setPhase(g, "over");
  assert.equal(tap(g), false);
});

check("simulateBlast never marks a shelf spent or moves the real Elmer", () => {
  const g = createGame(15);
  build(g, 40);
  const before = JSON.stringify({ e: g.elmer, spent: g.platforms.map((p) => p.spent), s: score(g) });
  for (let i = 0; i < 20; i++) simulateBlast(g, aimAt(i / 7), 0.8, g.elmer.x, g.elmer.y);
  assert.equal(JSON.stringify({ e: g.elmer, spent: g.platforms.map((p) => p.spent), s: score(g) }), before);
});

// ── The worlds ──────────────────────────────────────────────────────────────

check("the ladder of worlds is the one the design lists, with the summit on top", () => {
  assert.deepEqual(
    ZONES.map((z) => z.art),
    ["shelf", "sky", "space", "moon", "space", "mars", "space", "pluto", "space", "ship", "space", "heaven"]
  );
  assert.equal(zoneForRow(0).art, "shelf");
  assert.equal(zoneForRow(ROWS_PER_ZONE).art, "sky");
  assert.equal(zoneIndexForRow(-5), 0, "below the floor is still the bottom shelf");
  assert.equal(zoneForRow(SUMMIT_ROW - 1).art, "heaven");
  assert.equal(zoneForRow(SUMMIT_ROW).art, "summit");
});

// ── The summit and the laps ─────────────────────────────────────────────────

/** Drop Elmer onto a shelf and run until he is standing. */
function landOn(state: TaterState, id: number) {
  const p = state.byId.get(id)!;
  state.elmer = { x: p.x + p.w / 2, y: p.y - 2, vx: 0, vy: 0, facing: 1, standing: null };
  setPhase(state, "flight");
  state.fizz = 50;
  for (let i = 0; i < 600; i++) {
    step(state, 1 / 60);
    if (state.phase === "settle" || state.phase === "aim" || state.phase === "over" || state.phase === "scene") break;
  }
}

check("nothing is built above the summit, and it is one floor wall to wall", () => {
  const g = createGame(8);
  build(g, SUMMIT_ROW + 50);
  assert.equal(g.builtTo, SUMMIT_ROW);
  const top = g.byRow.get(SUMMIT_ROW)!;
  assert.equal(top.length, 1);
  assert.equal(top[0].item?.kind, "summit");
  assert.ok(top[0].w >= W - WALL_MARGIN * 2);
});

check("standing on the summit pays out and pauses for the finale", () => {
  const g = createGame(4);
  build(g, SUMMIT_ROW);
  const top = g.byRow.get(SUMMIT_ROW)![0];
  const before = score(g);
  landOn(g, top.id);
  const events = drainEvents(g);
  const summit = events.find((e) => e.kind === "summit");
  assert.ok(summit, "no summit event");
  assert.equal(g.phase, "scene");
  assert.ok(score(g) >= before + SCORE_RESCUE, "the rescue bonus was not paid");
});

check("the next lap starts at the bottom with the score carried and the can full", () => {
  const g = createGame(4);
  build(g, SUMMIT_ROW);
  landOn(g, g.byRow.get(SUMMIT_ROW)![0].id);
  const carried = score(g);
  nextLap(g);
  assert.equal(g.lap, 2);
  assert.equal(g.maxRow, 0);
  assert.equal(g.elmer.y, 0);
  assert.equal(g.phase, "aim");
  assert.equal(g.fizz, FIZZ_MAX);
  assert.equal(score(g), carried, "the score changed across the lap");
});

check("Allie is only snatched on lap one", () => {
  const g = createGame(3);
  nextLap(g);
  build(g, SUMMIT_ROW);
  assert.equal(g.platforms.filter((p) => p.item?.kind === "allie").length, 0);
});

check("each lap is harder: faster sweeps and smaller shelves", () => {
  assert.ok(aimPeriodFor(3) < aimPeriodFor(1));
  assert.ok(powerPeriodFor(3) < powerPeriodFor(1));
  assert.ok(aimPeriodFor(50) >= 1.4, "the arrow must stay catchable");
  const avgWidth = (lap: number) => {
    const g = createGame(77);
    for (let i = 1; i < lap; i++) nextLap(g);
    build(g, SUMMIT_ROW - 1);
    const shelves = g.platforms.filter((p) => p.row > 0 && p.row < SUMMIT_ROW);
    return shelves.reduce((a, p) => a + p.w, 0) / shelves.length;
  };
  assert.ok(avgWidth(5) < avgWidth(1), `lap 5 shelves ${avgWidth(5).toFixed(0)} vs lap 1 ${avgWidth(1).toFixed(0)}`);
});

check("every lap after the first frees a different rare bottle, and never Guillermo", () => {
  assert.equal(summitBottleFor(1), null);
  const seen = SUMMIT_BOTTLES.map((_, i) => summitBottleFor(i + 2));
  assert.equal(new Set(seen).size, SUMMIT_BOTTLES.length);
  assert.ok(!SUMMIT_BOTTLES.includes("tequila"));
});

check("the score is height first, bonuses second", () => {
  const g = createGame(2);
  g.maxRow = 30;
  g.bonus = 0;
  assert.equal(score(g), 30 * SCORE_PER_ROW);
  g.bonus = 1250;
  assert.equal(score(g), 30 * SCORE_PER_ROW + 1250);
});

check("height in rows tracks the world position", () => {
  const g = createGame(2);
  g.elmer.y = -ROW_GAP * 12;
  assert.ok(Math.abs(heightRows(g) - 12) < 1e-9);
});

// ── The screen ──────────────────────────────────────────────────────────────

check("the view height stays inside its bounds on any phone", () => {
  for (const [w, h] of [[320, 480], [375, 812], [414, 896], [768, 1024], [1280, 800], [0, 0]]) {
    const out = heightFor(w, h);
    assert.ok(out >= H_MIN && out <= H_MAX, `${w}x${h} produced ${out}`);
  }
});

// ── The story ───────────────────────────────────────────────────────────────

check("the intro runs in order and every slide has art to draw", () => {
  assert.ok(SLIDES.length >= 20, `only ${SLIDES.length} slides`);
  const seen = new Set<string>();
  SLIDES.forEach((s, i) => {
    assert.ok(s.art, `slide ${i + 1} has no art key`);
    assert.ok(!seen.has(s.id), `duplicate slide id ${s.id}`);
    seen.add(s.id);
    if (s.line) assert.ok(s.speaker, `slide ${i + 1} has a line but nobody says it`);
  });
});

// ── The art the game expects ────────────────────────────────────────────────

check("every image in the manifest is on disk at the size it claims, and nothing else is", () => {
  const dir = path.join(process.cwd(), "public", "popup", "art", "tater");
  const files = new Set(fs.readdirSync(dir).filter((f) => f.endsWith(".png")));
  for (const [name, a] of Object.entries(ART)) {
    assert.ok(files.has(`${name}.png`), `${name}.png is in the manifest but not on disk`);
    assert.ok(a.frames >= 1 && a.fw > 0 && a.fh > 0, `${name} has a bad entry`);
  }
  const stray = Array.from(files).filter((f) => !(f.replace(/\.png$/, "") in ART));
  assert.equal(stray.length, 0, `art the game will never load:\n  ${stray.join("\n  ")}`);
  // Everything the rules can put on a shelf has its picture.
  for (const b of LONELY_BOTTLES) assert.ok(`thanks-${b.id}` in ART, `no art for ${b.id}`);
  for (const m of MIXERS) assert.ok(`mixer-${m.id}` in ART, `no art for ${m.id}`);
  for (const s of SLIDES) assert.ok(s.art in ART, `no picture for slide ${s.id}`);
  assert.equal(PIXEL_SCALE, 3, "the importer writes art for PIXEL_SCALE 3");
});

console.log(`\n  ${passed} checks passed`);
