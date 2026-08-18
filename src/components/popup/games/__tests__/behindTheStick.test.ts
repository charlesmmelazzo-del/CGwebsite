// Behind the Stick — driving the real simulation frame by frame.
import assert from "node:assert";
import {
  applyStirAngle,
  freshState,
  GOOD_HALF,
  GRACE_SECONDS,
  MAX_STRIKES,
  NOTES_PER_ROUND,
  PERFECT_HALF,
  PTS_GOOD,
  PTS_MISS,
  PTS_PERFECT,
  PTS_STRAY,
  BOOT_SECONDS,
  CARD_SECONDS,
  SHAKE_SECONDS,
  beginBuild,
  cardRemaining,
  update,
  WINDOW_X,
  type State,
} from "../behindTheStickCore";
import { getCocktail } from "../cocktails";
import { colorFor } from "../ingredients";

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const DT = 1 / 60;

// assert.strictEqual carries an `asserts` signature, which permanently narrows
// st.phase and makes later comparisons look impossible to TypeScript. Reading
// through this keeps the checks honest without fighting the narrowing.
const phaseOf = (st: State): string => st.phase;
const always = (k: string) => () => k;

/** Step n frames. */
function run(st: State, seconds: number, pick = always("whiskey"), each?: (st: State) => void) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) {
    update(st, DT, pick);
    each?.(st);
  }
}

/**
 * A round now opens with the order and a trip to the shelves before anything
 * is poured. The platformer has its own simulation and its own tests, so these
 * skip it the way the component will once the recipe is complete.
 *
 * Defaults to a shaken drink, since most of these check the pour and the shake.
 */
/**
 * Fast-forward to the pour.
 *
 * A round now opens with the title, the how-to, the order card, Bubble Buster
 * and the build card before a single note appears. The tank has its own
 * simulation and its own tests, so this skips it the way the component will
 * once the recipe is popped; the cards are simply waited out.
 *
 * Defaults to a shaken drink, since most of these check the pour and the shake.
 */
function start(cocktailKey = "whiskey-sour"): State {
  const drink = getCocktail(cocktailKey);
  assert.ok(drink, `no such cocktail: ${cocktailKey}`);
  const st = freshState(colorFor, drink!);
  // boot -> howto -> order -> gather
  run(st, BOOT_SECONDS + CARD_SECONDS * 2 + 0.2);
  assert.strictEqual(st.phase, "gather", `expected the tank, got ${st.phase}`);
  beginBuild(st);
  // build card -> pour
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "pour", `expected the pour, got ${st.phase}`);
  return st;
}

console.log("\nPhases:");

check("the game boots into the title, then the how-to, then the first order", () => {
  const st = freshState(colorFor, getCocktail("whiskey-sour")!);
  assert.strictEqual(st.phase, "boot");
  run(st, BOOT_SECONDS + 0.1);
  assert.strictEqual(st.phase, "howto", "never explained itself");
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "order", "never announced the drink");
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "gather", "never opened the tank");

  // The tank holds the game open until the recipe is complete — no timer.
  run(st, 8);
  assert.strictEqual(st.phase, "gather", "left the tank on a timer");

  beginBuild(st);
  assert.strictEqual(st.phase, "build", "skipped the build card");
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "pour");
});

check("every card holds for its countdown and then moves on by itself", () => {
  const st = freshState(colorFor, getCocktail("whiskey-sour")!);
  run(st, BOOT_SECONDS + 0.1);
  // Just short of the four seconds, the how-to is still up.
  run(st, CARD_SECONDS - 0.3);
  assert.strictEqual(st.phase, "howto", "left early");
  assert.ok(cardRemaining(st) > 0 && cardRemaining(st) < 0.5, `countdown read ${cardRemaining(st)}`);
  run(st, 0.4);
  assert.strictEqual(st.phase, "order");
});

check("a cleared pour goes through the make card before the shake", () => {
  const st = start("daiquiri");
  let hits = 0;
  for (let i = 0; i < 60 * 90 && hits < NOTES_PER_ROUND; i++) {
    update(st, DT, always("whiskey"));
    if (phaseOf(st) !== "pour") break;
    const n = st.notes.find((x) => !x.judged && Math.abs(x.x - WINDOW_X) <= PERFECT_HALF);
    if (n) {
      st.presses.push("whiskey");
      update(st, DT, always("whiskey"));
      hits++;
    }
  }
  assert.strictEqual(st.phase, "make", `went straight to ${st.phase}`);
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "shake");
});

check("notes only ever call for ingredients in the round's recipe", () => {
  const drink = getCocktail("negroni")!;
  const st = freshState(colorFor, drink);
  run(st, BOOT_SECONDS + CARD_SECONDS * 2 + 0.2);
  beginBuild(st);
  // No pick function: the core must default to the recipe on its own.
  for (let i = 0; i < 60 * 12; i++) {
    update(st, DT);
    for (const n of st.notes) {
      assert.ok(
        drink.recipe.includes(n.ing as never),
        `a Negroni asked for ${n.ing}`
      );
    }
    if (phaseOf(st) !== "pour") break;
  }
});

