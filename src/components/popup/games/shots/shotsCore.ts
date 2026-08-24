// ─── Let's Do Shots! — the rules ─────────────────────────────────────────────
//
// The whole game, with no canvas, no React and no clock. Everything here is a
// pure function of a state object and a seeded generator, which is what makes
// the board reproducible: the same seed plays the same stage, so a bug someone
// hits at the bar can be replayed exactly rather than hunted for.
//
// THE RENDERER NEVER READS THE BOARD MID-MOVE. A move returns a list of STEPS —
// what broke, then what fell, then what broke because of that — and the board
// is already final by the time the first step is handed over. The animation
// replays the steps at whatever pace looks good and re-syncs at the end. Doing
// it the other way round, with the renderer driving the rules a frame at a
// time, is what makes match-3 games lose a cascade when a phone drops frames.
//
// See docs/lets-do-shots.md for the design this implements.

import { isBottle, type BottleId, type CellKind } from "./bottles";

// ─── Scoring ─────────────────────────────────────────────────────────────────

/** Every bottle broken, however it broke. */
export const SCORE_PER_CELL = 50;
/** A coffee cup, on top of the swipes it hands back. */
export const SCORE_COFFEE = 250;
/** Left over when the stage is cleared — rewards finishing early, not just finishing. */
export const SCORE_PER_SWIPE_LEFT = 150;
/** What the guest's own shot is worth. The reason to build it rather than ignore it. */
export const RECIPE_MULTIPLIER = 2;
/**
 * Swipes a coffee cup gives back.
 *
 * Three, so breaking one is worth changing your plan for — paired with a spawn
 * rate low enough that a cup is an event rather than an income. Get that
 * balance wrong in the other direction and the game cannot be lost: at one cup
 * per move and two swipes each, a player who simply always broke the cup ended
 * every move with more swipes than they started it, and a bot ground stage 25
 * to a win against an order nearly twice what it should have been able to fill.
 * The pair of limits below is what bounds it. See coffeeChanceFor.
 */
export const COFFEE_SWIPES = 3;

/**
 * The most coffee cups allowed on the board at once.
 *
 * A hard cap, not a lower spawn chance, because the two are not the same thing.
 * A swipe on this board breaks six to fourteen cells and every one of them is
 * refilled, so even a 3% cup rate delivers roughly half a cup per swipe — at
 * two swipes each, the swipe counter went UP faster than it came down and the
 * stage could not be lost. Capping the board instead bounds the payout no
 * matter how large the cascade, and has the better side effect of making a cup
 * feel like something that turned up rather than something that is always
 * there.
 */
export const MAX_COFFEE_ON_BOARD = 2;

/**
 * New cups allowed per player move, however long the cascade runs.
 *
 * The board cap alone was not enough. One swipe can set off six separate
 * breaks, each of which refills, so the cap was re-checked and re-filled six
 * times and the cups still arrived faster than they were spent. This is the
 * limit that actually holds: one cup per swipe, so a cup can pay a swipe back
 * but can never pay for itself twice over.
 */
export const MAX_COFFEE_PER_MOVE = 1;

/**
 * Each further break in one chain is worth more.
 *
 * A cascade the player set up deliberately should pay better than three
 * separate lucky threes, or there is no reason to ever look further than the
 * next match.
 */
export function comboMultiplier(combo: number): number {
  return 1 + 0.5 * Math.max(0, combo - 1);
}

// ─── Randomness ──────────────────────────────────────────────────────────────

export type Rng = () => number;

/** mulberry32 — small, fast, and good enough that a board never looks patterned. */
export function makeRng(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length) % items.length];
}

