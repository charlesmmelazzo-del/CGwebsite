// The cocktail book, the stock, and Bubble Buster — driving the real
// simulation frame by frame.
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
  BUBBLE_R,
  PTS_RIGHT,
  PTS_WRONG,
  TANK_BOTTOM,
  TANK_TOP,
  DECOYS,
  freshBubbleState,
  live,
  remaining,
  tapBubbles,
  updateBubbles,
  type BubbleState,
} from "../bubbleCore";
import { GAME_W } from "../arcade";
import { INGREDIENTS, ING_BY_KEY, ingredient } from "../ingredients";

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

/** A deterministic stand-in for Math.random. */
const fixed = (v: number) => () => v;

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

console.log("\nThe stock:");

check("every ingredient in the book has a sprite", () => {
  for (const k of INGREDIENT_KEYS) {
    assert.ok(ING_BY_KEY.has(k), `no sprite defined for ${k}`);
  }
});

check("every sprite is a rectangle of equal-length rows", () => {
  for (const i of INGREDIENTS) {
    const w = i.sprite[0].length;
    for (const row of i.sprite) {
      assert.strictEqual(row.length, w, `${i.key} has a ragged row`);
    }
  }
});

check("every sprite pixel uses a declared colour key", () => {
  for (const i of INGREDIENTS) {
    for (const row of i.sprite) {
      for (const ch of row) {
        if (ch === "." || ch === " ") continue;
        assert.ok(i.colors[ch], `${i.key} uses "${ch}" with no colour`);
      }
    }
  }
});

check("no recipe asks for two ingredients with the same silhouette", () => {
  // The rule that makes a note readable at speed. A Negroni wants vermouth and
  // aperitivo together; if both were the same bottle outline the player would
  // be reading colour alone, at a fifth of a second, on a phone.
  for (const c of COCKTAILS) {
    const shapes = c.recipe.map((k) => ingredient(k).shape);
    assert.strictEqual(
      new Set(shapes).size,
      shapes.length,
      `${c.name} repeats a silhouette: ${shapes.join(", ")}`
    );
  }
});

console.log("\nBubble Buster:");

const DT2 = 1 / 60;
function runBubbles(st: BubbleState, seconds: number) {
  const frames = Math.round(seconds / DT2);
  for (let i = 0; i < frames; i++) updateBubbles(st, DT2);
}

const fixedSeq = (values: number[]) => {
  let i = 0;
  return () => values[i++ % values.length];
};

check("the tank holds the whole recipe plus decoys, once each", () => {
  const recipe: IngredientKey[] = ["gin", "lime", "sugar", "ice"];
  const st = freshBubbleState(recipe);
  const keys = st.bubbles.map((b) => b.key);
  assert.strictEqual(new Set(keys).size, keys.length, "an ingredient spawned twice");
  for (const k of recipe) {
    assert.ok(keys.includes(k), `${k} is on the recipe but never spawned`);
  }
  assert.strictEqual(keys.length, recipe.length + DECOYS, `tank held ${keys.length}`);
  const pool = new Set(ingredientsInUse());
  for (const k of keys) assert.ok(pool.has(k), `${k} is not in the book`);
});

check("the tank stays small enough to read", () => {
  // The point of the resize: this phase is about reading the recipe, not about
  // picking a small target out of a crowd.
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  assert.ok(st.bubbles.length <= 10, `${st.bubbles.length} bubbles is a crowd`);
  const tankArea = GAME_W * (TANK_BOTTOM - TANK_TOP);
  const covered = st.bubbles.length * Math.PI * BUBBLE_R * BUBBLE_R;
  assert.ok(covered / tankArea < 0.55, "the tank is too full to move in");
});

check("bubbles never leave the tank", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  for (let i = 0; i < 60 * 30; i++) {
    updateBubbles(st, DT2);
    for (const b of live(st)) {
      assert.ok(b.x >= BUBBLE_R - 0.01, `x ${b.x} past the left wall`);
      assert.ok(b.x <= GAME_W - BUBBLE_R + 0.01, `x ${b.x} past the right wall`);
      assert.ok(b.y >= TANK_TOP + BUBBLE_R - 0.01, `y ${b.y} above the tank`);
      assert.ok(b.y <= TANK_BOTTOM - BUBBLE_R + 0.01, `y ${b.y} below the tank`);
    }
  }
});

check("bubbles never overlap", () => {
  // The one that matters. Two bubbles through each other means a tap is
  // ambiguous, and an ambiguous tap takes points off someone.
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  for (let i = 0; i < 60 * 30; i++) {
    updateBubbles(st, DT2);
    const inPlay = live(st);
    for (let a = 0; a < inPlay.length; a++) {
      for (let b = a + 1; b < inPlay.length; b++) {
        const dx = inPlay[a].x - inPlay[b].x;
        const dy = inPlay[a].y - inPlay[b].y;
        const d = Math.sqrt(dx * dx + dy * dy);
        assert.ok(
          d >= BUBBLE_R * 2 - 0.5,
          `${inPlay[a].key} and ${inPlay[b].key} overlap by ${(BUBBLE_R * 2 - d).toFixed(2)}`
        );
      }
    }
  }
});

