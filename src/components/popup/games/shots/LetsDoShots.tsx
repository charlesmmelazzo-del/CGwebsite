"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ArcadeGameProps } from "../registry";
import { drawText, drawTextMarquee, textWidth } from "../arcade";
import ShotsCanvas, { type SwipeDir } from "./ShotsCanvas";
import {
  BOARD_H, BOARD_W, BOARD_X, C, CELL, COLS, HUD_CONTENT, RECIPE_H, ROWS, W,
  layoutFor, type Layout,
} from "./constants";
import { BOTTLES, type CellKind } from "./bottles";
import { GUESTS, type BubbleRect, type GuestArt } from "./guestArt";
import { buildStage, orderIndexOf } from "./stages";
import {
  COFFEE_SWIPES, createStage, legalMoves, makeRng, previewSwap, trySwap,
  type Cell, type ClearReason, type ClearStep, type FallStep, type Rng,
  type StageRules, type StageState, type Step,
} from "./shotsCore";
import {
  bartenderUrl, bottleUrl, coffeeUrl, drawBarBack, drawBottle, getImage, guestUrl, prefetch,
} from "./sprites";

// ─── Timing ──────────────────────────────────────────────────────────────────
//
// The pop and the fall deliberately OVERLAP. Running them strictly in sequence
// put a fifth of a second of dead air between every link of a cascade, and a
// four-deep chain took well over two seconds of watching — long enough that the
// player stops reading it as one event. Here the clear phase hands over after
// 0.14s while the broken bottles are still flying apart, so the board is
// already refilling behind its own debris.

const SWAP_TIME = 0.13;
const SWAP_BACK_TIME = 0.11;
const CLEAR_HANDOVER = 0.14;
const POP_LIFE = 0.3;
const FALL_TIMEOUT = 1.4;

/** Fall acceleration, logical px/s². About three cells of drop in a third of a second. */
const GRAVITY = 2100;
const MAX_FALL = 1150;
/** How much of the impact comes back up. Enough to read as glass, not as rubber. */
const BOUNCE = 0.18;

const PANEL_HOLD = { ask: 2.4, order: 4.2, go: 2.2 } as const;
const DEMO_HOLD = 0.9;

const CONTINUES = 3;

// ─── Animation state ─────────────────────────────────────────────────────────

interface Piece {
  id: number;
  kind: CellKind;
  gx: number;
  gy: number;
  /** Centre, in logical px from the board's top-left. Survives a resize. */
  px: number;
  py: number;
  vy: number;
  /** 1 is unsquashed. Dips on landing and springs back. */
  squash: number;
  tween: { fromX: number; fromY: number; toX: number; toY: number; t: number; dur: number } | null;
}

interface Pop {
  kind: CellKind;
  reason: ClearReason;
  px: number;
  py: number;
  t: number;
}

interface Shard {
  px: number;
  py: number;
  vx: number;
  vy: number;
  life: number;
  color: string;
  size: number;
}

interface FloatText {
  text: string;
  px: number;
  py: number;
  t: number;
  color: string;
  scale: number;
}

/** A bottle the bar back has thrown up toward the shelf. Pure theatre. */
interface Toss {
  /** Absolute, not relative to the runner — a thrown bottle is out of his hands. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  kind: CellKind;
}

type Anim =
  | { kind: "idle" }
  | { kind: "swap"; a: Piece; b: Piece; t: number; dur: number }
  | { kind: "clear"; t: number }
  | { kind: "fall"; t: number }
  | { kind: "settle"; t: number };

type Phase = "ask" | "order" | "go" | "play" | "won" | "lost" | "gameover";

interface Game {
  phase: Phase;
  phaseT: number;
  stageNo: number;
  /** Banked across cleared stages. The number that goes on the board. */
  total: number;
  continues: number;
  rng: Rng;
  rules: StageRules;
  state: StageState;
  guest: GuestArt;
  pieces: Map<number, Piece>;
  byCell: (Piece | null)[];
  pops: Pop[];
  shards: Shard[];
  floats: FloatText[];
  queue: Step[];
  anim: Anim;
  selected: number | null;
  barback: { t: number; running: boolean; tosses: Toss[] };
  shake: number;
  recentOrders: number[];
  recentGuests: number[];
  /** True once onGameOver has fired, so a run can only be reported once. */
  reported: boolean;
}

// ─── Stage set-up ────────────────────────────────────────────────────────────

function startStage(g: Game, stageNo: number) {
  const rules = buildStage(stageNo, g.rng, {
    avoidOrders: g.recentOrders,
    avoidGuests: g.recentGuests,
  });
  const { state, dealt, steps } = createStage(rules, Math.floor(g.rng() * 0x7fffffff), COLS, ROWS);

  g.stageNo = stageNo;
  g.rules = rules;
  g.state = state;
  g.guest = GUESTS[rules.guest] ?? GUESTS[0];
  g.selected = null;
  g.pieces = new Map();
  g.byCell = new Array(COLS * ROWS).fill(null);
  g.pops = [];
  g.shards = [];
  g.floats = [];
  g.anim = { kind: "idle" };
  g.shake = 0;

  // Start from the deal and replay forward — the same contract every later
  // move uses. The rules are already settled; the animation is the retelling.
  seedPieces(g, dealt);
  g.queue = steps;

  g.recentOrders = [orderIndexOf(rules), ...g.recentOrders].slice(0, 12);
  g.recentGuests = [rules.guest, ...g.recentGuests].slice(0, 6);

  prefetch([
    guestUrl(g.guest.slug, "order"),
    guestUrl(g.guest.slug, "mad"),
    guestUrl(g.guest.slug, "happy"),
    ...rules.palette.map(bottleUrl),
    coffeeUrl(),
  ]);
}