export function shuffled<T>(rng: Rng, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

// ─── The board ───────────────────────────────────────────────────────────────

export interface Cell {
  /**
   * Unique for the lifetime of a stage, and never reused.
   *
   * The renderer keys its animating sprites on this. Without it, a bottle that
   * falls into the space another just left would be treated as the same object
   * and inherit its position, so the board would appear to teleport rather than
   * to pour.
   */
  id: number;
  kind: CellKind;
}

export interface Board {
  cols: number;
  rows: number;
  /** Row-major, `y * cols + x`. Null only while a resolution is in flight. */
  cells: (Cell | null)[];
}

export function at(board: Board, x: number, y: number): Cell | null {
  if (x < 0 || y < 0 || x >= board.cols || y >= board.rows) return null;
  return board.cells[y * board.cols + x];
}

export function xOf(board: Board, i: number): number {
  return i % board.cols;
}

export function yOf(board: Board, i: number): number {
  return Math.floor(i / board.cols);
}

export function areAdjacent(board: Board, a: number, b: number): boolean {
  const dx = Math.abs(xOf(board, a) - xOf(board, b));
  const dy = Math.abs(yOf(board, a) - yOf(board, b));
  return dx + dy === 1;
}

// ─── Stage definition ────────────────────────────────────────────────────────

export interface Target {
  kind: BottleId;
  need: number;
}

export interface StageRules {
  stage: number;
  /**
   * The bottles that can appear this stage.
   *
   * Five or six of the ten, never all of them. With the full cast on a 7x8
   * board a random three-in-a-row is so rare that the opening board is usually
   * dead — a match-3 is only a game when the alphabet is small enough that
   * runs happen by accident and the player's job is to see them.
   */
  palette: BottleId[];
  /** Four bottles, in order. The guest's shot. */
  recipe: BottleId[];
  /** The shot's name, for the recipe strip. */
  shotName: string;
  /** What the guest says while ordering. */
  quip: string;
  /** Index into GUESTS in guestArt.ts. */
  guest: number;
  targets: Target[];
  swipes: number;
  /** Odds a refilled cell is a coffee cup rather than a bottle. */
  coffeeChance: number;
}

export type Outcome = "playing" | "won" | "lost";

export interface StageState {
  rules: StageRules;
  board: Board;
  swipesLeft: number;
  /** Parallel to rules.targets. */
  got: number[];
  score: number;
  outcome: Outcome;
  rng: Rng;
  nextId: number;
}

export function targetsMet(state: StageState): boolean {
  return state.rules.targets.every((t, i) => state.got[i] >= t.need);
}

// ─── Steps: what the renderer replays ────────────────────────────────────────

export type ClearReason =
  /** Part of a run of three or more. */
  | "match"
  /** Part of the guest's shot, poured in order. */
  | "recipe"
  /** Collateral — next to a big match or a shot. */
  | "blast"
  /** A coffee cup caught in the break. */
  | "coffee";

export interface ClearedCell {
  i: number;
  cell: Cell;
  reason: ClearReason;
}

export interface ClearStep {
  t: "clear";
  /** 1 for the break the player caused, 2 for what that break caused, and on. */
  combo: number;
  /**
   * Whether this break actually paid — score, order, swipes.
   *
   * False for the opening deal only, which cascades for the show of it. The
   * renderer cannot work this out for itself: the deal runs up a combo count
   * exactly like a real chain does, so anything reading `combo` alone
   * congratulated the player for a board they had not touched yet.
   */
  counted: boolean;
  cleared: ClearedCell[];
  score: number;
  /** The guest's shot was in there. Worth calling out on screen. */
  recipeHit: boolean;
  /** Coffee cups broken, and so swipes handed back. */
  coffee: number;
}

export interface FallStep {
  t: "fall";
  /** Survivors sliding down into the holes. */
  moves: { from: number; to: number }[];
  /** New stock. `rise` is how many rows above the board it starts. */
  spawns: { to: number; cell: Cell; rise: number }[];
}

export interface SwapStep {
  t: "swap";
  a: number;
  b: number;
  /** False when nothing matched and the two snap back. */
  ok: boolean;
}

export interface ShuffleStep {
  t: "shuffle";
  /** The board after re-dealing, so the renderer can fly every bottle to its new home. */
  cells: (Cell | null)[];
}

export type Step = ClearStep | FallStep | SwapStep | ShuffleStep;

// ─── Finding things ──────────────────────────────────────────────────────────

/**
 * Runs of three or more of the same bottle, merged where they cross.
 *
 * An L or a T is ONE group, not a three and a four that happen to share a
 * corner. That matters because group size drives the blast: split in two,
 * a five-cell L would twice fail the four-cell threshold and quietly do
 * nothing, which is the single most common way a match-3 feels unrewarding.
 */
export function findMatches(board: Board): number[][] {
  const { cols, rows } = board;
  const runs: number[][] = [];

  const scan = (get: (a: number, b: number) => number, outer: number, inner: number) => {
    for (let o = 0; o < outer; o++) {
      let start = 0;
      for (let i = 1; i <= inner; i++) {
        const prev = board.cells[get(o, i - 1)];
        const cur = i < inner ? board.cells[get(o, i)] : null;
        const same =
          cur && prev && cur.kind === prev.kind && isBottle(cur.kind);
        if (!same) {
          const len = i - start;
          if (len >= 3 && prev && isBottle(prev.kind)) {
            const run: number[] = [];
            for (let k = start; k < i; k++) run.push(get(o, k));
            runs.push(run);
          }
          start = i;
        }
      }
    }
  };
  scan((y, x) => y * cols + x, rows, cols);
  scan((x, y) => y * cols + x, cols, rows);

  return mergeOverlapping(runs);
}

/** Union runs that share a cell. */
function mergeOverlapping(runs: number[][]): number[][] {
  const groups: Set<number>[] = [];
  for (const run of runs) {
    const touching = groups.filter((g) => run.some((i) => g.has(i)));
    if (!touching.length) {
      groups.push(new Set(run));
      continue;
    }
    const merged = touching[0];
    for (const i of run) merged.add(i);
    for (const other of touching.slice(1)) {
      other.forEach((i) => merged.add(i));
      groups.splice(groups.indexOf(other), 1);
    }
  }
  return groups.map((g) => Array.from(g));
}

/**
 * Every place the guest's shot is poured out on the board.
 *
 * Four in a line, in recipe order, read either way — a recipe that only counted
 * left-to-right would be invisible half the time it actually happened, which
 * players read as the game being broken rather than as a rule.
 *
 * Coffee never takes part: it is not a spirit and it would let a recipe form
 * around a cup the player was saving.
 */
export function findRecipeRuns(board: Board, recipe: BottleId[]): number[][] {
  const { cols, rows } = board;
  const n = recipe.length;
  const out: number[][] = [];

  const check = (indices: number[]) => {
    const kinds = indices.map((i) => board.cells[i]?.kind);
    if (kinds.some((k) => !k || !isBottle(k))) return;
    const fwd = kinds.every((k, j) => k === recipe[j]);
    const rev = kinds.every((k, j) => k === recipe[n - 1 - j]);
    if (fwd || rev) out.push(indices);
  };

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x + n <= cols; x++) {
      check(Array.from({ length: n }, (_, j) => y * cols + x + j));
    }
  }
  for (let x = 0; x < cols; x++) {
    for (let y = 0; y + n <= rows; y++) {
      check(Array.from({ length: n }, (_, j) => (y + j) * cols + x));
    }
  }
  return out;
}

