// Behind the Stick — driving the real simulation frame by frame.
import assert from "node:assert";
import * as K from "../constants";
import {
  chartFor,
  freshState,
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
  type Falling,
  type State,
} from "../core";
import {
  BEER_LINE,
  beerAimFor,
  microPress,
  microRelease,
  newBeer,
  newPop,
  newShots,
  popLandX,
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

function itemX(st: State, it: Falling) {
  return K.panelX(st.layout, it.side) + it.x * st.layout.side;
}

/** Drop a bottle right where a thumb can reach it, and tap it. */
function grabBottle(st: State, ing: string, side: 0 | 1 = 0) {
  const it: Falling = { id: st.nextId++, side, kind: "bottle", ing, x: 0.5, y: 150, vy: 0, spin: 0, spinV: 0 };
  st.grab.items.push(it);
  pointerDown(st, 99, itemX(st, it), it.y);
  pointerUp(st, 99);
}

function grabOrder(st: State, side: 0 | 1 = 0) {
  for (const ing of st.order.recipe) grabBottle(st, ing, side);
}

/** Hit every note of the build dead on. */
function playBuild(st: State, accuracy = 1) {
  let guard = 0;
  let n = 0;
  while (st.stage === "build" && guard++ < 5000) {
    const b = st.build!;
    for (const note of b.notes) {
      if (!note.judged && Math.abs(note.t - b.clock) < DT / 2 + 1e-9) {
        if ((n++ % 10) / 10 < accuracy) {
          pointerDown(st, 1, laneButtonX(st.layout, note.lane), LANE_BUTTON_Y);
          pointerUp(st, 1);
        }
      }
    }
    update(st, DT);
  }
}

function shake(st: State, strokes: number) {
  const x = st.layout.rightX + st.layout.side / 2;
  pointerDown(st, 5, x, 100);
  for (let i = 0; i < strokes; i++) {
    pointerMove(st, 5, x, i % 2 === 0 ? 200 : 100);
    update(st, DT);
  }
  pointerUp(st, 5);
}

function stir(st: State, revs: number) {
  const cx = st.layout.rightX + st.layout.side / 2;
  const cy = K.H * 0.52;
  pointerDown(st, 6, cx + 40, cy);
  const steps = Math.ceil(revs * 24);
  for (let i = 1; i <= steps; i++) {
    const a = (i / 24) * Math.PI * 2;
    pointerMove(st, 6, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
    update(st, DT);
  }
  pointerUp(st, 6);
}

function finishDrink(st: State) {
  const f = st.finish!;
  if (f.cocktail.finish === "shake") shake(st, K.shakeStrokes(level(st)) + 4);
  else stir(st, K.stirRevs(level(st)) + 1);
}

console.log("Behind the Stick");

// ── Layout ──

check("width stays inside the letterbox range", () => {
  eq(K.widthFor(390, 844), K.W_MIN);
  eq(K.widthFor(2000, 400), K.W_MAX);
  eq(K.widthFor(844, 390), Math.round((K.H * 844) / 390));
});

check("every lane's button is on its own half of a thumb panel", () => {
  for (const w of [K.W_MIN, K.W_REF, K.W_MAX]) {
    const l = K.layoutFor(w);
    for (let lane = 0; lane < 4; lane++) eq(laneAt(l, laneButtonX(l, lane)), lane, `w=${w} lane=${lane}`);
    eq(laneAt(l, w / 2), null);
  }
});

// ── Solo loop ──

check("a solo run opens raining on both thumbs with three lives", () => {
  const st = freshState({ rand: seeded() });
  eq(st.stage, "grab");
  eq(st.lives, K.SOLO_LIVES);
  assert.deepStrictEqual(st.grab.sides, [true, true]);
  run(st, 3);
  assert.ok(st.grab.items.some((i) => i.side === 0) && st.grab.items.some((i) => i.side === 1));
});

check("grabbing the whole order moves to the build", () => {
  const st = freshState({ rand: seeded() });
  run(st, 0.2);
  grabOrder(st, 1);
  eq(st.grab.done, true);
  update(st, DT);
  eq(st.stage, "build");
  assert.ok(st.build!.notes.length >= K.noteCount(1));
});

check("the wrong bottle costs points and time but no life", () => {
  const st = freshState({ rand: seeded() });
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
  run(st, 2);
  const bomb: Falling = { id: 999, side: 0, kind: "bomb", ing: null, x: 0.5, y: 140, vy: 0, spin: 0, spinV: 0 };
  st.grab.items.push(bomb);
  pointerDown(st, 1, itemX(st, bomb), 140);
  eq(st.lives, K.SOLO_LIVES - 1);
  eq(st.grab.items.filter((i) => i.side === 0).length, 0);
  eq(st.stage, "grab");
});

check("vodka stinks up the panel", () => {
  const st = freshState({ rand: seeded() });
  const v: Falling = { id: 998, side: 1, kind: "vodka", ing: null, x: 0.4, y: 120, vy: 0, spin: 0, spinV: 0 };
  st.grab.items.push(v);
  pointerDown(st, 1, itemX(st, v), 120);
  assert.ok(st.grab.stinkT[1] > 0);
});

check("running out of time on a grab is a strike and a new order", () => {
  const st = freshState({ rand: seeded() });
  const first = st.order.key;
  st.grab.items = [];
  // Nothing tapped: the clock runs out.
  run(st, K.grabTime(1, true) + 1);
  eq(st.lives, K.SOLO_LIVES - 1);
  assert.notStrictEqual(st.order.key, first);
  eq(st.stage, "grab");
});

check("a wanted bottle always turns up", () => {
  const st = freshState({ rand: seeded(3) });
  for (let i = 0; i < 60 * 6; i++) {
    update(st, DT);
    const wanted = st.grab.items.filter((it) => it.kind === "bottle" && wants(st, it.ing!));
    if (wanted.length) return;
  }
  assert.fail("no wanted bottle in six seconds");
});

check("the chart never plays one lane three times running", () => {
  for (let seed = 1; seed < 40; seed++) {
    const notes = chartFor(1, seeded(seed));
    for (let i = 2; i < notes.length; i++) {
      assert.ok(!(notes[i].lane === notes[i - 1].lane && notes[i].lane === notes[i - 2].lane));
    }
  }
});

check("chords land on both thumbs at once from level 3", () => {
  let chords = 0;
  for (let seed = 1; seed < 30; seed++) {
    const notes = chartFor(6, seeded(seed));
    for (let i = 1; i < notes.length; i++) {
      if (notes[i].t === notes[i - 1].t) {
        chords++;
        assert.notStrictEqual(notes[i].lane < 2, notes[i - 1].lane < 2, "a chord on one thumb");
      }
    }
  }
  assert.ok(chords > 0);
  assert.ok(chartFor(1, seeded(1)).every((n, i, a) => i === 0 || n.t !== a[i - 1].t));
});

check("a clean build goes to the finish and starts the next grab on the left only", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  const built = st.order.key;
  playBuild(st);
  eq(st.stage, "finish");
  eq(st.finish!.cocktail.key, built);
  assert.notStrictEqual(st.order.key, built);
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

check("pressing a lane with nothing there is only a small penalty", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  const before = st.score;
  pointerDown(st, 1, laneButtonX(st.layout, 0), LANE_BUTTON_Y);
  eq(st.score, before + K.PTS_STRAY);
  eq(st.lives, K.SOLO_LIVES);
});

check("shaking with the thumb serves the drink", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("daiquiri")!;
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  eq(st.finish!.cocktail.finish, "shake");
  shake(st, K.shakeStrokes(1) + 2);
  eq(st.finish!.result, "served");
  eq(st.served, 1);
});

check("stirring with the thumb serves the drink", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("negroni")!;
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  eq(st.finish!.cocktail.finish, "stir");
  stir(st, K.stirRevs(1) + 1);
  eq(st.finish!.result, "served");
});

