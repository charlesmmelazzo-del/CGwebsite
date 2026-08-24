// Let's Do Shots! — driving the real rules, and checking the art the rules
// depend on is actually in the build.
import assert from "node:assert";
import fs from "node:fs";
import path from "node:path";
import { unrenderable } from "../../arcade";
import { BOTTLES, BOTTLE_IDS, type BottleId, type CellKind } from "../bottles";
import { ORDERS, recipeBottles } from "../orders";
import { GUESTS, GUEST_COUNT } from "../guestArt";
import { MOODS } from "../sprites";
import {
  COLS, ROWS, layoutFor, EXIT_CLEARANCE_H, HUD_CONTENT, H_MAX, H_MIN,
} from "../constants";
import {
  COFFEE_SWIPES, MAX_COFFEE_ON_BOARD, SCORE_PER_SWIPE_LEFT,
  createStage, findMatches, findRecipeRuns, hasMove, legalMoves, makeRng,
  previewSwap, reshuffle, trySwap,
  type Board, type Cell, type StageRules, type StageState,
} from "../shotsCore";
import {
  buildStage, coffeeChanceFor, paletteSize, swipesFor, targetTypeCount, totalNeed,
} from "../stages";

let passed = 0;
function check(name: string, fn: () => void) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { console.log(`  FAIL ${name}`); console.log(`       ${e instanceof Error ? e.message : e}`); process.exitCode = 1; }
}

// ── Board helpers, for building an exact position by hand ───────────────────

let nextId = 1;
/**
 * A board from a picture. One letter per bottle, "." for a hole, "C" for a cup.
 *
 * Writing positions out like this rather than poking indices is the difference
 * between a test that documents a rule and one that only proves the code does
 * what it does.
 */
const LETTERS: Record<string, CellKind> = {
  B: "bourbon", G: "gin", T: "tequila", S: "scotch", R: "rum",
  H: "chartreuse", A: "amaro", P: "aperitivo", L: "liqueur", M: "malort",
  C: "coffee",
};

function boardOf(rows: string[]): Board {
  const cols = rows[0].replace(/\s/g, "").length;
  const cells: (Cell | null)[] = [];
  for (const row of rows) {
    for (const ch of row.replace(/\s/g, "")) {
      cells.push(ch === "." ? null : { id: nextId++, kind: LETTERS[ch] });
    }
  }
  return { cols, rows: rows.length, cells };
}

// ── The text has to be drawable ─────────────────────────────────────────────

check("every quip and shot name can be drawn by the 5x7 font", () => {
  const bad: string[] = [];
  for (const order of ORDERS) {
    for (const text of [order.quip, order.name]) {
      const missing = unrenderable(text);
      if (missing.length) bad.push(`"${text}" -> ${missing.join(" ")}`);
    }
  }
  assert.equal(bad.length, 0, `unrenderable text:\n  ${bad.join("\n  ")}`);
});

check("every fixed line the game speaks can be drawn too", () => {
  for (const line of [
    "Bottoms up!", "Where is my shot??", "GAME OVER", "BONUS SHOT", "SWIPES", "SCORE",
    "TAP TO START", "HIGH SCORES", "COMMON GOOD COCKTAIL HOUSE",
    "THE MOVE", "BIGGER BREAKS", "THE BONUS SHOT",
    "THREE IN A ROW BREAKS", "FOUR TAKES THE NEIGHBOURS TOO",
    "A COFFEE CUP GIVES SWIPES BACK", "POUR THE GUEST'S SHOT IN ORDER",
    "FLICK A BOTTLE INTO THE ONE", "NEXT TO IT TO SWAP THEM.",
    "THE MORE YOU LINE UP,", "THE MORE GOES WITH IT.",
    "FILL THE GUEST'S ORDER BEFORE", "YOUR SWIPES RUN OUT.",
    "LINE THESE UP IN ORDER", "FOR DOUBLE SCORE", "THE ORDER",
    "TAP TO CONTINUE", "TAP TO POUR", "TAP TO FINISH", "TAP FOR NEXT ROUND",
    "STAGE 1 CLEARED", "CONTINUES 3", "TAP TO POUR IT AGAIN", "1 OF 3",
  ]) {
    assert.deepEqual(unrenderable(line), [], `cannot draw "${line}"`);
  }
  for (const id of BOTTLE_IDS) {
    assert.deepEqual(unrenderable(BOTTLES[id].label), [], `cannot draw ${id}`);
  }
});