/** Cells next to `set` but not in it. Orthogonal only unless `diagonal`. */
function neighboursOf(board: Board, set: Iterable<number>, diagonal: boolean): number[] {
  const { cols, rows } = board;
  const inSet = new Set(set);
  const out = new Set<number>();
  const deltas = diagonal
    ? [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]
    : [[1, 0], [-1, 0], [0, 1], [0, -1]];
  inSet.forEach((i) => {
    const x = i % cols, y = Math.floor(i / cols);
    for (const [dx, dy] of deltas) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const j = ny * cols + nx;
      if (!inSet.has(j)) out.add(j);
    }
  });
  return Array.from(out);
}

// ─── Breaking ────────────────────────────────────────────────────────────────

/** Which reason wins when a cell qualifies twice. Recipe is the loudest. */
const REASON_RANK: Record<ClearReason, number> = { blast: 0, match: 1, coffee: 2, recipe: 3 };

/**
 * Everything that breaks right now, and why.
 *
 * The bonuses, in the order they escalate:
 *
 *   THREE   just the three.
 *   FOUR    the run, plus everything orthogonally against it — a shockwave down
 *           the line, which is why a four is worth going out of your way for.
 *   FIVE+   the run and its full eight-way surround. An L or a T lands here,
 *           which is the reward for building a corner rather than a line.
 *   RECIPE  the four, and everything touching them in all directions, at double
 *           score. The guest's own shot should feel like it clears the bar.
 *
 * Coffee cups are not matched, only caught: any cup touching a break goes with
 * it, and one cup going off can set off the next.
 */