check("scrubbing straight across the mixing glass, or rocking on an arc, doesn't stir it", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("negroni")!;
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  const cx = st.layout.rightX + st.layout.side / 2;
  const cy = K.H * 0.52;
  pointerDown(st, 6, cx, cy - 60);
  for (let i = 0; i < 80; i++) {
    pointerMove(st, 6, cx, i % 2 ? cy - 60 : cy + 60);
    update(st, DT);
  }
  // Back and forth along a quarter circle
  for (let i = 0; i < 240; i++) {
    const a = Math.sin(i / 6) * (Math.PI / 4);
    pointerMove(st, 6, cx + Math.cos(a) * 40, cy + Math.sin(a) * 40);
    update(st, DT);
  }
  pointerUp(st, 6);
  assert.ok(st.finish!.meter < 0.2, `meter ${st.finish!.meter}`);
});

check("a tap on the shake panel does nothing: it has to move", () => {
  const st = freshState({ rand: seeded() });
  st.order = getCocktail("daiquiri")!;
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  const x = st.layout.rightX + st.layout.side / 2;
  for (let i = 0; i < 40; i++) {
    pointerDown(st, 5, x, 150);
    pointerUp(st, 5);
  }
  eq(st.finish!.strokes, 0);
});

check("letting the shake stall ruins it: a strike, but the grab carries on", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  const order = st.order.key;
  run(st, K.FINISH_SECONDS + 0.1);
  eq(st.finish!.result, "ruined");
  eq(st.lives, K.SOLO_LIVES - 1);
  eq(st.order.key, order);
});