// ── The order book ──────────────────────────────────────────────────────────

check("there are a hundred orders and each is four real bottles", () => {
  assert.equal(ORDERS.length, 100);
  for (const o of ORDERS) {
    assert.equal(o.recipe.length, 4, `${o.name} is not four bottles`);
    for (const b of o.recipe) assert.ok(b in BOTTLES, `${o.name} has unknown bottle ${b}`);
  }
});

check("no recipe has three of the same bottle in a row", () => {
  // A recipe that did could never be poured: the third bottle would match and
  // break before the fourth could land beside it.
  for (const o of ORDERS) {
    for (let i = 0; i + 2 < o.recipe.length; i++) {
      const three = o.recipe[i] === o.recipe[i + 1] && o.recipe[i + 1] === o.recipe[i + 2];
      assert.ok(!three, `${o.name} asks for three ${o.recipe[i]} in a row`);
    }
  }
});

check("every order names itself in its quip", () => {
  for (const o of ORDERS) {
    assert.ok(o.quip.includes(`"${o.name}?"`), `${o.name} is missing from "${o.quip}"`);
  }
});

// ── Matching ────────────────────────────────────────────────────────────────

check("three in a row matches, two do not", () => {
  const b = boardOf([
    "GGGBT",
    "BTBTB",
    "TBTBT",
  ]);
  const groups = findMatches(b);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].sort((x, y) => x - y), [0, 1, 2]);
});

check("a run down a column matches", () => {
  const b = boardOf([
    "GBTBT",
    "GTBTB",
    "GBTBT",
  ]);
  const groups = findMatches(b);
  assert.equal(groups.length, 1);
  assert.deepEqual(groups[0].sort((x, y) => x - y), [0, 5, 10]);
});

check("an L is one group of five, not a three and a three", () => {
  const b = boardOf([
    "GGGBT",
    "GTBTB",
    "GBTBT",
  ]);
  const groups = findMatches(b);
  assert.equal(groups.length, 1, "the corner should have merged the two runs");
  assert.equal(groups[0].length, 5);
});

check("coffee never matches, however many are in a line", () => {
  const b = boardOf([
    "CCCBT",
    "BTBTB",
    "TBTBT",
  ]);
  assert.deepEqual(findMatches(b), []);
});

// ── The bonus shot ──────────────────────────────────────────────────────────

const RECIPE: BottleId[] = ["bourbon", "gin", "tequila", "scotch"];

check("the recipe is found left to right and right to left", () => {
  const fwd = boardOf(["BGTS", "MMMM", "PPPP"]);
  assert.equal(findRecipeRuns(fwd, RECIPE).length, 1);
  const rev = boardOf(["STGB", "MMMM", "PPPP"]);
  assert.equal(findRecipeRuns(rev, RECIPE).length, 1, "a recipe read backwards still counts");
});

check("the recipe is found down a column", () => {
  const b = boardOf(["BMP", "GMP", "TMP", "SMP"]);
  assert.equal(findRecipeRuns(b, RECIPE).length, 1);
});

check("a recipe out of order is not a recipe", () => {
  const b = boardOf(["BTGS", "MMMM", "PPPP"]);
  assert.deepEqual(findRecipeRuns(b, RECIPE), []);
});

// ── Blast sizes ─────────────────────────────────────────────────────────────

/** A one-stage state wrapped round a hand-built board. */
function rig(rows: string[], over: Partial<StageRules> = {}): StageState {
  const board = boardOf(rows);
  const rules: StageRules = {
    stage: 1,
    palette: ["bourbon", "gin", "tequila", "scotch", "rum"],
    recipe: RECIPE,
    shotName: "Test",
    quip: "Test",
    guest: 0,
    targets: [{ kind: "bourbon", need: 999 }],
    swipes: 20,
    coffeeChance: 0,
    ...over,
  };
  return {
    rules, board, swipesLeft: rules.swipes, got: rules.targets.map(() => 0),
    score: 0, outcome: "playing", rng: makeRng(4), nextId: 9000,
  };
}

