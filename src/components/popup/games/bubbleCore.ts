// ─── Bubble Buster — rules ───────────────────────────────────────────────────
//
// The first phase of a round. The bar's whole stock drifts around the top of
// the screen; the recipe sits underneath. Tap what the drink needs and it pops.
// Tap anything else and it costs you.
//
// Replaces the run-and-jump phase. That one had the player chasing a moving
// bartender past shelves, which on a phone meant a D-pad, a camera and a lot of
// screen given over to floor. A tap target that comes to you needs none of it.
//
// The rule that shapes the physics: BUBBLES MAY NEVER OVERLAP. If two drift
// through each other the player cannot tell which one a tap will hit, and a
// wrong pop costs points — so an ambiguous tap is a bug that takes score off
// someone. Separation is resolved positionally every frame, not just by
// swapping velocities, because velocity alone lets a pair sink into each other
// when they are pushed together from both sides.
//
// No React, no canvas. See __tests__/game.test.ts, which steps `updateBubbles`
// directly — a hidden browser tab gives requestAnimationFrame zero frames, so
// watching the canvas proves nothing.

import { GAME_W } from "./arcade";
import type { IngredientKey } from "./cocktails";
import { ingredientsInUse } from "./cocktails";

// ─── Tuning ──────────────────────────────────────────────────────────────────

/**
 * The tank the bubbles drift in, with the recipe strip below it.
 *
 * Runs nearly the full height of the buffer because this phase takes the whole
 * cabinet — there is no control deck under it to leave room for, so anything
 * held back here is just empty screen.
 */
export const TANK_TOP = 16;
export const TANK_BOTTOM = 232;
export const BUBBLE_R = 11;

export const SPEED_MIN = 16;
export const SPEED_MAX = 34;

export const PTS_RIGHT = 120;
export const PTS_WRONG = -60;
export const POP_SECONDS = 0.35;
export const FLASH_SECONDS = 0.9;

export interface Bubble {
  key: IngredientKey;
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** Counts down while the pop animation plays, then the bubble is gone. */
  popping: number;
  popped: boolean;
}

export interface BubbleState {
  t: number;
  bubbles: Bubble[];
  needed: IngredientKey[];
  collected: IngredientKey[];
  score: number;
  flash: { key: IngredientKey; good: boolean; t: number } | null;
  done: boolean;
}

/**
 * Fill the tank.
 *
 * Every ingredient the book uses appears, so the player has to read the recipe
 * rather than tap the nearest thing.
 *
 * Placement is a shuffled grid with a little jitter, NOT rejection sampling.
 * Rejection sampling has no guaranteed outcome — it needs a bail-out after so
 * many tries, and whatever it does at the bail-out is a spawn overlap waiting
 * to happen with an unlucky seed. A grid cannot overlap by construction: cells
 * are 2R + 6 apart and the jitter is capped at half the spare 6, so even two
 * neighbours jittered straight at each other stay a full diameter apart. Only
 * fifteen of the ~48 cells get used, so it still reads as scattered.
 */
export function freshBubbleState(
  needed: IngredientKey[],
  rand: () => number = Math.random
): BubbleState {
  const pool = ingredientsInUse();

  const cell = BUBBLE_R * 2 + 6;
  const jitter = 2.5;
  const cols = Math.max(1, Math.floor(GAME_W / cell));
  const rows = Math.max(1, Math.floor((TANK_BOTTOM - TANK_TOP) / cell));
  const originX = (GAME_W - cols * cell) / 2;
  const originY = TANK_TOP + ((TANK_BOTTOM - TANK_TOP) - rows * cell) / 2;

  const slots: { x: number; y: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      slots.push({
        x: originX + c * cell + cell / 2,
        y: originY + r * cell + cell / 2,
      });
    }
  }
  // Fisher-Yates, so which cells get used varies run to run.
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1)) % slots.length;
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  const bubbles: Bubble[] = pool.map((key, i) => {
    const slot = slots[i % slots.length];
    const angle = rand() * Math.PI * 2;
    const speed = SPEED_MIN + rand() * (SPEED_MAX - SPEED_MIN);
    return {
      key,
      x: clamp(slot.x + (rand() * 2 - 1) * jitter, BUBBLE_R, GAME_W - BUBBLE_R),
      y: clamp(
        slot.y + (rand() * 2 - 1) * jitter,
        TANK_TOP + BUBBLE_R,
        TANK_BOTTOM - BUBBLE_R
      ),
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      popping: 0,
      popped: false,
    };
  });

  return {
    t: 0,
    bubbles,
    needed: [...needed],
    collected: [],
    score: 0,
    flash: null,
    done: false,
  };
}