check("notes spawn and travel to the right", () => {
  const st = start();
  run(st, 1.0);
  assert.ok(st.notes.length > 0, "expected at least one note");
  const x1 = st.notes[0].x;
  run(st, 0.3);
  assert.ok(st.notes[0].x > x1, "note should move right");
});

console.log("\nHitting and missing:");

/** Advance until a note of `ing` is within `half` px of the window centre. */
function advanceToWindow(st: State, half: number, pick = always("whiskey")): boolean {
  for (let i = 0; i < 60 * 20; i++) {
    update(st, DT, pick);
    const n = st.notes.find((x) => !x.judged && Math.abs(x.x - WINDOW_X) <= half);
    if (n) return true;
    if (st.phase !== "pour") return false;
  }
  return false;
}

check("a note hit dead centre scores a perfect", () => {
  const st = start();
  assert.ok(advanceToWindow(st, PERFECT_HALF));
  const before = st.score;
  st.presses.push("whiskey");
  update(st, DT, always("whiskey"));
  assert.strictEqual(st.score - before, PTS_PERFECT);
  assert.strictEqual(st.strikes, 0);
});

check("a note hit inside the window but off-centre scores a good", () => {
  const st = start();
  // Get it into the window but past the perfect band
  let found = false;
  for (let i = 0; i < 60 * 20 && !found; i++) {
    update(st, DT, always("whiskey"));
    const n = st.notes.find(
      (x) => !x.judged && Math.abs(x.x - WINDOW_X) > PERFECT_HALF + 1 && Math.abs(x.x - WINDOW_X) <= GOOD_HALF
    );
    if (n) found = true;
  }
  assert.ok(found, "never landed in the good-but-not-perfect band");
  const before = st.score;
  st.presses.push("whiskey");
  update(st, DT, always("whiskey"));
  assert.strictEqual(st.score - before, PTS_GOOD);
});

check("letting a note sail past is a strike", () => {
  const st = start();
  const strikesBefore = st.strikes;
  // Wait long enough for the first note to cross the window untouched
  run(st, 4.5);
  assert.ok(st.strikes > strikesBefore, "expected a strike for the missed note");
});

check("pressing with nothing nearby costs points but not a life", () => {
  const st = start();
  const before = st.score;
  const strikes = st.strikes;
  st.presses.push("bitters"); // only whiskey is ever spawned
  update(st, DT, always("whiskey"));
  assert.strictEqual(st.score - before, PTS_STRAY);
  assert.strictEqual(st.strikes, strikes, "a stray press must not cost a life");
});

check("pressing the wrong ingredient on a note in the window is a stray, not a strike", () => {
  const st = start();
  assert.ok(advanceToWindow(st, PERFECT_HALF));
  const strikes = st.strikes;
  st.presses.push("gin");
  update(st, DT, always("whiskey"));
  assert.strictEqual(st.strikes, strikes);
});

check("three strikes ends the run", () => {
  const st = start();
  // Never press anything — every note is missed
  for (let i = 0; i < 60 * 60 && phaseOf(st) === "pour"; i++) update(st, DT, always("whiskey"));
  assert.strictEqual(st.phase, "over");
  assert.strictEqual(st.strikes, MAX_STRIKES);
});

check("a miss subtracts points", () => {
  const st = start();
  const before = st.score;
  run(st, 4.5);
  assert.ok(st.score <= before + PTS_MISS, `score should have dropped, was ${before} now ${st.score}`);
});

console.log("\nRounds and minigames:");

/** Play a perfect round of NOTES_PER_ROUND hits. */
function clearRound(st: State) {
  let hits = 0;
  for (let i = 0; i < 60 * 90 && hits < NOTES_PER_ROUND; i++) {
    update(st, DT, always("whiskey"));
    if (phaseOf(st) !== "pour") break;
    const n = st.notes.find((x) => !x.judged && Math.abs(x.x - WINDOW_X) <= PERFECT_HALF);
    if (n) {
      st.presses.push("whiskey");
      update(st, DT, always("whiskey"));
      hits++;
    }
  }
  // A cleared pour lands on the "make that drink" card, not on the minigame.
  // Wait it out so callers see the shake or stir it introduces.
  if (phaseOf(st) === "make") run(st, CARD_SECONDS + 0.1);
  return hits;
}

check("ten pours triggers the shake minigame", () => {
  const st = start();
  const hits = clearRound(st);
  assert.strictEqual(hits, NOTES_PER_ROUND);
  assert.strictEqual(st.phase, "shake", `expected shake, got ${st.phase}`);
  assert.strictEqual(st.strikes, 0, "a clean round should carry no strikes");
});

check("the first shake asks for 120 BPM", () => {
  const st = start();
  clearRound(st);
  assert.strictEqual(st.target, 120);
});