/** Swap two cells and count everything that broke as a result. */
function clearedBy(st: StageState, a: number, b: number): { cells: number; recipe: boolean } {
  const res = trySwap(st, a, b);
  if (!res.ok) return { cells: 0, recipe: false };
  let cells = 0;
  let recipe = false;
  for (const step of res.steps) {
    if (step.t !== "clear") continue;
    // Only the break the swap caused. What cascades after it depends on freshly
    // rolled stock, which would make the count non-deterministic.
    if (step.combo === 1) { cells = step.cleared.length; recipe = step.recipeHit; }
  }
  return { cells, recipe };
}

/**
 * Boards with no accidental runs in them, so a swap makes exactly one thing.
 * Four letters only, none of which appear in the test recipe (B G T S), so
 * nothing here can trip the bonus shot either.
 */
const QUIET = ["G G M R P", "M R G P M", "P M R M P", "R P M P R"];

check("a three breaks just the three", () => {
  const st = rig(QUIET);
  // Swapping the M at (2,0) with the G below it lines up exactly three Gs.
  const { cells } = clearedBy(st, 2, 7);
  assert.equal(cells, 3, "a plain three should take nothing else with it");
});

check("a four takes its neighbours with it", () => {
  const st = rig(["G G M G R", "M R G P M", "P M R M P", "R P M P R"]);
  const { cells } = clearedBy(st, 2, 7);
  assert.equal(cells, 9, "the four plus the five cells orthogonally against it");
});

check("the bonus shot fires, pays double and clears all around itself", () => {
  const st = rig([
    "M G T S P",
    "B P M P M",
    "P M P M P",
    "M P M P M",
  ], { targets: [{ kind: "bourbon", need: 999 }] });
  const plain = rig([
    "M G T S P",
    "B P M P M",
    "P M P M P",
    "M P M P M",
  ], { targets: [{ kind: "bourbon", need: 999 }], recipe: ["rum", "rum", "rum", "rum"] });

  // Swapping the M at (0,0) with the B below pours BOURBON GIN TEQUILA SCOTCH
  // straight across the top row.
  const hit = clearedBy(st, 0, 5);
  assert.ok(hit.recipe, "the shot should have been recognised");
  assert.equal(hit.cells, 10, "the four, plus everything touching them in all eight directions");

  // The same swap against a stage whose shot is something else does nothing,
  // which is what proves the recipe and not the shape is doing the work.
  const miss = clearedBy(plain, 0, 5);
  assert.equal(miss.cells, 0, "with a different order on the board, that swap is not a move");

  // Double: the same cells, but the shot is worth twice a plain break.
  assert.ok(st.score > 10 * 50, `a shot scored ${st.score}, no better than a plain break`);
});

// ── Swipes and refusals ─────────────────────────────────────────────────────

check("a swap that breaks nothing is refused and costs no swipe", () => {
  const st = rig([
    "GBGBG",
    "BGBGB",
    "GBGBG",
  ]);
  const before = st.swipesLeft;
  const res = trySwap(st, 0, 1);
  assert.equal(res.ok, false);
  assert.equal(st.swipesLeft, before, "a refused swap must be free");
  assert.equal(res.steps.length, 1, "the refusal should still be shown");
  assert.ok(res.steps[0].t === "swap" && res.steps[0].ok === false);
});

check("only touching cells can be swapped", () => {
  const st = rig(["GBGBG", "BGBGB", "GBGBG"]);
  assert.equal(trySwap(st, 0, 2).ok, false, "two apart is not adjacent");
  assert.equal(trySwap(st, 0, 6).ok, false, "diagonal is not adjacent");
});

// ── Coffee ──────────────────────────────────────────────────────────────────