function clamp(v: number, lo: number, hi: number): number {
  return v < lo ? lo : v > hi ? hi : v;
}

function dist2(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx;
  const dy = ay - by;
  return dx * dx + dy * dy;
}

/** Bubbles still in play — popped ones are neither drawn nor tappable. */
export function live(st: BubbleState): Bubble[] {
  return st.bubbles.filter((b) => !b.popped && b.popping <= 0);
}

export function remaining(st: BubbleState): IngredientKey[] {
  return st.needed.filter((k) => !st.collected.includes(k));
}

export function updateBubbles(st: BubbleState, dt: number): void {
  st.t += dt;

  if (st.flash) {
    st.flash.t -= dt;
    if (st.flash.t <= 0) st.flash = null;
  }

  for (const b of st.bubbles) {
    if (b.popped) continue;
    if (b.popping > 0) {
      b.popping -= dt;
      if (b.popping <= 0) b.popped = true;
      continue;
    }

    b.x += b.vx * dt;
    b.y += b.vy * dt;

    // ── Walls ──────────────────────────────────────────────────────────────
    // Position is clamped as well as the velocity flipped. Flipping alone lets
    // a bubble that arrives fast sit outside the wall for a frame, and on the
    // next frame it flips again — it sticks to the edge, jittering.
    if (b.x < BUBBLE_R) {
      b.x = BUBBLE_R;
      b.vx = Math.abs(b.vx);
    } else if (b.x > GAME_W - BUBBLE_R) {
      b.x = GAME_W - BUBBLE_R;
      b.vx = -Math.abs(b.vx);
    }
    if (b.y < TANK_TOP + BUBBLE_R) {
      b.y = TANK_TOP + BUBBLE_R;
      b.vy = Math.abs(b.vy);
    } else if (b.y > TANK_BOTTOM - BUBBLE_R) {
      b.y = TANK_BOTTOM - BUBBLE_R;
      b.vy = -Math.abs(b.vy);
    }
  }

  // ── Bubble against bubble ────────────────────────────────────────────────
  const inPlay = live(st);
  for (let i = 0; i < inPlay.length; i++) {
    for (let j = i + 1; j < inPlay.length; j++) {
      const a = inPlay[i];
      const b = inPlay[j];
      const min = BUBBLE_R * 2;
      const d2 = dist2(a.x, a.y, b.x, b.y);
      if (d2 >= min * min || d2 === 0) continue;

      const d = Math.sqrt(d2);
      const nx = (b.x - a.x) / d;
      const ny = (b.y - a.y) / d;

      // Push apart first, half each. Equal mass, so the split is even.
      const overlap = (min - d) / 2;
      a.x -= nx * overlap;
      a.y -= ny * overlap;
      b.x += nx * overlap;
      b.y += ny * overlap;

      // Then trade the velocity along the line between them — an elastic hit
      // between equal masses swaps exactly that component and leaves the
      // tangential part alone.
      const av = a.vx * nx + a.vy * ny;
      const bv = b.vx * nx + b.vy * ny;
      if (av - bv > 0) {
        const diff = av - bv;
        a.vx -= diff * nx;
        a.vy -= diff * ny;
        b.vx += diff * nx;
        b.vy += diff * ny;
      }
    }
  }

  if (remaining(st).length === 0) st.done = true;
}

/**
 * A tap at a point in game coordinates.
 *
 * Returns the bubble hit, or null for a miss. A miss is free — the tank is
 * mostly empty space and charging for tapping it would make the game about
 * accuracy rather than about reading the recipe.
 */
export function tapBubbles(st: BubbleState, x: number, y: number): Bubble | null {
  if (st.done) return null;

  // Nearest centre wins, so a tap in the sliver where two bubbles are touching
  // resolves to the one the player is more obviously pointing at.
  let hit: Bubble | null = null;
  let best = Infinity;
  for (const b of live(st)) {
    const d2 = dist2(b.x, b.y, x, y);
    if (d2 <= BUBBLE_R * BUBBLE_R && d2 < best) {
      best = d2;
      hit = b;
    }
  }
  if (!hit) return null;

  hit.popping = POP_SECONDS;

  const wanted = st.needed.includes(hit.key) && !st.collected.includes(hit.key);
  if (wanted) {
    st.collected.push(hit.key);
    st.score += PTS_RIGHT;
    st.flash = { key: hit.key, good: true, t: FLASH_SECONDS };
  } else {
    // Costs points, never a life. Floored so a bad start can't go negative.
    st.score = Math.max(0, st.score + PTS_WRONG);
    st.flash = { key: hit.key, good: false, t: FLASH_SECONDS };
  }

  if (remaining(st).length === 0) st.done = true;
  return hit;
}