function breakSet(board: Board, recipe: BottleId[]): {
  reasons: Map<number, ClearReason>;
  recipeHit: boolean;
} {
  const reasons = new Map<number, ClearReason>();
  const mark = (i: number, reason: ClearReason) => {
    if (!board.cells[i]) return;
    const cur = reasons.get(i);
    if (cur === undefined || REASON_RANK[reason] > REASON_RANK[cur]) reasons.set(i, reason);
  };

  const recipeRuns = findRecipeRuns(board, recipe);
  for (const run of recipeRuns) {
    for (const i of run) mark(i, "recipe");
    for (const i of neighboursOf(board, run, true)) mark(i, "blast");
  }

  for (const group of findMatches(board)) {
    for (const i of group) mark(i, "match");
    if (group.length >= 4) for (const i of neighboursOf(board, group, false)) mark(i, "blast");
    if (group.length >= 5) for (const i of neighboursOf(board, group, true)) mark(i, "blast");
  }

  if (reasons.size) {
    // Coffee chain. A cup next to anything breaking goes off, and a cup next to
    // THAT goes off too, so a line of cups pays out all at once.
    const queue = Array.from(reasons.keys());
    while (queue.length) {
      const i = queue.pop() as number;
      for (const j of neighboursOf(board, [i], false)) {
        if (reasons.has(j)) continue;
        if (board.cells[j]?.kind !== "coffee") continue;
        reasons.set(j, "coffee");
        queue.push(j);
      }
    }
    // A cup swept up by a blast is still a cup: it pays swipes, not a bottle.
    reasons.forEach((reason, i) => {
      if (reason !== "coffee" && board.cells[i]?.kind === "coffee") reasons.set(i, "coffee");
    });
  }

  return { reasons, recipeHit: recipeRuns.length > 0 };
}

/** Empty the broken cells and build the step describing it. */
function applyBreak(
  state: StageState,
  reasons: Map<number, ClearReason>,
  recipeHit: boolean,
  combo: number,
  count: boolean
): ClearStep {
  const cleared: ClearedCell[] = [];
  let coffee = 0;

  reasons.forEach((reason, i) => {
    const cell = state.board.cells[i];
    if (!cell) return;
    cleared.push({ i, cell, reason });
    if (cell.kind === "coffee") coffee++;
    else if (count) {
      state.rules.targets.forEach((t, ti) => {
        if (t.kind === cell.kind) state.got[ti]++;
      });
    }
    state.board.cells[i] = null;
  });

  const bottles = cleared.length - coffee;
  const base = bottles * SCORE_PER_CELL * comboMultiplier(combo) * (recipeHit ? RECIPE_MULTIPLIER : 1);
  const score = count ? Math.round(base) + coffee * SCORE_COFFEE : 0;

  if (count) {
    state.score += score;
    state.swipesLeft += coffee * COFFEE_SWIPES;
  }

  return { t: "clear", combo, counted: count, cleared, score, recipeHit, coffee };
}

// ─── Gravity ─────────────────────────────────────────────────────────────────

function newCell(state: StageState, kind: CellKind): Cell {
  return { id: state.nextId++, kind };
}

function rollKind(state: StageState, coffeeBudget: { left: number }): CellKind {
  if (coffeeBudget.left > 0 && state.rng() < state.rules.coffeeChance) {
    coffeeBudget.left--;
    return "coffee";
  }
  return pick(state.rng, state.rules.palette);
}

/** Room for how many more cups: whichever of the two limits bites first. */
function coffeeBudgetFor(board: Board, perMove: number): { left: number } {
  let on = 0;
  for (const c of board.cells) if (c?.kind === "coffee") on++;
  return { left: Math.max(0, Math.min(perMove, MAX_COFFEE_ON_BOARD - on)) };
}

/**
 * Everything falls, then the bar back restocks the top.
 *
 * Survivors keep their id — the renderer slides the same sprite down rather
 * than fading one out and another in, which is what gives the board weight.
 */