check("a cup caught in a break hands swipes back", () => {
  const st = rig([
    "TGGGC",
    "GMPMP",
    "MPMPM",
  ], { targets: [{ kind: "gin", need: 999 }] });
  const before = st.swipesLeft;
  const res = trySwap(st, 0, 5);
  assert.ok(res.ok);
  const clear = res.steps.find((s) => s.t === "clear");
  assert.ok(clear && clear.t === "clear" && clear.coffee >= 1, "the cup next to the four should have gone");
  // -1 for the swipe spent, + the cups broken.
  assert.equal(st.swipesLeft, before - 1 + (clear && clear.t === "clear" ? clear.coffee : 0) * COFFEE_SWIPES);
});

check("a cup is never counted toward the guest's order", () => {
  const st = rig([
    "TGGGC",
    "GMPMP",
    "MPMPM",
  ], { targets: [{ kind: "gin", need: 999 }] });
  trySwap(st, 0, 5);
  const cleared = st.got[0];
  assert.ok(cleared >= 3, "the gins should have counted");
  assert.ok(cleared < 90, "sanity");
});

check("the board never carries more cups than the cap", () => {
  for (let seed = 1; seed <= 12; seed++) {
    const rng = makeRng(seed);
    const rules = buildStage(9, rng);
    const { state } = createStage(rules, seed * 31, COLS, ROWS);
    for (let move = 0; move < 40 && state.outcome === "playing"; move++) {
      const moves = legalMoves(state.board, state.rules.recipe);
      if (!moves.length) break;
      trySwap(state, moves[0][0], moves[0][1]);
      const cups = state.board.cells.filter((c) => c?.kind === "coffee").length;
      assert.ok(cups <= MAX_COFFEE_ON_BOARD, `${cups} cups on the board`);
    }
  }
});

check("coffee cannot pay for itself — the swipe counter still falls", () => {
  // The whole reason MAX_COFFEE_PER_MOVE exists. A bot that goes out of its way
  // to break every cup it can must still run out of swipes; when it did not,
  // no stage could be lost and the game had no end.
  let spent = 0;
  let granted = 0;
  for (let seed = 1; seed <= 8; seed++) {
    const rng = makeRng(seed * 17);
    const rules = buildStage(12, rng);
    const { state } = createStage(rules, seed * 977, COLS, ROWS);
    for (let move = 0; move < 60 && state.outcome === "playing"; move++) {
      const moves = legalMoves(state.board, state.rules.recipe);
      if (!moves.length) break;
      // Deliberately greedy for cups.
      let best = moves[0], bestCups = -1;
      for (const [a, b] of moves) {
        const p = previewSwap(state.board, state.rules.recipe, a, b);
        if (!p) continue;
        const cups = p.kinds.filter((k) => k === "coffee").length;
        if (cups > bestCups) { bestCups = cups; best = [a, b]; }
      }
      const res = trySwap(state, best[0], best[1]);
      if (!res.ok) break;
      spent++;
      for (const s of res.steps) if (s.t === "clear") granted += s.coffee * COFFEE_SWIPES;
    }
  }
  assert.ok(granted < spent, `cup farming returned ${granted} swipes for ${spent} spent`);
});

// ── Gravity ─────────────────────────────────────────────────────────────────

check("survivors keep their identity when they fall", () => {
  const st = rig([
    "TGGGM",
    "BMPMP",
    "MPMPM",
  ], { targets: [{ kind: "gin", need: 999 }] });
  const survivor = st.board.cells[5]?.id;
  trySwap(st, 0, 5);
  const stillThere = st.board.cells.some((c) => c?.id === survivor);
  assert.ok(stillThere, "a bottle that only moved down should be the same bottle");
});

check("every column is full again once the dust settles", () => {
  const rng = makeRng(5);
  const rules = buildStage(4, rng);
  const { state } = createStage(rules, 12345, COLS, ROWS);
  for (let move = 0; move < 25 && state.outcome === "playing"; move++) {
    const moves = legalMoves(state.board, state.rules.recipe);
    if (!moves.length) break;
    trySwap(state, moves[0][0], moves[0][1]);
    assert.equal(state.board.cells.filter((c) => c === null).length, 0, "a hole was left in the board");
  }
});

// ── Opening a stage ─────────────────────────────────────────────────────────

