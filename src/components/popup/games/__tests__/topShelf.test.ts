// Top Shelf — driving the real physics frame by frame.
import assert from "node:assert";
import {
  BOTTLE_H,
  freshState,
  ladderAt,
  laddersFor,
  LADDER_W,
  MAX_LIVES,
  PTS_BOTTLE,
  PTS_CATCH,
  shelfY,
  update,
  type State,
} from "../topShelfCore";

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const DT = 1 / 60;
const run = (st: State, secs: number) => {
  for (let i = 0; i < Math.round(secs / DT); i++) update(st, DT);
};

function playing(): State {
  const st = freshState();
  st.introSkipped = true;
  update(st, DT);
  // Stop bottles spawning unless a test wants them
  st.spawnTimer = 1e9;
  st.bottles = [];
  return st;
}

console.log("\nIntro:");

check("starts in the cutscene", () => {
  assert.strictEqual(freshState().phase, "intro");
});

check("a button press skips the cutscene", () => {
  const st = freshState();
  st.introSkipped = true;
  update(st, DT);
  assert.strictEqual(st.phase, "play");
});

check("the cutscene ends on its own", () => {
  const st = freshState();
  run(st, 9);
  assert.strictEqual(st.phase, "play");
});

console.log("\nShelves and ladders:");

check("every shelf has at least one ladder", () => {
  for (let i = 0; i < 60; i++) {
    assert.ok(laddersFor(i).length >= 1, `shelf ${i} had no ladder`);
  }
});

check("ladders stay on screen", () => {
  for (let i = 0; i < 60; i++) {
    for (const lx of laddersFor(i)) {
      assert.ok(lx >= 0 && lx + LADDER_W <= 224, `ladder at ${lx} off screen on shelf ${i}`);
    }
  }
});

check("shelf geometry is deterministic", () => {
  assert.deepStrictEqual(laddersFor(7), laddersFor(7));
  assert.deepStrictEqual(laddersFor(31), laddersFor(31));
});

check("standing at a ladder base is detected", () => {
  const lx = laddersFor(0)[0] + LADDER_W / 2;
  assert.ok(ladderAt(lx, shelfY(0)) !== null);
});

check("standing away from a ladder is not", () => {
  const lx = laddersFor(0)[0] + LADDER_W / 2;
  assert.strictEqual(ladderAt(lx + 40, shelfY(0)), null);
});

console.log("\nMovement:");

check("walking right moves the player right", () => {
  const st = playing();
  const x0 = st.px;
  st.input.right = true;
  run(st, 0.5);
  assert.ok(st.px > x0 + 10, `moved only ${st.px - x0}`);
  assert.strictEqual(st.face, 1);
});

check("the player can't walk off either edge", () => {
  const st = playing();
  st.input.left = true;
  run(st, 8);
  assert.ok(st.px >= 6, `px was ${st.px}`);
  st.input.left = false;
  st.input.right = true;
  run(st, 12);
  assert.ok(st.px <= 224 - 6, `px was ${st.px}`);
});

check("jumping leaves the ground and lands back on the same shelf", () => {
  const st = playing();
  const groundY = st.py;
  st.input.jump = true;
  update(st, DT);
  st.input.jump = false;
  assert.strictEqual(st.onGround, false);

  let peak = groundY;
  for (let i = 0; i < 60 * 3; i++) {
    update(st, DT);
    peak = Math.min(peak, st.py);
    if (st.onGround) break;
  }
  assert.ok(peak < groundY - 15, `only rose ${groundY - peak}px`);
  assert.strictEqual(st.onGround, true);
  assert.ok(Math.abs(st.py - groundY) < 0.5, `landed at ${st.py} not ${groundY}`);
});

check("climbing a ladder reaches the shelf above", () => {
  const st = playing();
  const lx = laddersFor(0)[0] + LADDER_W / 2;
  st.px = lx;
  st.py = shelfY(0);
  st.input.up = true;
  run(st, 3);
  assert.ok(Math.abs(st.py - shelfY(1)) < 1, `ended at ${st.py}, wanted ${shelfY(1)}`);
  assert.strictEqual(st.climbing, false, "should stop climbing on arrival");
});

check("climbing scores progress for the shelf reached", () => {
  const st = playing();
  const lx = laddersFor(0)[0] + LADDER_W / 2;
  st.px = lx;
  st.py = shelfY(0);
  const before = st.score;
  st.input.up = true;
  run(st, 3);
  assert.ok(st.score > before, "climbing a shelf should score");
  assert.strictEqual(st.highestShelf, 1);
});

check("pressing up away from a ladder does nothing", () => {
  const st = playing();
  st.px = 112;
  st.py = shelfY(0);
  // Make sure 112 isn't on a ladder for shelf 0
  const onLadder = ladderAt(112, shelfY(0));
  if (onLadder) st.px = 112 + 40;
  const y0 = st.py;
  st.input.up = true;
  run(st, 1);
  assert.ok(Math.abs(st.py - y0) < 1, `drifted to ${st.py}`);
});

console.log("\nBottles:");