/** Put a piece on the board for every cell of the deal, all of them still in the air. */
function seedPieces(g: Game, dealt: (Cell | null)[]) {
  dealt.forEach((cell, i) => {
    if (!cell) return;
    addPiece(g, cell.id, cell.kind, i % COLS, Math.floor(i / COLS), true);
  });
  reindex(g);
}

function addPiece(g: Game, id: number, kind: CellKind, gx: number, gy: number, dropIn: boolean) {
  const p: Piece = {
    id, kind, gx, gy,
    px: (gx + 0.5) * CELL,
    py: dropIn ? -(ROWS - gy + 1) * CELL : (gy + 0.5) * CELL,
    vy: 0,
    squash: 1,
    tween: null,
  };
  g.pieces.set(id, p);
  return p;
}

function reindex(g: Game) {
  g.byCell = new Array(COLS * ROWS).fill(null);
  g.pieces.forEach((p) => {
    if (p.gx >= 0 && p.gy >= 0) g.byCell[p.gy * COLS + p.gx] = p;
  });
}

const targetX = (p: Piece) => (p.gx + 0.5) * CELL;
const targetY = (p: Piece) => (p.gy + 0.5) * CELL;

// ─── Applying a step ─────────────────────────────────────────────────────────

function beginStep(g: Game, step: Step) {
  if (step.t === "swap") {
    const a = g.byCell[step.a];
    const b = g.byCell[step.b];
    if (!a || !b) {
      g.anim = { kind: "idle" };
      return;
    }
    if (step.ok) {
      const ax = a.gx, ay = a.gy;
      a.gx = b.gx; a.gy = b.gy;
      b.gx = ax; b.gy = ay;
      reindex(g);
      tweenToSlot(a); tweenToSlot(b);
      g.anim = { kind: "swap", a, b, t: 0, dur: SWAP_TIME };
    } else {
      // Out and straight back. The refusal has to be VISIBLE — a swap that
      // simply did not happen reads as a dropped input, and the player repeats
      // it harder instead of looking for a different move.
      tweenTo(a, targetX(b), targetY(b));
      tweenTo(b, targetX(a), targetY(a));
      g.anim = { kind: "swap", a, b, t: 0, dur: SWAP_BACK_TIME };
      g.shake = Math.max(g.shake, 1.4);
    }
    return;
  }

  if (step.t === "clear") {
    applyClear(g, step);
    g.anim = { kind: "clear", t: 0 };
    return;
  }

  if (step.t === "fall") {
    applyFall(g, step);
    g.anim = { kind: "fall", t: 0 };
    return;
  }

  // Shuffle: everything flies to a new home at once.
  g.pieces = new Map();
  step.cells.forEach((cell, i) => {
    if (!cell) return;
    const p = addPiece(g, cell.id, cell.kind, i % COLS, Math.floor(i / COLS), false);
    p.px = CELL * COLS * 0.5;
    p.py = CELL * ROWS * 0.5;
    tweenToSlot(p, 0.26);
  });
  reindex(g);
  g.anim = { kind: "settle", t: 0 };
}

function tweenTo(p: Piece, toX: number, toY: number, dur = SWAP_TIME) {
  p.tween = { fromX: p.px, fromY: p.py, toX, toY, t: 0, dur };
}
function tweenToSlot(p: Piece, dur = SWAP_TIME) {
  tweenTo(p, targetX(p), targetY(p), dur);
}

function applyClear(g: Game, step: ClearStep) {
  const counted = step.combo > 0;
  for (const c of step.cleared) {
    const p = g.pieces.get(c.cell.id);
    const px = p ? p.px : ((c.i % COLS) + 0.5) * CELL;
    const py = p ? p.py : (Math.floor(c.i / COLS) + 0.5) * CELL;
    if (p) g.pieces.delete(c.cell.id);
    g.pops.push({ kind: c.cell.kind, reason: c.reason, px, py, t: 0 });
    spawnShards(g, c.cell.kind, px, py, c.reason);
  }
  reindex(g);

  g.shake = Math.min(6, g.shake + (step.recipeHit ? 5 : Math.min(3, step.cleared.length * 0.25)));

  if (!counted) return;
  const mid = step.cleared.reduce(
    (acc, c) => {
      acc.x += ((c.i % COLS) + 0.5) * CELL;
      acc.y += (Math.floor(c.i / COLS) + 0.5) * CELL;
      return acc;
    },
    { x: 0, y: 0 }
  );
  const cx = mid.x / Math.max(1, step.cleared.length);
  const cy = mid.y / Math.max(1, step.cleared.length);

  if (step.score > 0) {
    g.floats.push({ text: `+${step.score}`, px: cx, py: cy, t: 0, color: C.bone, scale: 1 });
  }
  if (step.recipeHit) {
    g.floats.push({ text: "SHOT! X2", px: cx, py: cy - 14, t: 0, color: C.brass, scale: 2 });
  } else if (step.combo >= 3) {
    // Third link and deeper only. A chain of two happens constantly, and
    // labelling every one left three or four overlapping banners on screen at
    // once during a long cascade — which made the deep chain, the thing
    // actually worth celebrating, harder to see rather than easier.
    g.floats.push({ text: `CHAIN X${step.combo}`, px: cx, py: cy - 12, t: 0, color: C.neon, scale: 1 });
  }
  if (step.coffee > 0) {
    g.floats.push({
      text: `+${step.coffee * COFFEE_SWIPES} SWIPES`,
      px: cx, py: cy + 12, t: 0, color: C.good, scale: 1,
    });
  }

  // Newest wins. A seven-deep chain can otherwise stack a dozen labels over the
  // board, and none of them can be read.
  if (g.floats.length > 6) g.floats.splice(0, g.floats.length - 6);
}