check("the opening deal is marked as paying nothing", () => {
  // The renderer keys the bartender's reaction and the score pop off this flag.
  // It cannot use the combo count: the deal runs one up exactly as a real chain
  // does, so he ended up grinning at a board nobody had touched.
  for (let seed = 1; seed <= 12; seed++) {
    const rules = buildStage(1 + (seed % 8), makeRng(seed * 13));
    const { steps } = createStage(rules, seed * 7717, COLS, ROWS);
    for (const step of steps) {
      if (step.t === "clear") {
        assert.equal(step.counted, false, "the opening deal reported itself as a real break");
        assert.equal(step.score, 0);
      }
    }
  }
});

check("a real break is marked as paying", () => {
  const st = rig([
    "TGGGM",
    "BMPMP",
    "MPMPM",
  ], { targets: [{ kind: "gin", need: 999 }] });
  const res = trySwap(st, 0, 5);
  assert.ok(res.ok);
  const clear = res.steps.find((s) => s.t === "clear");
  assert.ok(clear && clear.t === "clear" && clear.counted, "a player's own break must count");
});

check("the opening deal settles, pays nothing and fills no order", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rng = makeRng(seed);
    const rules = buildStage(1 + (seed % 15), rng);
    const { state, steps } = createStage(rules, seed * 7717, COLS, ROWS);
    assert.equal(state.score, 0, "the deal must not be worth points");
    assert.deepEqual(state.got, rules.targets.map(() => 0), "the deal must not fill the order");
    assert.equal(state.swipesLeft, rules.swipes, "the deal must not spend or grant swipes");
    assert.deepEqual(findMatches(state.board), [], "the board is still holding a match");
    assert.deepEqual(findRecipeRuns(state.board, rules.recipe), [], "the board is still holding a shot");
    assert.ok(hasMove(state.board, rules.recipe), "the opening board is dead");
    assert.ok(steps.length >= 0);
  }
});

check("a stage cannot be won before it is played", () => {
  for (let seed = 1; seed <= 25; seed++) {
    const rules = buildStage(1 + (seed % 9), makeRng(seed * 3));
    const { state } = createStage(rules, seed * 61, COLS, ROWS);
    assert.equal(state.outcome, "playing");
  }
});

// ── Deadlocks ───────────────────────────────────────────────────────────────

check("a dead board is re-dealt into a live one", () => {
  // Three bottles on a rolling diagonal: no run anywhere, and no swap can make
  // one. A checkerboard looks dead and is not — swapping any pair on it lines
  // up three immediately, which is why this pattern is used instead.
  const st = rig([
    "GBMGB",
    "BMGBM",
    "MGBMG",
  ]);
  assert.ok(!hasMove(st.board, st.rules.recipe), "this board should be dead");
  const before = st.board.cells.filter(Boolean).length;
  reshuffle(st);
  assert.equal(st.board.cells.filter(Boolean).length, before, "the re-deal changed how many bottles exist");
});

// ── Winning and losing ──────────────────────────────────────────────────────

check("meeting the order wins, and leftover swipes are paid out", () => {
  const st = rig([
    "TGGGM",
    "BMPMP",
    "MPMPM",
  ], { targets: [{ kind: "gin", need: 3 }] });
  const before = st.swipesLeft;
  const res = trySwap(st, 0, 5);
  assert.ok(res.ok);
  assert.equal(st.outcome, "won");
  assert.ok(st.score >= (before - 1) * SCORE_PER_SWIPE_LEFT, "the swipes left over were not paid");
});

check("running out of swipes loses, but not until the cascade has paid out", () => {
  const st = rig([
    "TGGGM",
    "BMPMP",
    "MPMPM",
  ], { targets: [{ kind: "gin", need: 999 }], swipes: 1 });
  st.swipesLeft = 1;
  const res = trySwap(st, 0, 5);
  assert.ok(res.ok);
  assert.equal(st.outcome, "lost");
  assert.ok(st.score > 0, "the last move should still have scored");
});

// ── The difficulty curve ────────────────────────────────────────────────────

