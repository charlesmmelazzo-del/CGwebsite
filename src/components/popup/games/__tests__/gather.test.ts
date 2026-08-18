// Gather phase and the cocktail book — driving the real simulation frame by frame.
import assert from "node:assert";
import {
  COCKTAILS,
  INGREDIENT_KEYS,
  INGREDIENT_LABELS,
  getCocktail,
  ingredientsInUse,
  pickCocktail,
  type IngredientKey,
} from "../cocktails";
import {
  GROUND_Y,
  ITEM_SIZE,
  JUMP_V,
  PLAYER_H,
  PTS_RIGHT,
  PTS_WRONG,
  SHELF_ROWS,
  freshGatherState,
  remaining,
  updateGather,
  type GatherState,
} from "../gatherCore";

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

const DT = 1 / 60;
const STILL = { left: false, right: false, jump: false };

function run(st: GatherState, seconds: number, input = STILL) {
  const frames = Math.round(seconds / DT);
  for (let i = 0; i < frames; i++) updateGather(st, DT, input);
}

/** A deterministic stand-in for Math.random. */
const fixed = (v: number) => () => v;

/**
 * Put the player exactly on an item, so a grab is unambiguous.
 *
 * Clears the grab cooldown too: teleporting onto a shelf is a test fixture, not
 * a move, and leaving the previous grab's dead time running would just measure
 * the cooldown instead of whatever the test is actually about. The cooldown has
 * its own test below.
 */
function standOn(st: GatherState, key: IngredientKey) {
  const item = st.items.find((i) => i.key === key);
  assert.ok(item, `no ${key} on the shelves`);
  st.x = item!.x;
  // Feet below the item's centre by half the player, so the boxes overlap.
  st.y = item!.y + PLAYER_H / 2;
  st.onGround = false;
  st.grabCooldown = 0;
}

console.log("\nThe book:");

check("every cocktail has exactly four ingredients", () => {
  for (const c of COCKTAILS) {
    assert.strictEqual(c.recipe.length, 4, `${c.name} has ${c.recipe.length}`);
  }
});

check("every recipe ingredient is a known ingredient", () => {
  const known = new Set<string>(INGREDIENT_KEYS);
  for (const c of COCKTAILS) {
    for (const k of c.recipe) assert.ok(known.has(k), `${c.name} calls for unknown "${k}"`);
  }
});

check("no cocktail repeats an ingredient", () => {
  for (const c of COCKTAILS) {
    assert.strictEqual(new Set(c.recipe).size, 4, `${c.name} repeats an ingredient`);
  }
});

check("every ingredient has a label", () => {
  for (const k of INGREDIENT_KEYS) {
    assert.ok(INGREDIENT_LABELS[k], `no label for ${k}`);
  }
});

check("cocktail keys are unique and resolvable", () => {
  const keys = COCKTAILS.map((c) => c.key);
  assert.strictEqual(new Set(keys).size, keys.length, "duplicate cocktail key");
  for (const k of keys) assert.ok(getCocktail(k), `${k} does not resolve`);
});

check("every drink is a shake or a stir", () => {
  for (const c of COCKTAILS) {
    assert.ok(c.finish === "shake" || c.finish === "stir", `${c.name}: ${c.finish}`);
  }
});

check("picking never repeats the previous drink", () => {
  for (const c of COCKTAILS) {
    // Sweep the whole random range; none of it may return the previous drink.
    for (let r = 0; r < 1; r += 0.037) {
      assert.notStrictEqual(pickCocktail(c.key, fixed(r)).key, c.key);
    }
  }
});

check("the spawn pool covers every ingredient the book uses", () => {
  const pool = new Set(ingredientsInUse());
  for (const c of COCKTAILS) {
    for (const k of c.recipe) assert.ok(pool.has(k), `${k} is used but never spawns`);
  }
});

console.log("\nGathering:");

check("the shelves hold every ingredient in use, once each", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  const keys = st.items.map((i) => i.key);
  assert.strictEqual(new Set(keys).size, keys.length, "an ingredient spawned twice");
  assert.deepStrictEqual([...keys].sort(), [...ingredientsInUse()].sort());
});

check("running moves him and turns him around", () => {
  const st = freshGatherState(["gin"], fixed(0.5));
  const startX = st.x;
  run(st, 0.5, { left: false, right: true, jump: false });
  assert.ok(st.x > startX, "did not move right");
  assert.strictEqual(st.facing, 1);
  run(st, 0.5, { left: true, right: false, jump: false });
  assert.strictEqual(st.facing, -1);
});

check("he cannot run off either end of the bar", () => {
  const st = freshGatherState(["gin"], fixed(0.5));
  run(st, 10, { left: true, right: false, jump: false });
  assert.ok(st.x >= 0, `went off the left: ${st.x}`);
  run(st, 20, { left: false, right: true, jump: false });
  assert.ok(st.x <= 224, `went off the right: ${st.x}`);
});

check("a jump leaves the ground and lands back on it", () => {
  const st = freshGatherState(["gin"], fixed(0.5));
  updateGather(st, DT, { left: false, right: false, jump: true });
  assert.ok(!st.onGround, "still grounded the frame after jumping");
  run(st, 2);
  assert.ok(st.onGround, "never landed");
  assert.strictEqual(st.y, GROUND_Y);
});