check("nothing spawns overlapping, even on a degenerate random source", () => {
  // A short cycling sequence is the worst case for any placement that retries
  // until it finds a gap: it can only ever produce a handful of positions. The
  // grid does not care, which is the point of using one.
  const st = freshBubbleState(["gin"], fixedSeq([0.1, 0.9, 0.5, 0.3, 0.7]));
  for (let a = 0; a < st.bubbles.length; a++) {
    for (let b = a + 1; b < st.bubbles.length; b++) {
      const dx = st.bubbles[a].x - st.bubbles[b].x;
      const dy = st.bubbles[a].y - st.bubbles[b].y;
      assert.ok(Math.sqrt(dx * dx + dy * dy) >= BUBBLE_R * 2, "spawned overlapping");
    }
  }
});

check("popping a needed ingredient collects it and scores", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  const gin = st.bubbles.find((b) => b.key === "gin")!;
  const hit = tapBubbles(st, gin.x, gin.y);
  assert.strictEqual(hit?.key, "gin");
  assert.deepStrictEqual(st.collected, ["gin"]);
  assert.strictEqual(st.score, PTS_RIGHT);
  assert.ok(st.flash?.good);
});

check("popping a wrong ingredient costs points and collects nothing", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  const gin = st.bubbles.find((b) => b.key === "gin")!;
  tapBubbles(st, gin.x, gin.y);
  const before = st.score;
  const wrong = st.bubbles.find((b) => !st.needed.includes(b.key))!;
  tapBubbles(st, wrong.x, wrong.y);
  assert.deepStrictEqual(st.collected, ["gin"], "a wrong pop was collected");
  assert.strictEqual(st.score, before + PTS_WRONG);
  assert.strictEqual(st.flash?.good, false);
});

check("the score never goes negative", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  for (const b of st.bubbles.filter((x) => !st.needed.includes(x.key)).slice(0, 4)) {
    tapBubbles(st, b.x, b.y);
  }
  assert.ok(st.score >= 0, `score went to ${st.score}`);
});

check("a tap on empty tank costs nothing", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  const before = st.score;
  // Far outside the tank, so it cannot land on anything.
  assert.strictEqual(tapBubbles(st, -50, -50), null);
  assert.strictEqual(st.score, before);
});

check("a popped bubble cannot be popped again", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  const gin = st.bubbles.find((b) => b.key === "gin")!;
  tapBubbles(st, gin.x, gin.y);
  const banked = st.score;
  assert.strictEqual(tapBubbles(st, gin.x, gin.y), null, "popped twice");
  assert.strictEqual(st.score, banked);
});

check("a popped bubble leaves play once its pop finishes", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  const gin = st.bubbles.find((b) => b.key === "gin")!;
  tapBubbles(st, gin.x, gin.y);
  assert.ok(live(st).every((b) => b.key !== "gin"), "still tappable mid-pop");
  runBubbles(st, 1);
  assert.ok(gin.popped, "never finished popping");
});

check("the phase ends only when the whole recipe is popped", () => {
  const recipe: IngredientKey[] = ["gin", "lime", "sugar", "ice"];
  const st = freshBubbleState(recipe);
  for (let i = 0; i < recipe.length; i++) {
    assert.ok(!st.done, `finished early, after ${i} of ${recipe.length}`);
    assert.strictEqual(remaining(st).length, recipe.length - i);
    const b = st.bubbles.find((x) => x.key === recipe[i])!;
    tapBubbles(st, b.x, b.y);
  }
  assert.ok(st.done, "did not finish once the recipe was complete");
});

check("nothing can be popped after the recipe is complete", () => {
  const recipe: IngredientKey[] = ["gin", "lime", "sugar", "ice"];
  const st = freshBubbleState(recipe);
  for (const k of recipe) {
    const b = st.bubbles.find((x) => x.key === k)!;
    tapBubbles(st, b.x, b.y);
  }
  const banked = st.score;
  const spare = st.bubbles.find((b) => !recipe.includes(b.key) && !b.popped)!;
  assert.strictEqual(tapBubbles(st, spare.x, spare.y), null);
  assert.strictEqual(st.score, banked, "kept scoring after the round was done");
});

check("the player cannot die, however many mistakes are made", () => {
  const st = freshBubbleState(["gin", "lime", "sugar", "ice"]);
  for (const b of st.bubbles.filter((x) => !st.needed.includes(x.key))) {
    tapBubbles(st, b.x, b.y);
  }
  assert.ok(!st.done, "ended without the recipe being popped");
  assert.strictEqual(remaining(st).length, 4);
  assert.ok(st.score >= 0);
});

check("every drink in the book is completable from a fresh tank", () => {
  for (const c of COCKTAILS) {
    const st = freshBubbleState(c.recipe);
    for (const k of c.recipe) {
      const b = st.bubbles.find((x) => x.key === k);
      assert.ok(b, `${c.name} wanted ${k}, which never spawned`);
      tapBubbles(st, b!.x, b!.y);
    }
    assert.ok(st.done, `${c.name} could not be completed`);
  }
});

console.log(`\n${passed} checks passed.\n`);