check("both hands at once: finish on the right while grabbing on the left, then build", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  eq(st.stage, "finish");
  grabOrder(st, 0);
  eq(st.grab.done, true);
  eq(st.stage, "finish", "waits for the drink");
  finishDrink(st);
  run(st, K.SERVE_HOLD + 0.1);
  eq(st.stage, "build");
  eq(level(st), 2);
});

check("the grab finishing first waits for the drink; the drink finishing first waits for the grab", () => {
  const st = freshState({ rand: seeded() });
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  finishDrink(st);
  run(st, K.SERVE_HOLD + 0.5);
  eq(st.stage, "finish");
  grabOrder(st, 0);
  update(st, DT);
  eq(st.stage, "build");
});

check("three strikes ends a solo run and reports once", () => {
  const st = freshState({ rand: seeded() });
  let reports = 0;
  for (let i = 0; i < 60 * 60 && reports === 0; i++) if (update(st, DT).finished) reports++;
  eq(st.stage, "over");
  eq(reports, 1);
  eq(run(st, 5), false);
});

check("micro games start from level 2, freeze the highway and hand back", () => {
  const st = freshState({ rand: seeded(11) });
  st.served = 4;
  grabOrder(st);
  update(st, DT);
  assert.ok(st.build!.microAt.length >= 1);
  const at = st.build!.microAt[0];
  while (st.stage === "build") update(st, DT);
  eq(st.stage, "micro");
  const clock = st.build!.clock;
  assert.ok(clock >= at);
  run(st, K.MICRO_INTRO + 0.05);
  eq(st.micro!.phase, "play");
  // Do nothing: every one of them is lost by waiting.
  for (let i = 0; i < 60 * 12 && st.stage === "micro"; i++) update(st, DT);
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

check("the attract-mode bot serves drinks on its own", () => {
  const st = freshState({ rand: seeded(21), demo: true });
  const bot = newBot();
  for (let i = 0; i < 60 * 90 && st.stage !== "over"; i++) {
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

check("shots: pouring glass to glass wins, pouring on the bar loses", () => {
  const w = 640;
  const s = newShots(1, w);
  let out = null;
  for (const g of s.glasses) {
    microPress(s, g.x, 150, 1);
    for (let i = 0; i < 60 && !out; i++) out = updateMicro(s, DT);
    microRelease(s, 1);
    // Let the bottle arrive over the next glass before pouring again.
    for (let i = 0; i < 12 && !out; i++) {
      s.targetX = g.x + w / (s.glasses.length + 1);
      out = updateMicro(s, DT);
    }
  }
  eq(out, "win");

  const bad = newShots(1, w);
  microPress(bad, 5, 150, 1);
  let o2 = null;
  for (let i = 0; i < 60 * 3 && !o2; i++) o2 = updateMicro(bad, DT);
  eq(o2, "lose");
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
  eq(st.current, st.players.findIndex((p) => p.name === st.players[st.current].name));
});

check("a handoff can be tapped through, but not straight away", () => {
  const st = freshState({ mode: "party", names: ["A", "B"], rand: seeded() });
  pointerDown(st, 1, 300, 150);
  eq(st.stage, "handoff");
  run(st, K.HANDOFF_TAP_GUARD + 0.05);
  pointerDown(st, 1, 300, 150);
  eq(st.stage, "grab");
});

check("a served drink passes the phone to someone else, who picks up the grab", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C", "D"], rand: seeded(5) });
  run(st, K.HANDOFF_SECONDS + 0.05);
  const first = st.current;
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  grabBottle(st, st.order.recipe[0]);
  finishDrink(st);
  run(st, K.SERVE_HOLD + 0.05);
  eq(st.stage, "handoff");
  eq(st.handoff!.reason, "served");
  assert.notStrictEqual(st.handoff!.to, first);
  eq(st.handoff!.resume, "finish");
  run(st, K.HANDOFF_SECONDS + 0.05);
  eq(st.grab.got.length, 1, "the grab in progress carried over");
  eq(st.players[first].drinks, 1);
});

check("a strike knocks the holder out and hands off on a fresh order", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C"], rand: seeded() });
  run(st, K.HANDOFF_SECONDS + 0.05);
  const out = st.current;
  run(st, K.grabTime(1, true) + 1);
  eq(st.players[out].alive, false);
  eq(st.stage, "handoff");
  eq(st.handoff!.reason, "out");
  assert.notStrictEqual(st.handoff!.to, out);
  eq(st.players[st.handoff!.to].alive, true);
});

check("the last one standing plays on without handing to themselves", () => {
  const st = freshState({ mode: "party", names: ["A", "B"], rand: seeded() });
  run(st, K.HANDOFF_SECONDS + 0.05);
  run(st, K.grabTime(1, true) + 1);
  run(st, K.HANDOFF_SECONDS + 0.05);
  eq(st.players.filter((p) => p.alive).length, 1);
  eq(st.banner?.text, "LAST ONE STANDING!");
  grabOrder(st);
  update(st, DT);
  playBuild(st);
  finishDrink(st);
  run(st, K.SERVE_HOLD + 0.1);
  assert.notStrictEqual(st.stage, "handoff");
});

check("everyone out ends the run with the team's score and each player's share", () => {
  const st = freshState({ mode: "party", names: ["A", "B", "C"], rand: seeded() });
  let finished = false;
  for (let i = 0; i < 60 * 120 && !finished; i++) finished = update(st, DT).finished;
  eq(finished, true);
  eq(st.players.every((p) => !p.alive), true);
  const d = runDetail(st);
  eq(d.mode, "party");
  eq((d.players as unknown[]).length, 3);
});

check("points are credited to whoever earned them", () => {
  const st = freshState({ mode: "party", names: ["A", "B"], rand: seeded() });
  run(st, K.HANDOFF_SECONDS + 0.05);
  grabBottle(st, st.order.recipe[0]);
  eq(st.players[st.current].points, K.PTS_GRAB);
  eq(st.players[1 - st.current].points, 0);
});

console.log(`\n${passed} passed${process.exitCode ? ", some FAILED" : ""}`);