function spawnShards(g: Game, kind: CellKind, px: number, py: number, reason: ClearReason) {
  const color = kind === "coffee" ? "#C89A6A" : BOTTLES[kind].color;
  const n = reason === "recipe" ? 9 : 6;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2 + Math.random() * 0.6;
    const speed = 55 + Math.random() * 95;
    g.shards.push({
      px, py,
      vx: Math.cos(a) * speed,
      vy: Math.sin(a) * speed - 45,
      life: 0.34 + Math.random() * 0.22,
      color,
      size: Math.random() < 0.35 ? 3 : 2,
    });
  }
}

function applyFall(g: Game, step: FallStep) {
  for (const m of step.moves) {
    const p = g.byCell[m.from];
    if (!p) continue;
    p.gx = m.to % COLS;
    p.gy = Math.floor(m.to / COLS);
    p.tween = null;
  }
  for (const sp of step.spawns) {
    const gx = sp.to % COLS;
    const gy = Math.floor(sp.to / COLS);
    const p = addPiece(g, sp.cell.id, sp.cell.kind, gx, gy, false);
    // Stacked above the lip in the order they will land, so a column pours
    // rather than materialising.
    p.py = -(sp.rise - 0.5) * CELL;
    p.vy = 0;
  }
  reindex(g);
  if (step.spawns.length) startBarBack(g, step.spawns.map((s) => s.cell.kind));
}

// ─── The bar back ────────────────────────────────────────────────────────────

/**
 * Send the bar back across with an armful of stock.
 *
 * Cosmetic from top to bottom: nothing waits for him and no bottle on the board
 * is the bottle he threw. He exists because a board that silently refills from
 * nowhere feels like a spreadsheet, and one that gets restocked by somebody
 * running past feels like a bar.
 */
function startBarBack(g: Game, kinds: CellKind[]) {
  if (!g.barback.running) {
    g.barback.running = true;
    g.barback.t = 0;
  }
  const from = barBackX(g.barback.t);
  for (let i = 0; i < Math.min(3, kinds.length); i++) {
    g.barback.tosses.push({
      x: from + (Math.random() - 0.5) * 8,
      y: 0,
      vx: 30 + Math.random() * 40,
      // Tuned so the top of the arc lands about where the shelf's own bottles
      // stand: he is restocking the shelf, not clearing the roof.
      vy: -(110 + Math.random() * 40),
      kind: kinds[Math.floor(Math.random() * kinds.length)],
    });
  }
}

/** How far across he is, for a run that lasts BARBACK_RUN seconds. */
const BARBACK_RUN = 1.15;
function barBackX(t: number): number {
  return -20 + (t * (W + 40)) / BARBACK_RUN;
}

// ─── Update ──────────────────────────────────────────────────────────────────

function updatePlay(g: Game, dt: number) {
  // Physics first, so a step that completes this frame starts the next one
  // against pieces that have already moved.
  g.pieces.forEach((p) => {
    if (p.tween) {
      p.tween.t += dt;
      const k = Math.min(1, p.tween.t / p.tween.dur);
      // Ease-out cubic: a swap should leave fast and arrive gently, which is
      // what makes a flick feel like it carried weight rather than teleported.
      const e = 1 - Math.pow(1 - k, 3);
      p.px = p.tween.fromX + (p.tween.toX - p.tween.fromX) * e;
      p.py = p.tween.fromY + (p.tween.toY - p.tween.fromY) * e;
      if (k >= 1) p.tween = null;
      return;
    }
    const ty = targetY(p);
    const tx = targetX(p);
    if (Math.abs(p.px - tx) > 0.5) p.px += (tx - p.px) * Math.min(1, dt * 18);
    else p.px = tx;

    if (p.py < ty - 0.4 || Math.abs(p.vy) > 1) {
      p.vy = Math.min(MAX_FALL, p.vy + GRAVITY * dt);
      p.py += p.vy * dt;
      if (p.py >= ty) {
        const impact = p.vy;
        p.py = ty;
        if (impact > 220) {
          p.vy = -impact * BOUNCE;
          p.py -= 0.1;
          p.squash = Math.max(0.62, 1 - impact / 2600);
        } else {
          p.vy = 0;
        }
      }
    } else {
      p.py = ty;
      p.vy = 0;
    }
    // Spring the squash back out. Slower than the drop so the landing reads.
    p.squash += (1 - p.squash) * Math.min(1, dt * 11);
  });

  for (let i = g.pops.length - 1; i >= 0; i--) {
    g.pops[i].t += dt;
    if (g.pops[i].t >= POP_LIFE) g.pops.splice(i, 1);
  }
  for (let i = g.shards.length - 1; i >= 0; i--) {
    const s = g.shards[i];
    s.life -= dt;
    s.vy += 620 * dt;
    s.px += s.vx * dt;
    s.py += s.vy * dt;
    if (s.life <= 0) g.shards.splice(i, 1);
  }
  for (let i = g.floats.length - 1; i >= 0; i--) {
    const f = g.floats[i];
    f.t += dt;
    f.py -= dt * 22;
    if (f.t > 0.95) g.floats.splice(i, 1);
  }

  g.shake = Math.max(0, g.shake - dt * 14);

  // Bar back
  const bb = g.barback;
  if (bb.running) {
    bb.t += dt;
    if (bb.t > BARBACK_RUN) {
      bb.running = false;
      bb.t = 0;
    }
  }
  for (let i = bb.tosses.length - 1; i >= 0; i--) {
    const t = bb.tosses[i];
    t.vy += 240 * dt;
    t.x += t.vx * dt;
    t.y += t.vy * dt;
    if (t.y > 40) bb.tosses.splice(i, 1);
  }

  // ── Step machine ────────────────────────────────────────────────────────
  const a = g.anim;
  if (a.kind === "swap") {
    a.t += dt;
    if (a.t >= a.dur) {
      if (!g.queue.length) {
        // A refused swap: put both back where they were and hand control over.
        tweenToSlot(a.a, SWAP_BACK_TIME);
        tweenToSlot(a.b, SWAP_BACK_TIME);
      }
      g.anim = { kind: "idle" };
    }
  } else if (a.kind === "clear") {
    a.t += dt;
    if (a.t >= CLEAR_HANDOVER) g.anim = { kind: "idle" };
  } else if (a.kind === "fall" || a.kind === "settle") {
    a.t += dt;
    const resting = Array.from(g.pieces.values()).every(
      (p) => !p.tween && Math.abs(p.py - targetY(p)) < 0.6 && Math.abs(p.vy) < 12
    );
    if (resting || a.t > FALL_TIMEOUT) g.anim = { kind: "idle" };
  }

  if (g.anim.kind === "idle" && g.queue.length) {
    beginStep(g, g.queue.shift() as Step);
  }
}

