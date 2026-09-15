// Behind the Stick — driving the real simulation frame by frame.
import assert from "node:assert";
import * as K from "../constants";
import {
  chartFor,
  freshState,
  isWanted,
  laneAt,
  laneButtonX,
  LANE_BUTTON_Y,
  level,
  pointerDown,
  pointerMove,
  pointerUp,
  runDetail,
  update,
  wants,
  type Flying,
  type State,
} from "../core";
import {
  BEER_LINE,
  beerAimFor,
  microMove,
  microPress,
  newBeer,
  newPop,
  newShots,
  popLandX,
  SHOT_REST_Y,
  updateMicro,
} from "../micro";
import { botStep, newBot } from "../bot";
import { getCocktail } from "../../cocktails";

let passed = 0;
function check(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ok   ${name}`);
  } catch (e) {
    console.log(`  FAIL ${name}`);
    console.log(`       ${e instanceof Error ? e.message : e}`);
    process.exitCode = 1;
  }
}

const DT = 1 / 60;
const eq = (a: unknown, b: unknown, msg?: string) => assert.strictEqual(a, b, msg);

/** A seeded generator, so a run can be replayed exactly. */
function seeded(seed = 7) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function run(st: State, seconds: number) {
  let finished = false;
  for (let i = 0; i < Math.round(seconds / DT); i++) finished = update(st, DT).finished || finished;
  return finished;
}

/** Step until a condition holds, or fail loudly. */
function until(st: State, cond: () => boolean, maxSeconds = 60, each?: () => void) {
  for (let i = 0; i < maxSeconds * 60; i++) {
    if (cond()) return;
    each?.();
    update(st, DT);
  }
  if (!cond()) assert.fail("condition never met");
}

/** Past whatever card the grab is showing. */
function grabLive(st: State) {
  until(st, () => !st.grab.pending && st.grab.cardT === 0, 30, () => finishing(st));
}

function itemX(st: State, it: Flying) {
  return K.panelX(st.layout, it.side) + it.x * st.layout.side;
}

function flying(side: 0 | 1, kind: Flying["kind"], ing: string | null, id: number): Flying {
  return { id, side, kind, ing, x: 0.5, vx: 0, y: 150, vy: -1, spin: 0, spinV: 0 };
}

/** Put a bottle right where a thumb can reach it, and tap it. */
function grabBottle(st: State, ing: string, side: 0 | 1 = 0) {
  const it = flying(side, "bottle", ing, st.nextId++);
  st.grab.items.push(it);
  pointerDown(st, 99, itemX(st, it), it.y);
  pointerUp(st, 99);
}

function grabOrder(st: State, side: 0 | 1 = 0) {
  grabLive(st);
  for (const ing of st.order.recipe) grabBottle(st, ing, side);
}

/** Hit the build's notes dead on — `accuracy` of them. */
function playBuild(st: State, accuracy = 1) {
  let n = 0;
  until(st, () => st.stage !== "build", 120, () => {
    const b = st.build!;
    for (const note of b.notes) {
      if (!note.judged && b.cardT === 0 && Math.abs(note.t - b.clock) < DT / 2 + 1e-9) {
        if ((n++ % 10) / 10 < accuracy) {
          pointerDown(st, 1, laneButtonX(st.layout, note.lane), LANE_BUTTON_Y);
          pointerUp(st, 1);
        }
      }
    }
  });
}

/** Thumb on the right panel: shake up and down, or stir round, a frame's worth. */
let finger = 0;
function finishing(st: State) {
  const f = st.finish;
  if (st.stage !== "finish" || !f || f.result || f.cardT > 0) return;
  const cx = st.layout.rightX + st.layout.side / 2;
  const cy = K.H * 0.52;
  finger++;
  if (f.pointer === null) pointerDown(st, 5, cx, cy);
  if (f.cocktail.finish === "shake") {
    pointerMove(st, 5, cx, Math.floor(finger / 6) % 2 ? cy - 40 : cy + 40);
  } else {
    const a = (finger / 36) * Math.PI * 2;
    pointerMove(st, 5, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
  }
}

function toFinish(st: State) {
  grabOrder(st);
  update(st, DT);
  eq(st.stage, "build");
  playBuild(st);
  eq(st.stage, "finish");
}

console.log("Behind the Stick");

// ── Layout ──

check("width stays inside the letterbox range", () => {
  eq(K.widthFor(390, 844), K.W_MIN);
  eq(K.widthFor(2000, 400), K.W_MAX);
  eq(K.widthFor(844, 390), Math.round((K.H * 844) / 390));
});

check("every lane's tap zone is on its own half of a thumb panel", () => {
  for (const w of [K.W_MIN, K.W_REF, K.W_MAX]) {
    const l = K.layoutFor(w);
    for (let lane = 0; lane < 4; lane++) eq(laneAt(l, laneButtonX(l, lane)), lane, `w=${w} lane=${lane}`);
    eq(laneAt(l, w / 2), null);
  }
});

// ── Grab ──

check("a fresh order starts with a card, and nothing is tossed or timed until it's gone", () => {
  const st = freshState({ rand: seeded() });
  eq(st.stage, "grab");
  eq(st.grab.card, "fresh");
  const time = st.grab.timeLeft;
  run(st, K.GRAB_CARD - 0.1);
  eq(st.grab.items.length, 0);
  eq(st.grab.timeLeft, time);
  run(st, 1.5);
  assert.ok(st.grab.items.some((i) => i.side === 0) && st.grab.items.some((i) => i.side === 1));
  assert.ok(st.grab.timeLeft < time);
});

check("things are tossed up from below and fall back down", () => {
  const st = freshState({ rand: seeded() });
  grabLive(st);
  run(st, 0.3);
  const it = st.grab.items[0];
  assert.ok(it.y > K.H * 0.6 && it.vy < 0, "starts low, going up");
  let peak = it.y;
  until(st, () => !st.grab.items.includes(it) || it.vy > 0, 10);
  peak = Math.min(peak, it.y);
  assert.ok(peak < K.H / 2, `peaks in the top half (${peak})`);
  until(st, () => !st.grab.items.includes(it), 10);
});

check("tapping during the card does nothing", () => {
  const st = freshState({ rand: seeded() });
  grabBottle(st, st.order.recipe[0]);
  eq(st.grab.got.length, 0);
});

check("only the order's un-grabbed bottles count as wanted", () => {
  const st = freshState({ rand: seeded() });
  grabLive(st);
  const need = st.order.recipe[0];
  const other = ["egg", "absinthe", "genepy", "rum"].find((k) => !wants(st, k))!;
  eq(isWanted(st, flying(0, "bottle", need, 1)), true);
  eq(isWanted(st, flying(0, "bottle", other, 2)), false);
  eq(isWanted(st, flying(0, "vodka", null, 3)), false);
  grabBottle(st, need);
  eq(isWanted(st, flying(0, "bottle", need, 4)), false, "already got");
});

check("grabbing the whole order goes to the build, which opens on its own card", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st, 1);
  eq(st.grab.done, true);
  update(st, DT);
  eq(st.stage, "build");
  assert.ok(st.build!.notes.length >= K.noteCount(1));
  run(st, K.BUILD_CARD - 0.1);
  eq(st.build!.clock, 0, "the bar waits for the card");
});

check("the wrong bottle costs points and time but no life", () => {
  const st = freshState({ rand: seeded() });
  grabLive(st);
  st.score = 500;
  const wrong = ["egg", "absinthe", "genepy", "rum"].find((k) => !wants(st, k))!;
  const before = st.grab.timeLeft;
  grabBottle(st, wrong);
  eq(st.score, 500 + K.PTS_WRONG_BOTTLE);
  eq(st.lives, K.SOLO_LIVES);
  assert.ok(st.grab.timeLeft <= before - K.WRONG_TIME_COST + 1e-9);
});

check("a bomb is a strike and clears its panel", () => {
  const st = freshState({ rand: seeded() });
  grabLive(st);
  run(st, 2);
  const bomb = flying(0, "bomb", null, 999);
  st.grab.items.push(bomb);
  pointerDown(st, 1, itemX(st, bomb), bomb.y);
  eq(st.lives, K.SOLO_LIVES - 1);
  eq(st.grab.items.filter((i) => i.side === 0).length, 0);
  eq(st.stage, "grab");
});

check("vodka stinks up the panel", () => {
  const st = freshState({ rand: seeded() });
  grabLive(st);
  const v = flying(1, "vodka", null, 998);
  st.grab.items.push(v);
  pointerDown(st, 1, itemX(st, v), v.y);
  assert.ok(st.grab.stinkT[1] > 0);
});

check("running out of time on a grab is a strike and a new order with a short card", () => {
  const st = freshState({ rand: seeded() });
  const first = st.order.key;
  run(st, K.GRAB_CARD + K.grabTime(1, true) + 0.5);
  eq(st.lives, K.SOLO_LIVES - 1);
  assert.notStrictEqual(st.order.key, first);
  eq(st.grab.card, "retry");
  eq(st.stage, "grab");
});

check("a wanted bottle always turns up", () => {
  const st = freshState({ rand: seeded(3) });
  grabLive(st);
  until(st, () => st.grab.items.some((it) => isWanted(st, it)), 4);
});

// ── Build ──

check("the chart never plays one lane three times running", () => {
  for (let seed = 1; seed < 40; seed++) {
    const notes = chartFor(1, seeded(seed));
    for (let i = 2; i < notes.length; i++) {
      assert.ok(!(notes[i].lane === notes[i - 1].lane && notes[i].lane === notes[i - 2].lane));
    }
  }
});

check("chords land on both thumbs at once, and not before level 4", () => {
  let chords = 0;
  for (let seed = 1; seed < 30; seed++) {
    const notes = chartFor(8, seeded(seed));
    for (let i = 1; i < notes.length; i++) {
      if (notes[i].t === notes[i - 1].t) {
        chords++;
        assert.notStrictEqual(notes[i].lane < 2, notes[i - 1].lane < 2, "a chord on one thumb");
      }
    }
  }
  assert.ok(chords > 0);
  for (let seed = 1; seed < 10; seed++) {
    assert.ok(chartFor(3, seeded(seed)).every((n, i, a) => i === 0 || n.t !== a[i - 1].t));
  }
});

check("a clean build goes to the finish, with the next order picked but not yet raining", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  const built = st.order.key;
  playBuild(st);
  eq(st.stage, "finish");
  eq(st.finish!.cocktail.key, built);
  assert.notStrictEqual(st.order.key, built);
  eq(st.grab.pending, true);
  assert.deepStrictEqual(st.grab.sides, [true, false]);
  eq(st.lives, K.SOLO_LIVES);
});

check("a build that misses too much is sent back", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  playBuild(st, 0.3);
  eq(st.lives, K.SOLO_LIVES - 1);
  eq(st.stage, "grab");
  assert.deepStrictEqual(st.grab.sides, [true, true]);
});

check("the bartender reacts: happy on a hit, worried on a miss", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  const b = st.build!;
  until(st, () => b.notes[0].judged !== null, 20);
  eq(b.notes[0].judged, "miss");
  eq(b.mood, "worried");
  const next = b.notes.find((n) => !n.judged)!;
  until(st, () => Math.abs(next.t - b.clock) < DT, 10);
  pointerDown(st, 1, laneButtonX(st.layout, next.lane), LANE_BUTTON_Y);
  eq(b.mood, "happy");
  assert.ok(st.fx.some((f) => f.kind === "toss"), "the bottle is tossed into the tin");
});

check("pressing a lane with nothing there is only a small penalty", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  run(st, K.BUILD_CARD + 0.05);
  const before = st.score;
  pointerDown(st, 1, laneButtonX(st.layout, 0), LANE_BUTTON_Y);
  eq(st.score, before + K.PTS_STRAY);
  eq(st.lives, K.SOLO_LIVES);
});

check("micro games start from level 2, freeze the highway and hand back", () => {
  const st = freshState({ rand: seeded(11) });
  st.served = 4;
  grabOrder(st);
  update(st, DT);
  assert.ok(st.build!.microAt.length >= 1);
  until(st, () => st.stage !== "build", 60);
  eq(st.stage, "micro");
  const clock = st.build!.clock;
  run(st, K.MICRO_INTRO + 0.05);
  eq(st.micro!.phase, "play");
  // Do nothing: every one of them is lost by waiting.
  until(st, () => st.stage !== "micro", 20);
  eq(st.stage, "build");
  eq(st.build!.clock - clock < 1e-9, true, "clock frozen during the micro");
  eq(st.microLosses, 1);
  eq(st.lives, K.SOLO_LIVES, "a micro game never costs a life");
});

check("attract mode never schedules micro games", () => {
  const st = freshState({ rand: seeded(), demo: true });
  st.served = 8;
  grabOrder(st);
  update(st, DT);
  eq(st.build!.microAt.length, 0);
});

// ── Finish ──

check("the shake comes first: its card, then the right thumb alone, then the order card", () => {
  const st = freshState({ rand: seeded() });
  toFinish(st);
  const f = st.finish!;
  eq(f.cardT > 0, true);
  const x = st.layout.rightX + st.layout.side / 2;
  pointerDown(st, 5, x, 100);
  pointerMove(st, 5, x, 200);
  pointerUp(st, 5);
  eq(f.strokes, 0, "input waits for the card");
  until(st, () => f.cardT === 0, 5);
  until(st, () => !st.grab.pending, 10, () => finishing(st));
  assert.ok(f.clock >= K.FINISH_LEAD - DT);
  eq(st.grab.card, "left");
  eq(st.grab.cardT > 0, true);
  eq(f.result, null, "still shaking when the grab comes up");
});

check("keeping it going for the whole shake serves the drink", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("daiquiri")!;
  toFinish(st);
  eq(st.finish!.cocktail.finish, "shake");
  until(st, () => st.finish!.result !== null, 20, () => finishing(st));
  eq(st.finish!.result, "served");
  eq(st.served, 1);
  eq(st.lives, K.SOLO_LIVES);
});

check("stirring round serves a stirred drink", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("negroni")!;
  toFinish(st);
  eq(st.finish!.cocktail.finish, "stir");
  until(st, () => st.finish!.result !== null, 20, () => finishing(st));
  eq(st.finish!.result, "served");
});

check("scrubbing straight across the mixing glass, or rocking on an arc, doesn't stir it", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("negroni")!;
  toFinish(st);
  run(st, K.FINISH_CARD + 0.05);
  const cx = st.layout.rightX + st.layout.side / 2;
  const cy = K.H * 0.52;
  pointerDown(st, 6, cx, cy - 60);
  for (let i = 0; i < 80; i++) {
    pointerMove(st, 6, cx, i % 2 ? cy - 60 : cy + 60);
    update(st, DT);
  }
  for (let i = 0; i < 120; i++) {
    const a = Math.sin(i / 6) * (Math.PI / 4);
    pointerMove(st, 6, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
    update(st, DT);
  }
  pointerUp(st, 6);
  assert.ok(st.finish!.stirBest < 0.2, `stirBest ${st.finish!.stirBest}`);
});

check("a tap on the shake panel does nothing: it has to move", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("daiquiri")!;
  toFinish(st);
  run(st, K.FINISH_CARD + 0.05);
  const x = st.layout.rightX + st.layout.side / 2;
  for (let i = 0; i < 40; i++) {
    pointerDown(st, 5, x, 150);
    pointerUp(st, 5);
  }
  eq(st.finish!.strokes, 0);
});

check("letting the shake stall ruins it: a strike, but the next order still comes up", () => {
  const st = freshState({ rand: seeded() });
  toFinish(st);
  const order = st.order.key;
  run(st, K.FINISH_CARD + K.FINISH_GRACE + K.FINISH_SLOW_TOLERANCE + 1.5);
  eq(st.finish!.result, "ruined");
  eq(st.lives, K.SOLO_LIVES - 1);
  eq(st.order.key, order);
  until(st, () => !st.grab.pending, 5);
  eq(st.stage, "finish");
});

check("both hands at once: grab on the left while shaking, then build when both are done", () => {
  const st = freshState({ rand: seeded() });
  toFinish(st);
  grabOrder(st, 0);
  eq(st.grab.done, true);
  eq(st.stage, "finish", "waits for the drink");
  until(st, () => st.finish!.result !== null, 20, () => finishing(st));
  eq(st.finish!.result, "served");
  run(st, K.RESULT_HOLD - 0.1);
  eq(st.stage, "finish", "the guest gets their moment");
  run(st, 0.2);
  eq(st.stage, "build");
  eq(level(st), 2);
});

check("the drink finishing first waits for the grab", () => {
  const st = freshState({ rand: seeded() });
  toFinish(st);
  until(st, () => st.finish!.result !== null, 20, () => finishing(st));
  run(st, K.RESULT_HOLD + 0.5);
  eq(st.stage, "finish");
  grabOrder(st, 0);
  update(st, DT);
  eq(st.stage, "build");
});

check("three strikes ends a solo run and reports once", () => {
  const st = freshState({ rand: seeded() });
  let reports = 0;
  for (let i = 0; i < 60 * 90 && reports === 0; i++) if (update(st, DT).finished) reports++;
  eq(st.stage, "over");
  eq(reports, 1);
  eq(run(st, 5), false);
});

check("the attract-mode bot serves drinks on its own", () => {
  const st = freshState({ rand: seeded(21), demo: true });
  const bot = newBot();
  for (let i = 0; i < 60 * 150 && st.stage !== "over"; i++) {
    botStep(bot, st, DT);
    update(st, DT);
  }
  assert.ok(st.served >= 2, `served ${st.served}`);
});

// ── Micro games ──

check("beer: a gentle pour fills the glass", () => {
  const s = newBeer(1);
  microPress(s, 0, 0, 1);
  s.aim = 0.55;
  let out = null;
  for (let i = 0; i < 60 * 8 && !out; i++) out = updateMicro(s, DT);
  eq(out, "win");
});

check("beer: slamming it foams over the line", () => {
  const s = newBeer(1);
  microPress(s, 0, 20, 1);
  eq(beerAimFor(20), 1);
  let out = null;
  for (let i = 0; i < 60 * 8 && !out; i++) out = updateMicro(s, DT);
  eq(out, "lose");
  assert.ok(s.liquid + s.foam > BEER_LINE);
});

check("shots: nothing pours until the bottle is grabbed", () => {
  const s = newShots(1, 640);
  microPress(s, s.glasses[2].x, 150, 1);
  for (let i = 0; i < 60; i++) updateMicro(s, DT);
  eq(s.grabbed, false);
  eq(s.spill, 0);
});

check("shots: grab it and pour glass to glass to win", () => {
  const s = newShots(1, 640);
  microPress(s, s.bottleX, SHOT_REST_Y, 1);
  eq(s.grabbed, true);
  let out = null;
  for (const g of s.glasses) {
    microMove(s, g.x, 150, 1);
    for (let i = 0; i < 60 * 2 && !out && g.fill < 0.9; i++) out = updateMicro(s, DT);
  }
  eq(out, "win");
});

check("shots: pouring on the bar loses", () => {
  const bad = newShots(1, 640);
  microPress(bad, bad.bottleX, SHOT_REST_Y, 1);
  let out = null;
  for (let i = 0; i < 60 * 3 && !out; i++) out = updateMicro(bad, DT);
  eq(out, "lose");
});

check("pop: a cork down the middle lands where the maths says", () => {
  const w = 640;
  const s = newPop(1, w, seeded(2));
  s.bucketSlot = 2;
  s.guests = [];
  s.phase = 0;
  s.swaySpeed = 0;
  updateMicro(s, DT);
  eq(popLandX(w, 0), w / 2);
  microPress(s, 0, 0, 1);
  let out = null;
  for (let i = 0; i < 60 && !out; i++) out = updateMicro(s, DT);
  eq(out, "win");
});

check("pop: never tapping loses", () => {
  const s = newPop(1, 640, seeded(4));
  let out = null;
  for (let i = 0; i < 60 * 10 && !out; i++) out = updateMicro(s, DT);
  eq(out, "lose");
});

// ── Party ──

check("party mode opens on a handoff to a random player", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C"], rand: seeded() });
  eq(st.stage, "handoff");
  eq(st.handoff!.reason, "start");
  run(st, K.HANDOFF_SECONDS + 0.05);
  eq(st.stage, "grab");
  eq(st.grab.card, "fresh");
});

check("a handoff can be tapped through, but not straight away", () => {
  const st = freshState({ mode: "party", names: ["A", "B"], rand: seeded() });
  pointerDown(st, 1, 300, 150);
  eq(st.stage, "handoff");
  run(st, K.HANDOFF_TAP_GUARD + 0.05);
  pointerDown(st, 1, 300, 150);
  eq(st.stage, "grab");
});

check("a served drink passes the phone to someone else, who picks up the grab after a card", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C", "D"], rand: seeded(5) });
  run(st, K.HANDOFF_SECONDS + 0.05);
  const first = st.current;
  toFinish(st);
  grabLive(st);
  grabBottle(st, st.order.recipe[0]);
  until(st, () => st.stage === "handoff", 30, () => finishing(st));
  eq(st.handoff!.reason, "served");
  assert.notStrictEqual(st.handoff!.to, first);
  eq(st.handoff!.resume, "finish");
  run(st, K.HANDOFF_SECONDS + 0.05);
  eq(st.stage, "finish");
  eq(st.grab.got.length, 1, "the grab in progress carried over");
  eq(st.grab.card, "turn");
  eq(st.players[first].drinks, 1);
  grabOrder(st, 0);
  update(st, DT);
  eq(st.stage, "build", "and it carries on into the build");
});

check("a strike knocks the holder out and hands off on a fresh order", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C"], rand: seeded() });
  run(st, K.HANDOFF_SECONDS + 0.05);
  const out = st.current;
  run(st, K.GRAB_CARD + K.grabTime(1, true) + 0.5);
  eq(st.players[out].alive, false);
  eq(st.stage, "handoff");
  eq(st.handoff!.reason, "out");
  assert.notStrictEqual(st.handoff!.to, out);
  eq(st.players[st.handoff!.to].alive, true);
});

check("the last one standing plays on without handing to themselves", () => {
  const st = freshState({ mode: "party", names: ["A", "B"], rand: seeded() });
  run(st, K.HANDOFF_SECONDS + 0.05);
  run(st, K.GRAB_CARD + K.grabTime(1, true) + 0.5);
  run(st, K.HANDOFF_SECONDS + 0.05);
  eq(st.players.filter((p) => p.alive).length, 1);
  eq(st.banner?.text, "LAST ONE STANDING!");
  toFinish(st);
  until(st, () => st.finish!.result !== null, 20, () => finishing(st));
  run(st, K.RESULT_HOLD + 0.1);
  assert.notStrictEqual(st.stage, "handoff");
});

check("everyone out ends the run with the team's score and each player's share", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C"], rand: seeded() });
  let finished = false;
  for (let i = 0; i < 60 * 200 && !finished; i++) finished = update(st, DT).finished;
  eq(finished, true);
  eq(st.players.every((p) => !p.alive), true);
  const d = runDetail(st);
  eq(d.mode, "party");
  eq((d.players as unknown[]).length, 3);
});

check("points are credited to whoever earned them", () => {
  const st = freshState({ mode: "party", names: ["A", "B"], rand: seeded() });
  run(st, K.HANDOFF_SECONDS + 0.05);
  grabLive(st);
  grabBottle(st, st.order.recipe[0]);
  eq(st.players[st.current].points, K.PTS_GRAB);
  eq(st.players[1 - st.current].points, 0);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