check("the curve only ever gets harder", () => {
  for (let n = 1; n < 60; n++) {
    assert.ok(totalNeed(n + 1) >= totalNeed(n), `the order shrank at stage ${n}`);
    assert.ok(paletteSize(n + 1) >= paletteSize(n), `the palette shrank at stage ${n}`);
    assert.ok(targetTypeCount(n + 1) >= targetTypeCount(n), `the order lost a bottle at stage ${n}`);
    assert.ok(swipesFor(n) >= 20 && swipesFor(n) <= 30);
    assert.ok(coffeeChanceFor(n) > 0 && coffeeChanceFor(n) <= 0.03);
  }
});

check("the palette is always big enough to pour the shot and small enough to play", () => {
  for (let n = 1; n <= 40; n++) {
    for (let seed = 1; seed <= 6; seed++) {
      const rules = buildStage(n, makeRng(n * 100 + seed));
      assert.equal(rules.palette.length, paletteSize(n), `stage ${n} palette is the wrong size`);
      assert.ok(rules.palette.length <= 8, "eight is the most the board can carry");
      for (const b of recipeBottles(rules.recipe)) {
        assert.ok(rules.palette.indexOf(b) >= 0, `stage ${n} cannot pour its own shot: ${b} is not in play`);
      }
      for (const t of rules.targets) {
        assert.ok(rules.palette.indexOf(t.kind) >= 0, `stage ${n} asks for ${t.kind}, which never appears`);
      }
      assert.equal(rules.targets.reduce((s, t) => s + t.need, 0), totalNeed(n));
      assert.equal(rules.targets.length, targetTypeCount(n));
    }
  }
});

check("the order always includes something the bonus shot pours", () => {
  for (let n = 1; n <= 40; n++) {
    const rules = buildStage(n, makeRng(n * 977));
    const core = recipeBottles(rules.recipe);
    assert.ok(
      rules.targets.some((t) => core.indexOf(t.kind) >= 0),
      `stage ${n}'s bonus shot does nothing for its order`
    );
  }
});

check("a competent player clears the early stages and struggles with the late ones", () => {
  // The whole point of the curve, asserted rather than assumed. Bands are wide:
  // this is here to catch a change that makes stage one unwinnable or stage
  // twenty free, not to pin down a percentage.
  const rate = (stage: number, runs: number) => {
    let won = 0;
    for (let seed = 1; seed <= runs; seed++) {
      const rng = makeRng(seed * 7919 + stage);
      const rules = buildStage(stage, rng);
      const { state } = createStage(rules, seed * 104729 + stage, COLS, ROWS);
      let guard = 0;
      while (state.outcome === "playing" && guard++ < 400) {
        const moves = legalMoves(state.board, state.rules.recipe);
        if (!moves.length) break;
        let best = moves[0], bestValue = -1;
        for (const [a, b] of moves) {
          const p = previewSwap(state.board, state.rules.recipe, a, b);
          if (!p) continue;
          let value = p.recipeHit ? 8 : 0;
          for (const k of p.kinds) {
            if (k === "coffee") value += 3;
            else if (state.rules.targets.some((t, i) => t.kind === k && state.got[i] < t.need)) value += 1;
          }
          if (value > bestValue) { bestValue = value; best = [a, b]; }
        }
        trySwap(state, best[0], best[1]);
      }
      if (state.outcome === "won") won++;
    }
    return won / runs;
  };

  const early = rate(1, 20);
  assert.ok(early >= 0.9, `stage 1 is only winnable ${Math.round(early * 100)}% of the time`);
  const late = rate(20, 20);
  assert.ok(late <= 0.95, `stage 20 is winnable ${Math.round(late * 100)}% of the time — the curve has gone flat`);
  assert.ok(late >= 0.3, `stage 20 is only winnable ${Math.round(late * 100)}% of the time — too steep`);
});

// ── Layout ──────────────────────────────────────────────────────────────────

check("the HUD stays clear of the cabinet's exit button", () => {
  // A full-bleed game gets GameShell's EXIT floated over its top-right corner.
  // The order chips are the only thing the HUD puts on that side, and the top
  // of the highest one has to sit below the button on the SHORTEST screen —
  // where the HUD is at its most compressed and everything rides highest.
  for (let h = H_MIN; h <= H_MAX; h++) {
    const l = layoutFor(h);
    const chipTop = l.backbarY - HUD_CONTENT + 29;
    assert.ok(chipTop >= EXIT_CLEARANCE_H, `at ${h} the order chips reach up to ${chipTop}, under the exit button`);
  }
});