const isBusy = (g: Game) => g.anim.kind !== "idle" || g.queue.length > 0;

// ─── Moves ───────────────────────────────────────────────────────────────────

function cellAt(layout: Layout, x: number, y: number): number | null {
  const cx = Math.floor((x - BOARD_X) / CELL);
  const cy = Math.floor((y - layout.boardY) / CELL);
  if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
  return cy * COLS + cx;
}

function commit(g: Game, a: number, b: number) {
  const res = trySwap(g.state, a, b);
  g.selected = null;
  if (res.steps.length) g.queue.push(...res.steps);
}

/**
 * Once the board is quiet, a settled stage moves the story on.
 *
 * The stage's score is banked HERE and nowhere else. Banking it the moment the
 * winning swap resolved meant the running total already contained it while the
 * HUD was still adding the stage score on top — so for the second or so the
 * winning cascade took to play out, the number on screen was double what the
 * player had actually earned, then halved itself.
 */
function checkOutcome(g: Game) {
  if (g.phase !== "play" || isBusy(g)) return;
  if (g.state.outcome === "won") {
    g.total += g.state.score;
    g.phase = "won";
    g.phaseT = 0;
  } else if (g.state.outcome === "lost") {
    // A lost round banks nothing. The order was never poured.
    g.phase = g.continues > 0 ? "lost" : "gameover";
    g.phaseT = 0;
  }
}

// ─── Drawing ─────────────────────────────────────────────────────────────────

function fillRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color;
  ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
}

/**
 * The colour-coding under a bottle: a dark seat, and a bright bar along the
 * bottom of the cell in the spirit's own colour.
 *
 * The first attempt filled the whole cell with that colour, which did read at a
 * glance — and turned the board into a patchwork quilt so loud that the bottles
 * on top of it disappeared. A shelf tag does the same job: the eye can still
 * scan a column for a run of one colour, but the picture on the shelf is what
 * it lands on. Ten spirits is twice a normal match-3 alphabet, so this is not
 * decoration; without some second channel a dark rum and a dark bourbon are one
 * brown smudge in peripheral vision.
 */
function drawTile(ctx: CanvasRenderingContext2D, kind: CellKind, cx: number, cy: number) {
  const color = kind === "coffee" ? C.brass : BOTTLES[kind].color;
  const shade = kind === "coffee" ? C.brassDark : BOTTLES[kind].shade;
  const x = cx - CELL / 2 + 2;
  const y = cy - CELL / 2 + 2;
  const w = CELL - 4;
  const hgt = CELL - 4;
  ctx.globalAlpha = 0.5;
  fillRect(ctx, x, y, w, hgt, shade);
  ctx.globalAlpha = 1;
  fillRect(ctx, x, y + hgt - 3, w, 3, color);
}