check("a jump clears the top shelf", () => {
  const apex = (JUMP_V * JUMP_V) / (2 * 900);
  const headAtApex = GROUND_Y - apex - PLAYER_H;
  const topShelf = Math.min(...SHELF_ROWS);
  assert.ok(
    headAtApex <= topShelf + ITEM_SIZE / 2,
    `apex reaches ${headAtApex}, top shelf sits at ${topShelf}`
  );
});

check("grabbing a needed ingredient collects it and scores", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  standOn(st, "gin");
  updateGather(st, DT, STILL);
  assert.deepStrictEqual(st.collected, ["gin"]);
  assert.strictEqual(st.score, PTS_RIGHT);
  assert.ok(st.flash?.good);
});

check("grabbing a wrong ingredient costs points and collects nothing", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  // Bank points first, so the floor at zero isn't what we end up measuring.
  standOn(st, "gin");
  updateGather(st, DT, STILL);
  const before = st.score;
  standOn(st, "whiskey");
  updateGather(st, DT, STILL);
  assert.deepStrictEqual(st.collected, ["gin"], "a wrong grab was collected");
  assert.strictEqual(st.score, before + PTS_WRONG);
  assert.strictEqual(st.flash?.good, false);
});

check("the score never goes negative", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  for (const k of ["whiskey", "rum", "vermouth"] as IngredientKey[]) {
    standOn(st, k);
    updateGather(st, DT, STILL);
  }
  assert.ok(st.score >= 0, `score went to ${st.score}`);
});

check("an ingredient can only be taken once", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  standOn(st, "gin");
  run(st, 0.5);
  // Asserting the count rather than the score: he falls back to the ground
  // afterwards, and what happens on the way down is a separate question.
  assert.strictEqual(st.collected.filter((k) => k === "gin").length, 1);
  assert.strictEqual(st.items.filter((i) => i.key === "gin" && i.taken).length, 1);
});

check("falling from a high shelf cannot clip a whole row on the way down", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  standOn(st, "gin");
  updateGather(st, DT, STILL);
  const afterGrab = st.score;
  // Ride the fall all the way to the ground.
  run(st, 1.2);
  assert.ok(st.onGround, "never landed");
  assert.ok(
    st.score >= afterGrab + PTS_WRONG,
    `the fall cost ${afterGrab - st.score}, more than a single mistake`
  );
});

check("a grab blocks the next one briefly", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  standOn(st, "gin");
  updateGather(st, DT, STILL);
  const banked = st.score;
  // Straight onto a decoy without clearing the cooldown: it must not register.
  const decoy = st.items.find((i) => !st.needed.includes(i.key) && !i.taken)!;
  st.x = decoy.x;
  st.y = decoy.y + PLAYER_H / 2;
  updateGather(st, DT, STILL);
  assert.strictEqual(st.score, banked, "the cooldown did not block the second grab");
  assert.ok(!decoy.taken);
});

check("the phase ends only when the whole recipe is gathered", () => {
  const recipe: IngredientKey[] = ["gin", "lime", "sugar", "ice"];
  const st = freshGatherState(recipe, fixed(0.5));
  for (let i = 0; i < recipe.length; i++) {
    assert.ok(!st.done, `finished early, after ${i} of ${recipe.length}`);
    assert.strictEqual(remaining(st).length, recipe.length - i);
    standOn(st, recipe[i]);
    updateGather(st, DT, STILL);
  }
  assert.ok(st.done, "did not finish once the recipe was complete");
  assert.strictEqual(remaining(st).length, 0);
});

check("nothing can be picked up after the recipe is complete", () => {
  const recipe: IngredientKey[] = ["gin", "lime", "sugar", "ice"];
  const st = freshGatherState(recipe, fixed(0.5));
  for (const k of recipe) {
    standOn(st, k);
    updateGather(st, DT, STILL);
  }
  const banked = st.score;
  standOn(st, "whiskey");
  run(st, 0.5);
  assert.strictEqual(st.score, banked, "kept scoring after the round was done");
});

check("the player cannot die, however many mistakes are made", () => {
  const st = freshGatherState(["gin", "lime", "sugar", "ice"], fixed(0.5));
  const wrong = ingredientsInUse().filter((k) => !st.needed.includes(k));
  for (const k of wrong) {
    standOn(st, k);
    updateGather(st, DT, STILL);
  }
  // Every decoy taken, and the round is still going with the recipe unfinished.
  assert.ok(!st.done, "ended without the recipe being gathered");
  assert.strictEqual(remaining(st).length, 4);
  assert.ok(st.score >= 0);
});

check("every drink in the book is completable from a fresh shelf", () => {
  for (const c of COCKTAILS) {
    const st = freshGatherState(c.recipe, fixed(0.5));
    for (const k of c.recipe) {
      standOn(st, k);
      updateGather(st, DT, STILL);
    }
    assert.ok(st.done, `${c.name} could not be gathered`);
  }
});

console.log(`\n${passed} checks passed.\n`);