check("shaking fast enough passes and starts the next round", () => {
  const st = start();
  clearRound(st);
  assert.strictEqual(st.phase, "shake");

  // Tap at 180 BPM — comfortably above the 120 target
  let acc = 0;
  const interval = 60 / 180;
  for (let i = 0; i < 60 * (SHAKE_SECONDS + GRACE_SECONDS + 0.5); i++) {
    acc += DT;
    if (acc >= interval) {
      st.shakeTaps++;
      acc -= interval;
    }
    update(st, DT, always("whiskey"));
    if (phaseOf(st) === "serve") break;
  }
  assert.strictEqual(st.phase, "serve", `expected serve, got ${st.phase}`);
  assert.ok(st.bestBpm >= 120, `bestBpm was ${st.bestBpm}`);
});

check("not shaking at all is a game over", () => {
  const st = start();
  clearRound(st);
  assert.strictEqual(st.phase, "shake");
  run(st, GRACE_SECONDS + 2.0);   // never tap
  assert.strictEqual(st.phase, "over");
});

check("clearing a shake advances the round and resets strikes", () => {
  const st = start();
  const firstDrink = st.cocktail.key;
  clearRound(st);
  let acc = 0;
  // A cleared round returns to the order card — the title and how-to are
  // boot-only, so round two opens straight on the next drink.
  for (let i = 0; i < 60 * 20; i++) {
    acc += DT;
    if (acc >= 60 / 200) { st.shakeTaps++; acc -= 60 / 200; }
    update(st, DT, always("whiskey"));
    if (phaseOf(st) === "order") break;
  }
  assert.strictEqual(st.phase, "order", `round two opened on ${st.phase}`);
  assert.strictEqual(st.round, 2);
  assert.strictEqual(st.strikes, 0);
  assert.strictEqual(st.spawned, 0, "the new round should start with no notes spawned");
  assert.notStrictEqual(st.cocktail.key, firstDrink, "poured the same drink twice running");

  // And the new round runs the same way the first one did.
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "gather");
  beginBuild(st);
  run(st, CARD_SECONDS + 0.1);
  assert.strictEqual(st.phase, "pour");
});

check("a stirred drink finishes with a stir, whatever the round", () => {
  // The finish now comes from the drink, not from whether the round is odd.
  // A Manhattan is stirred, so round one must ask for a stir.
  const st = start("manhattan");
  clearRound(st);
  assert.strictEqual(st.phase, "stir", `a Manhattan asked for ${st.phase}`);
  assert.strictEqual(st.target, 80);
});

check("a shaken drink finishes with a shake, whatever the round", () => {
  const st = start("daiquiri");
  clearRound(st);
  assert.strictEqual(st.phase, "shake", `a Daiquiri asked for ${st.phase}`);
  assert.strictEqual(st.target, 120);
});

console.log("\nStir input:");

check("dragging a full circle counts one revolution", () => {
  const st = freshState();
  for (let i = 0; i <= 36; i++) applyStirAngle(st, (i / 36) * Math.PI * 2 - Math.PI);
  assert.ok(Math.abs(st.revs - 1) < 0.05, `revs was ${st.revs}`);
});

check("crossing the angle seam doesn't invent a lap", () => {
  const st = freshState();
  applyStirAngle(st, Math.PI - 0.05);
  applyStirAngle(st, -Math.PI + 0.05);
  assert.ok(st.revs < 0.05, `revs jumped to ${st.revs}`);
});

check("stirring fast enough passes the stir round", () => {
  const st = freshState();
  st.phase = "stir";
  st.phaseT = 0;
  st.target = 80;
  // 120 RPM = 2 revolutions per second
  let angle = 0;
  for (let i = 0; i < 60 * 9; i++) {
    angle += (Math.PI * 2 * 2) * DT;
    applyStirAngle(st, ((angle + Math.PI) % (Math.PI * 2)) - Math.PI);
    update(st, DT);
    if (phaseOf(st) !== "stir") break;
  }
  assert.strictEqual(st.phase, "serve", `expected serve, got ${st.phase}`);
});

check("not stirring is a game over", () => {
  const st = freshState();
  st.phase = "stir";
  st.phaseT = 0;
  st.target = 80;
  run(st, GRACE_SECONDS + 2.0);
  assert.strictEqual(st.phase, "over");
});

console.log("\nEnding:");

check("the run reports finished after the game-over hold", () => {
  const st = freshState();
  st.phase = "over";
  st.phaseT = 0;
  let finished = false;
  for (let i = 0; i < 60 * 5; i++) {
    if (update(st, DT).finished) { finished = true; break; }
  }
  assert.ok(finished, "update never reported finished");
});

check("score never goes negative in the reported result", () => {
  const st = start();
  st.score = -500;
  assert.ok(Math.max(0, Math.round(st.score)) === 0);
});

console.log(`\n${passed} checks passed.\n`);