check("a bottle hit costs a life", () => {
  const st = playing();
  st.bottles = [
    { x: st.px - 4, y: st.py - BOTTLE_H, dir: 1, shelf: 0, falling: false, jumped: false },
  ];
  update(st, DT);
  assert.strictEqual(st.lives, MAX_LIVES - 1);
  assert.strictEqual(st.phase, "hit");
});

check("three hits ends the game", () => {
  const st = playing();
  for (let life = 0; life < MAX_LIVES; life++) {
    st.invuln = 0;
    st.phase = "play";
    st.bottles = [
      { x: st.px - 4, y: st.py - BOTTLE_H, dir: 1, shelf: 0, falling: false, jumped: false },
    ];
    update(st, DT);
  }
  assert.strictEqual(st.lives, 0);
  assert.strictEqual(st.phase, "over");
});

check("invulnerability protects right after a hit", () => {
  const st = playing();
  st.bottles = [
    { x: st.px - 4, y: st.py - BOTTLE_H, dir: 1, shelf: 0, falling: false, jumped: false },
  ];
  update(st, DT);
  const lives = st.lives;
  st.phase = "play";
  for (let i = 0; i < 30; i++) update(st, DT);
  assert.strictEqual(st.lives, lives, "should not lose a second life while flashing");
});

check("jumping over a bottle scores", () => {
  const st = playing();
  // Airborne, above a bottle that's horizontally under us
  st.onGround = false;
  st.vy = -50;
  st.py = shelfY(0) - 30;
  st.highestShelf = 99;          // isolate from the climb-progress bonus
  st.bottles = [
    { x: st.px - 4, y: shelfY(0) - BOTTLE_H, dir: 1, shelf: 0, falling: false, jumped: false },
  ];
  const before = st.score;
  update(st, DT);
  assert.strictEqual(st.score - before, PTS_BOTTLE);
  assert.strictEqual(st.bottles[0].jumped, true);
});

check("a bottle is only scored once", () => {
  const st = playing();
  st.onGround = false;
  st.vy = -50;
  st.py = shelfY(0) - 30;
  st.bottles = [
    { x: st.px - 4, y: shelfY(0) - BOTTLE_H, dir: 1, shelf: 0, falling: false, jumped: false },
  ];
  update(st, DT);
  const after = st.score;
  st.vy = -50;
  for (let i = 0; i < 5; i++) update(st, DT);
  assert.strictEqual(st.score, after);
});

check("bottles turn around at the edges and drop a shelf", () => {
  const st = playing();
  const b = { x: 220, y: shelfY(5) - BOTTLE_H, dir: 1 as 1 | -1, shelf: 5, falling: false, jumped: false };
  st.bottles = [b];
  st.px = 10;              // keep the player well away
  st.py = shelfY(0);
  update(st, DT);
  assert.strictEqual(b.dir, -1, "should reverse at the right edge");
  assert.strictEqual(b.shelf, 4, "should drop to the shelf below");
});

console.log("\nThe thief:");

check("catching the thief scores and sends him higher", () => {
  const st = playing();
  const shelf0 = st.thiefShelf;
  st.py = shelfY(st.thiefShelf);
  st.px = st.thiefX;
  st.highestShelf = 99;          // isolate from the climb-progress bonus
  const before = st.score;
  update(st, DT);
  assert.strictEqual(st.score - before, PTS_CATCH);
  assert.strictEqual(st.thiefShelf, shelf0 + 4);
  assert.strictEqual(st.wave, 2);
  assert.strictEqual(st.phase, "catch");
});

check("each catch makes the bottles come faster", () => {
  const st = playing();
  const gap0 = st.spawnGap;
  const speed0 = st.bottleSpeed;
  st.py = shelfY(st.thiefShelf);
  st.px = st.thiefX;
  update(st, DT);
  assert.ok(st.spawnGap < gap0, "spawn gap should shrink");
  assert.ok(st.bottleSpeed > speed0, "bottles should speed up");
});

check("catching resumes play after the pause", () => {
  const st = playing();
  st.py = shelfY(st.thiefShelf);
  st.px = st.thiefX;
  update(st, DT);
  assert.strictEqual(st.phase, "catch");
  run(st, 2);
  assert.strictEqual(st.phase, "play");
});

check("the thief patrols within the screen", () => {
  const st = playing();
  for (let i = 0; i < 60 * 40; i++) {
    update(st, DT);
    assert.ok(st.thiefX > 10 && st.thiefX < 214, `thief wandered to ${st.thiefX}`);
    if (st.phase !== "play") { st.phase = "play"; }
  }
});

console.log("\nEnding:");

check("the run reports finished after the game-over hold", () => {
  const st = playing();
  st.phase = "over";
  st.phaseT = 0;
  let finished = false;
  for (let i = 0; i < 60 * 5; i++) if (update(st, DT).finished) { finished = true; break; }
  assert.ok(finished);
});

check("a long unattended run stays stable", () => {
  const st = freshState();
  st.introSkipped = true;
  for (let i = 0; i < 60 * 120; i++) {
    update(st, DT);
    assert.ok(Number.isFinite(st.px) && Number.isFinite(st.py), "position went non-finite");
    assert.ok(st.bottles.length <= 41, `bottles grew to ${st.bottles.length}`);
    if (st.phase === "over") break;
  }
});

console.log(`\n${passed} checks passed.\n`);