function drawBoard(ctx: CanvasRenderingContext2D, g: Game, layout: Layout, t: number) {
  const ox = BOARD_X;
  const oy = layout.boardY;

  // The well: a recessed panel with a lit lip, which is the one bit of depth
  // the whole screen gets. Everything else is flat on purpose.
  fillRect(ctx, ox - 4, oy - 4, BOARD_W + 8, BOARD_H + 8, C.panelLip);
  fillRect(ctx, ox - 3, oy - 3, BOARD_W + 6, BOARD_H + 6, C.panel);
  fillRect(ctx, ox, oy, BOARD_W, BOARD_H, C.well);

  for (let y = 0; y < ROWS; y++) {
    for (let x = 0; x < COLS; x++) {
      if ((x + y) % 2 === 0) fillRect(ctx, ox + x * CELL, oy + y * CELL, CELL, CELL, C.wellLine);
    }
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(ox, oy, BOARD_W, BOARD_H);
  ctx.clip();

  // Selection, under the bottles so it reads as a lit tile rather than a cage.
  if (g.selected != null) {
    const sx = ox + (g.selected % COLS) * CELL;
    const sy = oy + Math.floor(g.selected / COLS) * CELL;
    const pulse = 0.4 + 0.3 * Math.sin(t * 9);
    ctx.globalAlpha = pulse;
    fillRect(ctx, sx, sy, CELL, CELL, C.brass);
    ctx.globalAlpha = 1;
  }

  g.pieces.forEach((p) => {
    const cx = ox + p.px;
    const cy = oy + p.py;
    const h = CELL * 0.94 * p.squash;
    drawTile(ctx, p.kind, cx, cy);
    drawBottle(ctx, p.kind, cx, cy, h);
  });

  for (const pop of g.pops) {
    const k = pop.t / POP_LIFE;
    drawBottle(ctx, pop.kind, ox + pop.px, oy + pop.py, CELL * 0.94, {
      alpha: 1 - k,
      scale: 1 + k * 0.5,
    });
  }

  for (const s of g.shards) {
    ctx.globalAlpha = Math.max(0, Math.min(1, s.life * 3));
    fillRect(ctx, ox + s.px, oy + s.py, s.size, s.size, s.color);
  }
  ctx.globalAlpha = 1;

  ctx.restore();

  for (const f of g.floats) {
    ctx.globalAlpha = f.t < 0.7 ? 1 : Math.max(0, 1 - (f.t - 0.7) / 0.25);
    // Kept on screen. A break in the right-hand column centres its label past
    // the edge, and "CHAIN X3" losing its last character is the one moment the
    // player most wants to be able to read it.
    const half = textWidth(f.text, f.scale) / 2 + 4;
    const fx = Math.max(half, Math.min(W - half, ox + f.px));
    drawTextMarquee(ctx, f.text, fx, oy + f.py, f.color, f.scale, "center", C.black);
  }
  ctx.globalAlpha = 1;
}

function drawHud(ctx: CanvasRenderingContext2D, g: Game, layout: Layout) {
  // Opaque, and drawn AFTER the back bar, so a bottle the bar back throws
  // toward the shelf disappears behind the readouts instead of sailing across
  // the swipe counter.
  fillRect(ctx, 0, 0, W, layout.backbarY, C.night);

  // Hung from the BOTTOM of the HUD box, so extra height on a tall phone opens
  // up above the readouts instead of stranding them at the top of the screen.
  const y = layout.backbarY - HUD_CONTENT;

  // Everything that matters is on the LEFT, and the top-right is deliberately
  // empty — that corner belongs to the cabinet's EXIT button. See
  // EXIT_CLEARANCE_W. The score lived up there until it was noticed that on a
  // short phone it sat directly under a 44px tap target.
  drawText(ctx, `STAGE ${g.stageNo}`, 16, y, C.dim, 1);

  // Swipes: the largest number on the screen, because it is the clock. Plain,
  // not keylined — a three-pixel black outline at this size stops reading as
  // lettering and starts reading as a box with a number trapped in it.
  const low = g.state.swipesLeft <= 5;
  drawText(ctx, String(g.state.swipesLeft), 16, y + 10, low ? C.hot : C.white, 3);
  drawText(ctx, "SWIPES", 16, y + 34, low ? C.hot : C.dim, 1);

  // What the guest ordered, one chip per bottle. Low enough on the right to
  // clear the exit button on the shortest screen the game runs at.
  const chipW = 42;
  const chips = g.rules.targets.length;
  const startX = W - 16 - chips * chipW;

  // The score drops to small lettering rather than growing into the order
  // chips. A long run reaches seven figures, and at the large size that ran
  // straight under the first chip.
  const score = String(g.total + g.state.score);
  drawText(ctx, "SCORE", 16, y + 46, C.dim, 1);
  const scoreScale = 52 + textWidth(score, 2) < startX - 8 ? 2 : 1;
  drawText(ctx, score, 52, y + (scoreScale === 2 ? 44 : 46), C.brass, scoreScale);
  g.rules.targets.forEach((target, i) => {
    const cx = startX + i * chipW + chipW / 2;
    const done = g.state.got[i] >= target.need;
    drawBottle(ctx, target.kind, cx, y + 40, 22, { alpha: done ? 0.4 : 1 });
    const label = done ? "OK" : `${g.state.got[i]}/${target.need}`;
    drawText(ctx, label, cx, y + 53, done ? C.good : C.bone, 1, "center");
  });

  // One bar for the order as a whole. The three counters answer "how am I doing
  // on Gin"; this answers "am I going to make it", which is the question
  // actually being asked every few seconds.
  const need = g.rules.targets.reduce((s, t) => s + t.need, 0);
  const got = g.rules.targets.reduce((s, t, i) => s + Math.min(g.state.got[i], t.need), 0);
  const barY = y + 62;
  fillRect(ctx, 16, barY, W - 32, 6, C.well);
  fillRect(ctx, 17, barY + 1, Math.round(((W - 34) * got) / Math.max(1, need)), 4, C.good);
  fillRect(ctx, 16, barY, W - 32, 1, C.panelLip);
}

/**
 * The shelf the bar back runs along.
 *
 * On a tall phone this band is the better part of a centimetre of screen and it
 * is empty most of the time, because he only comes out when stock is needed.
 * Left as flat colour it read as a gap in the layout. A back bar drawn into it
 * — shelf, bottles in silhouette, a strip of light along the front edge — makes
 * the same space read as the room the game is set in.
 */
function drawBackBar(ctx: CanvasRenderingContext2D, g: Game, layout: Layout) {
  const y = layout.backbarY;
  const bandH = layout.boardY - y;
  fillRect(ctx, 0, y, W, bandH, C.night);

  const shelfY = layout.boardY - 5;
  const silhouetteH = Math.min(20, bandH - 8);
  for (let i = 0; i < 22; i++) {
    // Fixed, uneven spacing rather than a regular pitch: a perfectly even row
    // of bottles reads as a fence.
    const bx = 6 + i * 12 + ((i * 7) % 5);
    const bh = silhouetteH - ((i * 3) % 5);
    fillRect(ctx, bx, shelfY - bh, 5, bh, C.panel);
    fillRect(ctx, bx + 1, shelfY - bh - 3, 2, 4, C.panel);
  }
  fillRect(ctx, 0, shelfY, W, 3, C.panelLip);
  fillRect(ctx, 0, shelfY, W, 1, C.brassDark);
  fillRect(ctx, 0, layout.boardY - 2, W, 2, C.panelLip);

  const bb = g.barback;
  if (!bb.running && !bb.tosses.length) return;

  const groundY = shelfY;

  for (const t of bb.tosses) {
    drawBottle(ctx, t.kind, t.x, groundY - 16 + t.y, 16, {
      alpha: Math.max(0, 1 - Math.abs(t.y) / 44),
    });
  }
  if (bb.running) {
    drawBarBack(ctx, barBackX(bb.t), groundY, Math.min(30, bandH - 6), Math.floor(bb.t * 12), 1);
  }
}

function drawRecipe(ctx: CanvasRenderingContext2D, g: Game, layout: Layout) {
  const y = layout.recipeY;
  fillRect(ctx, 12, y, W - 24, RECIPE_H, C.panel);
  fillRect(ctx, 12, y, W - 24, 1, C.panelLip);

  drawText(ctx, "BONUS SHOT", 20, y + 5, C.dim, 1);
  const name = g.rules.shotName.toUpperCase();
  drawText(ctx, name, W - 20, y + 5, C.brass, 1, "right");

  const n = g.rules.recipe.length;
  const step = 30;
  const startX = W / 2 - ((n - 1) * step) / 2;
  g.rules.recipe.forEach((kind, i) => {
    const cx = startX + i * step;
    drawBottle(ctx, kind, cx, y + 28, 26);
    if (i < n - 1) drawText(ctx, ">", cx + step / 2, y + 25, C.dim, 1, "center");
  });
}

// ─── Story panels ────────────────────────────────────────────────────────────

/** Cover-fit an image over the whole screen. Returns where it landed. */
function drawPanel(ctx: CanvasRenderingContext2D, url: string, h: number) {
  // Not black: on a slow connection this is what the guest looks at for a
  // second or two, and a flat black screen reads as something having gone
  // wrong. A dark room with a floor line reads as a picture still arriving.
  fillRect(ctx, 0, 0, W, h, C.night);
  fillRect(ctx, 0, Math.round(h * 0.72), W, Math.round(h * 0.28), C.panel);
  fillRect(ctx, 0, Math.round(h * 0.72), W, 2, C.panelLip);
  const img = getImage(url);
  if (!img || !img.naturalWidth) return null;
  const scale = Math.max(W / img.naturalWidth, h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = (W - dw) / 2;
  const dy = (h - dh) / 2;
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = false;
  return { dx, dy, dw, dh };
}

/** Break `text` into lines that fit `maxW` at `scale`. */
function wrapLines(text: string, maxW: number, scale: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, scale) > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

const LINE_H = (scale: number) => 7 * scale + 3 * scale;

/**
 * Set the guest's line inside the bubble drawn into their artwork.
 *
 * The largest size that fits wins. The bubbles are generous and most quips are
 * short, so this lands on the big lettering far more often than not — and the
 * one long order still fits rather than being clipped, which is the failure a
 * fixed size would ship.
 */
function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  rect: BubbleRect,
  panel: { dx: number; dy: number; dw: number; dh: number } | null,
  h: number
) {
  const box = panel
    ? {
        x: panel.dx + rect.x * panel.dw,
        y: panel.dy + rect.y * panel.dh,
        w: rect.w * panel.dw,
        h: rect.h * panel.dh,
      }
    : { x: 22, y: h * 0.06, w: W - 44, h: h * 0.16 };

  if (!panel) {
    // No art yet — draw the bubble too, so the line is never floating in space.
    fillRect(ctx, box.x - 8, box.y - 8, box.w + 16, box.h + 16, C.black);
    fillRect(ctx, box.x - 6, box.y - 6, box.w + 12, box.h + 12, C.bone);
  }

  for (const scale of [2, 1]) {
    const lines = wrapLines(text, box.w, scale);
    const total = lines.length * LINE_H(scale);
    if (total > box.h && scale > 1) continue;
    let ty = box.y + Math.max(0, (box.h - total) / 2);
    for (const line of lines) {
      drawText(ctx, line, box.x + box.w / 2, ty, C.black, scale, "center");
      ty += LINE_H(scale);
    }
    return;
  }
}

/** A band across the bottom of a story panel, for anything that is not dialogue. */
function drawFooter(ctx: CanvasRenderingContext2D, lines: string[], h: number, accent: string) {
  const boxH = 22 + lines.length * 12;
  const y = h - boxH - 14;
  ctx.globalAlpha = 0.86;
  fillRect(ctx, 12, y, W - 24, boxH, C.black);
  ctx.globalAlpha = 1;
  fillRect(ctx, 12, y, W - 24, 1, accent);
  fillRect(ctx, 12, y + boxH - 1, W - 24, 1, accent);
  lines.forEach((line, i) => {
    drawText(ctx, line, W / 2, y + 11 + i * 12, i === 0 ? accent : C.bone, 1, "center");
  });
}

/** The recipe, laid out for a story screen rather than the HUD. */
function drawRecipeCard(ctx: CanvasRenderingContext2D, g: Game, h: number) {
  const cardH = 52;
  const y = h - cardH - 14;
  ctx.globalAlpha = 0.88;
  fillRect(ctx, 12, y, W - 24, cardH, C.black);
  ctx.globalAlpha = 1;
  fillRect(ctx, 12, y, W - 24, 1, C.brass);
  fillRect(ctx, 12, y + cardH - 1, W - 24, 1, C.brass);
  drawText(ctx, g.rules.shotName.toUpperCase(), W / 2, y + 6, C.brass, 1, "center");
  const step = 32;
  const startX = W / 2 - ((g.rules.recipe.length - 1) * step) / 2;
  g.rules.recipe.forEach((kind, i) => {
    drawBottle(ctx, kind, startX + i * step, y + 32, 26);
  });
}

function drawTapHint(ctx: CanvasRenderingContext2D, label: string, h: number, t: number) {
  if (Math.sin(t * 4) < -0.4) return;
  drawTextMarquee(ctx, label, W / 2, h - 10, C.bone, 1, "center", C.black);
}

// ─── Demo bot ────────────────────────────────────────────────────────────────

/**
 * Attract mode plays itself.
 *
 * It picks the move that breaks the most of what is currently being asked for,
 * with a nudge toward the guest's own shot and toward coffee, which is roughly
 * how somebody who has played a few rounds behaves. A purely random bot spends
 * most of the demo failing, which sells nothing.
 */
function botMove(g: Game): [number, number] | null {
  const moves = legalMoves(g.state.board, g.state.rules.recipe);
  if (!moves.length) return null;
  let best = moves[0];
  let bestValue = -1;
  for (const [a, b] of moves) {
    const p = previewSwap(g.state.board, g.state.rules.recipe, a, b);
    if (!p) continue;
    let value = p.recipeHit ? 8 : 0;
    for (const kind of p.kinds) {
      if (kind === "coffee") value += 3;
      else if (g.rules.targets.some((t, i) => t.kind === kind && g.state.got[i] < t.need)) value += 1;
      else value += 0.15;
    }
    if (value > bestValue) {
      bestValue = value;
      best = [a, b];
    }
  }
  return best;
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function LetsDoShots({ onGameOver, demo = false }: ArcadeGameProps) {
  const gameRef = useRef<Game | null>(null);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;
  const botTimer = useRef(0);

  const newRun = useCallback((): Game => {
    const rng = makeRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
    const g: Game = {
      phase: "ask",
      phaseT: 0,
      stageNo: 1,
      total: 0,
      continues: CONTINUES,
      rng,
      rules: null as unknown as StageRules,
      state: null as unknown as StageState,
      guest: GUESTS[0],
      pieces: new Map(),
      byCell: [],
      pops: [],
      shards: [],
      floats: [],
      queue: [],
      anim: { kind: "idle" },
      selected: null,
      barback: { t: 0, running: false, tosses: [] },
      shake: 0,
      recentOrders: [],
      recentGuests: [],
      reported: false,
    };
    startStage(g, 1);
    return g;
  }, []);

  useEffect(() => {
    gameRef.current = newRun();
    prefetch([bartenderUrl("ask"), bartenderUrl("go")]);
  }, [newRun]);

  // ── Advancing the story ──────────────────────────────────────────────────
  const advance = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    switch (g.phase) {
      case "ask":
        g.phase = "order";
        g.phaseT = 0;
        break;
      case "order":
        g.phase = "go";
        g.phaseT = 0;
        break;
      case "go":
        g.phase = "play";
        g.phaseT = 0;
        break;
      case "won": {
        startStage(g, g.stageNo + 1);
        g.phase = "ask";
        g.phaseT = 0;
        break;
      }
      case "lost": {
        if (g.continues <= 0) {
          g.phase = "gameover";
          g.phaseT = 0;
          break;
        }
        g.continues--;
        // A continue re-pours the SAME stage, freshly dealt. Handing back the
        // board they just lost on would be handing back the position that beat
        // them, which is not another go at anything.
        startStage(g, g.stageNo);
        g.phase = "order";
        g.phaseT = 0;
        break;
      }
      case "gameover": {
        if (demo) {
          gameRef.current = newRun();
          return;
        }
        if (!g.reported) {
          g.reported = true;
          overRef.current(g.total, {
            stage: g.stageNo,
            continuesUsed: CONTINUES - g.continues,
          });
        }
        break;
      }
      default:
        break;
    }
  }, [demo, newRun]);

  // ── Input ────────────────────────────────────────────────────────────────
  const onTap = useCallback(
    (x: number, y: number, h: number) => {
      const g = gameRef.current;
      if (!g || demo) return;
      if (g.phase !== "play") {
        advance();
        return;
      }
      if (isBusy(g)) return;
      const cell = cellAt(layoutFor(h), x, y);
      if (cell == null) return;
      if (g.selected == null) {
        g.selected = cell;
        return;
      }
      if (g.selected === cell) {
        g.selected = null;
        return;
      }
      const dx = Math.abs((g.selected % COLS) - (cell % COLS));
      const dy = Math.abs(Math.floor(g.selected / COLS) - Math.floor(cell / COLS));
      if (dx + dy === 1) commit(g, g.selected, cell);
      else g.selected = cell;
    },
    [advance, demo]
  );

  const onSwipe = useCallback(
    (x: number, y: number, dir: SwipeDir, h: number) => {
      const g = gameRef.current;
      if (!g || demo) return;
      if (g.phase !== "play") {
        advance();
        return;
      }
      if (isBusy(g)) return;
      const from = cellAt(layoutFor(h), x, y);
      if (from == null) return;
      const cx = from % COLS;
      const cy = Math.floor(from / COLS);
      const tx = cx + (dir === "left" ? -1 : dir === "right" ? 1 : 0);
      const ty = cy + (dir === "up" ? -1 : dir === "down" ? 1 : 0);
      if (tx < 0 || ty < 0 || tx >= COLS || ty >= ROWS) return;
      commit(g, from, ty * COLS + tx);
    },
    [advance, demo]
  );

  // ── Frame ────────────────────────────────────────────────────────────────
  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number, t: number, h: number) => {
      const g = gameRef.current;
      if (!g || !g.state) return;
      const layout = layoutFor(h);
      g.phaseT += dt;

      fillRect(ctx, 0, 0, W, h, C.black);

      if (g.phase === "play") {
        updatePlay(g, dt);
        checkOutcome(g);

        if (demo && !isBusy(g)) {
          botTimer.current -= dt;
          if (botTimer.current <= 0) {
            botTimer.current = 0.42;
            const move = botMove(g);
            if (move) commit(g, move[0], move[1]);
          }
        }

        // The shake is applied to the WORLD, not the board, so a big break
        // rattles the whole cabinet the way an arcade machine would.
        const shake = g.shake;
        ctx.save();
        if (shake > 0.2) {
          ctx.translate(
            Math.round((Math.random() - 0.5) * shake),
            Math.round((Math.random() - 0.5) * shake)
          );
        }
        fillRect(ctx, 0, 0, W, h, C.night);
        drawBackBar(ctx, g, layout);
        drawHud(ctx, g, layout);
        drawBoard(ctx, g, layout, t);
        drawRecipe(ctx, g, layout);
        ctx.restore();
        return;
      }

      // ── Story screens ─────────────────────────────────────────────────────
      const hold = demo ? DEMO_HOLD : undefined;

      if (g.phase === "ask") {
        drawPanel(ctx, bartenderUrl("ask"), h);
        // The bartender's line is lettered into his artwork already.
        if (g.phaseT > (hold ?? PANEL_HOLD.ask)) advance();
        else drawTapHint(ctx, "TAP", h, t);
        return;
      }

      if (g.phase === "go") {
        drawPanel(ctx, bartenderUrl("go"), h);
        if (g.phaseT > (hold ?? PANEL_HOLD.go)) advance();
        else drawTapHint(ctx, "TAP", h, t);
        return;
      }

      if (g.phase === "order") {
        const panel = drawPanel(ctx, guestUrl(g.guest.slug, "order"), h);
        drawBubble(ctx, g.rules.quip, g.guest.order, panel, h);
        drawRecipeCard(ctx, g, h);
        if (g.phaseT > (hold ?? PANEL_HOLD.order)) advance();
        return;
      }

      if (g.phase === "won") {
        const panel = drawPanel(ctx, guestUrl(g.guest.slug, "happy"), h);
        drawBubble(ctx, "Bottoms up!", g.guest.happy, panel, h);
        drawFooter(ctx, [
          `STAGE ${g.stageNo} CLEARED`,
          `ROUND ${g.state.score}`,
          `TOTAL ${g.total}`,
        ], h, C.good);

        drawTapHint(ctx, "TAP FOR NEXT ROUND", h, t);
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

      if (g.phase === "lost") {
        const panel = drawPanel(ctx, guestUrl(g.guest.slug, "mad"), h);
        drawBubble(ctx, "Where is my shot??", g.guest.mad, panel, h);
        drawFooter(ctx, [
          `CONTINUES ${g.continues}`,
          "TAP TO POUR IT AGAIN",
        ], h, C.hot);
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

      // Game over
      const panel = drawPanel(ctx, guestUrl(g.guest.slug, "mad"), h);
      drawBubble(ctx, "Where is my shot??", g.guest.mad, panel, h);
      drawFooter(ctx, ["GAME OVER", `SCORE ${g.total}`], h, C.hot);
      drawTapHint(ctx, demo ? "" : "TAP TO FINISH", h, t);
      if (demo && g.phaseT > DEMO_HOLD * 2) advance();
    },
    [advance, demo]
  );

  return <ShotsCanvas onFrame={onFrame} running onSwipe={onSwipe} onTap={onTap} />;
}