function collapse(state: StageState, budget: { left: number }): FallStep {
  const { board } = state;
  const moves: FallStep["moves"] = [];
  const spawns: FallStep["spawns"] = [];

  for (let x = 0; x < board.cols; x++) {
    let write = board.rows - 1;
    for (let y = board.rows - 1; y >= 0; y--) {
      const i = y * board.cols + x;
      const cell = board.cells[i];
      if (!cell) continue;
      const to = write * board.cols + x;
      if (to !== i) {
        board.cells[to] = cell;
        board.cells[i] = null;
        moves.push({ from: i, to });
      }
      write--;
    }
    // write is now the lowest empty row. Fill upward so the cell that has
    // furthest to fall is the one that started highest.
    const empty = write + 1;
    for (let y = write; y >= 0; y--) {
      const cell = newCell(state, rollKind(state, budget));
      board.cells[y * board.cols + x] = cell;
      spawns.push({ to: y * board.cols + x, cell, rise: empty - y });
    }
  }

  return { t: "fall", moves, spawns };
}

// ─── Resolution ──────────────────────────────────────────────────────────────

/**
 * Break, fall, break again, until the board is quiet.
 *
 * `count` is false for the opening deal only. The board is dealt at random and
 * whatever matched on the way in pops for the show of it — but it pays nothing
 * and fills none of the guest's order, because a stage that could be handed to
 * you before you touched it is not a stage. See createStage.
 */
function resolve(state: StageState, count: boolean, startCombo = 0): Step[] {
  const steps: Step[] = [];
  let combo = startCombo;
  // ONE budget for the whole chain, not one per break. See MAX_COFFEE_PER_MOVE.
  const budget = coffeeBudgetFor(state.board, MAX_COFFEE_PER_MOVE);
  // A hard stop. Cascades terminate on any sane board, but a bad palette or a
  // future special that re-adds cells must not be able to hang a phone.
  for (let guard = 0; guard < 64; guard++) {
    const { reasons, recipeHit } = breakSet(state.board, state.rules.recipe);
    if (!reasons.size) break;
    combo++;
    steps.push(applyBreak(state, reasons, recipeHit, combo, count));
    steps.push(collapse(state, budget));
  }
  return steps;
}

// ─── Moves ───────────────────────────────────────────────────────────────────

function swapCells(board: Board, a: number, b: number) {
  const t = board.cells[a];
  board.cells[a] = board.cells[b];
  board.cells[b] = t;
}

/** Would swapping these two break anything? */
export function swapWouldBreak(board: Board, recipe: BottleId[], a: number, b: number): boolean {
  swapCells(board, a, b);
  const hit = findMatches(board).length > 0 || findRecipeRuns(board, recipe).length > 0;
  swapCells(board, a, b);
  return hit;
}

/** Is there any legal move left? */
export function hasMove(board: Board, recipe: BottleId[]): boolean {
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const i = y * board.cols + x;
      if (x + 1 < board.cols && swapWouldBreak(board, recipe, i, i + 1)) return true;
      if (y + 1 < board.rows && swapWouldBreak(board, recipe, i, i + board.cols)) return true;
    }
  }
  return false;
}

/**
 * What a swap would break, without breaking it.
 *
 * The attract-mode bot needs this to play like somebody who can see the board
 * rather than somebody stabbing at it, and the balance tests need it to model
 * a competent player. Only the FIRST break is reported: what cascades out of it
 * depends on stock that has not been rolled yet, so predicting it would be
 * inventing a future rather than reading the present.
 */
export function previewSwap(
  board: Board,
  recipe: BottleId[],
  a: number,
  b: number
): { kinds: CellKind[]; recipeHit: boolean } | null {
  if (!areAdjacent(board, a, b) || !board.cells[a] || !board.cells[b]) return null;
  swapCells(board, a, b);
  const { reasons, recipeHit } = breakSet(board, recipe);
  const kinds: CellKind[] = [];
  reasons.forEach((_, i) => {
    const cell = board.cells[i];
    if (cell) kinds.push(cell.kind);
  });
  swapCells(board, a, b);
  return kinds.length ? { kinds, recipeHit } : null;
}

/** Every legal move, for the attract-mode bot and for tests. */
export function legalMoves(board: Board, recipe: BottleId[]): [number, number][] {
  const out: [number, number][] = [];
  for (let y = 0; y < board.rows; y++) {
    for (let x = 0; x < board.cols; x++) {
      const i = y * board.cols + x;
      if (x + 1 < board.cols && swapWouldBreak(board, recipe, i, i + 1)) out.push([i, i + 1]);
      if (y + 1 < board.rows && swapWouldBreak(board, recipe, i, i + board.cols)) out.push([i, i + board.cols]);
    }
  }
  return out;
}