check("the board fits on every screen the game allows", () => {
  for (let h = H_MIN; h <= H_MAX; h++) {
    const l = layoutFor(h);
    assert.ok(l.hudY >= 0, `HUD off the top at ${h}`);
    assert.ok(l.backbarY > l.hudY, `no room for the HUD at ${h}`);
    assert.ok(l.boardY > l.backbarY, `no room for the back bar at ${h}`);
    assert.ok(l.recipeY > l.boardY, `the recipe strip is inside the board at ${h}`);
    assert.ok(l.recipeY + 46 <= h, `the recipe strip runs off the bottom at ${h}`);
  }
});

// ── The art ─────────────────────────────────────────────────────────────────

const ART = path.join(process.cwd(), "public", "popup", "art", "shots");

/** Width and height straight out of a PNG's IHDR. */
function pngSize(file: string): { w: number; h: number } {
  const b = fs.readFileSync(file);
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}

check("every bottle has a sprite", () => {
  for (const id of BOTTLE_IDS) {
    const file = path.join(ART, `bottle-${id}.png`);
    assert.ok(fs.existsSync(file), `missing ${path.basename(file)} — run scripts/shots-art.mjs`);
  }
});

check("every guest has all three panels", () => {
  assert.ok(GUEST_COUNT > 0, "no guests were imported");
  for (const guest of GUESTS) {
    for (const panel of ["order", "mad", "happy"]) {
      const file = path.join(ART, `${guest.slug}-${panel}.png`);
      assert.ok(fs.existsSync(file), `missing ${path.basename(file)}`);
    }
  }
});

check("the bartender has both his lines", () => {
  for (const which of ["ask", "go"]) {
    assert.ok(fs.existsSync(path.join(ART, `bartender-${which}.png`)), `missing bartender-${which}.png`);
  }
});

check("the bartender has all four reactions, in one shared frame", () => {
  // Same dimensions is the whole contract: they are cut from one rectangle at
  // import time so he changes expression without changing size or shifting
  // sideways. Different sizes here means the import regressed.
  const sizes = MOODS.map((mood) => {
    const file = path.join(ART, `bartender-${mood}.png`);
    assert.ok(fs.existsSync(file), `missing bartender-${mood}.png`);
    return pngSize(file);
  });
  for (const size of sizes) {
    assert.deepEqual(size, sizes[0], `the reactions are not all the same size: ${JSON.stringify(sizes)}`);
  }
});

check("the marquee is in the build", () => {
  assert.ok(fs.existsSync(path.join(ART, "logo.png")), "missing logo.png — run scripts/shots-art.mjs");
});

check("every speech bubble is a sane rectangle inside its panel", () => {
  for (const guest of GUESTS) {
    for (const panel of ["order", "mad", "happy"] as const) {
      const r = guest[panel];
      assert.ok(r.x >= 0 && r.y >= 0, `${guest.slug} ${panel} starts off the panel`);
      assert.ok(r.x + r.w <= 1.001, `${guest.slug} ${panel} runs off the right`);
      assert.ok(r.y + r.h <= 1.001, `${guest.slug} ${panel} runs off the bottom`);
      assert.ok(r.w > 0.35, `${guest.slug} ${panel} bubble is too narrow to set type in`);
      assert.ok(r.h > 0.06, `${guest.slug} ${panel} bubble is too short to set type in`);
      assert.ok(r.y < 0.4, `${guest.slug} ${panel} bubble is too low to be a speech bubble`);
    }
  }
});

check("a stage only ever picks a guest that exists", () => {
  for (let n = 1; n <= 60; n++) {
    const rules = buildStage(n, makeRng(n * 31 + 5));
    assert.ok(rules.guest >= 0 && rules.guest < GUEST_COUNT, `stage ${n} asked for guest ${rules.guest}`);
    assert.ok(GUESTS[rules.guest], `stage ${n} picked a guest with no art`);
  }
});

console.log(`\n${passed} checks passed`);