/**
 * Re-deal a dead board.
 *
 * Reuses the same bottles rather than rolling new ones, so a player who was one
 * swipe from a target does not watch the board he needed evaporate. Falls back
 * to fresh stock only if shuffling the existing set cannot produce a live
 * board, which needs a genuinely degenerate hand.
 */
export function reshuffle(state: StageState): ShuffleStep {
  const { board } = state;
  const stock = board.cells.filter((c): c is Cell => c !== null);
  for (let attempt = 0; attempt < 40; attempt++) {
    const dealt = shuffled(state.rng, stock);
    board.cells = dealt.slice();
    if (!findMatches(board).length && hasMove(board, state.rules.recipe)) {
      return { t: "shuffle", cells: board.cells.slice() };
    }
  }
  for (let i = 0; i < board.cells.length; i++) {
    board.cells[i] = newCell(state, pick(state.rng, state.rules.palette));
  }
  return { t: "shuffle", cells: board.cells.slice() };
}

export interface MoveResult {
  ok: boolean;
  steps: Step[];
}

/**
 * The player's move: swap two touching cells.
 *
 * A swap that breaks nothing is REFUSED and costs no swipe. That is not
 * generosity — on a phone a mis-registered drag is the player's most common
 * input, and charging for it would make the game feel like it was cheating.
 */
export function trySwap(state: StageState, a: number, b: number): MoveResult {
  if (state.outcome !== "playing") return { ok: false, steps: [] };
  if (a === b || !areAdjacent(state.board, a, b)) return { ok: false, steps: [] };
  if (!state.board.cells[a] || !state.board.cells[b]) return { ok: false, steps: [] };

  if (!swapWouldBreak(state.board, state.rules.recipe, a, b)) {
    return { ok: false, steps: [{ t: "swap", a, b, ok: false }] };
  }

  swapCells(state.board, a, b);
  state.swipesLeft--;

  const steps: Step[] = [{ t: "swap", a, b, ok: true }, ...resolve(state, true)];

  // Settle the outcome only once the whole chain has paid out, so a cascade
  // that finishes the order still counts even if it started on the last swipe.
  if (targetsMet(state)) {
    state.outcome = "won";
    state.score += state.swipesLeft * SCORE_PER_SWIPE_LEFT;
  } else if (state.swipesLeft <= 0) {
    state.outcome = "lost";
  } else if (!hasMove(state.board, state.rules.recipe)) {
    steps.push(reshuffle(state));
    steps.push(...resolve(state, true));
  }

  return { ok: true, steps };
}

// ─── Setting up ──────────────────────────────────────────────────────────────

export interface StageStart {
  state: StageState;
  /**
   * The board exactly as DEALT, before the opening cascade touched it.
   *
   * Handed back so the renderer can start from the deal and replay the steps
   * forward, which is the same thing it does for every later move. The
   * alternative — starting from the settled board and running the steps
   * backwards to work out where everything must have been — is what this
   * replaced, and it was quietly wrong: a bottle that neither broke nor spawned
   * appears in no step at all, so it could not be rewound, and the fall steps
   * then moved whatever happened to be sitting in its slot instead. The board
   * came up with holes in it.
   */
  dealt: (Cell | null)[];
  /** The opening deal settling. Pays nothing; see resolve(). */
  steps: Step[];
}

export function createStage(rules: StageRules, seed: number, cols: number, rows: number): StageStart {
  const state: StageState = {
    rules,
    board: { cols, rows, cells: new Array(cols * rows).fill(null) },
    swipesLeft: rules.swipes,
    got: rules.targets.map(() => 0),
    score: 0,
    outcome: "playing",
    rng: makeRng(seed),
    nextId: 1,
  };

  const budget = coffeeBudgetFor(state.board, MAX_COFFEE_ON_BOARD);
  for (let i = 0; i < state.board.cells.length; i++) {
    state.board.cells[i] = newCell(state, rollKind(state, budget));
  }

  const dealt = state.board.cells.slice();

  const steps = resolve(state, false);
  if (!hasMove(state.board, rules.recipe)) {
    steps.push(reshuffle(state));
    steps.push(...resolve(state, false));
  }
  return { state, dealt, steps };
}
