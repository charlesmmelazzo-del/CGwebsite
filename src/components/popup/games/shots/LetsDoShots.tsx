"use client";

import { useCallback, useEffect, useRef } from "react";
import type { ArcadeGameProps } from "../registry";
import { drawText, drawTextMarquee, textWidth } from "../arcade";
import ShotsCanvas, { type SwipeDir } from "./ShotsCanvas";
import { HOWTO_COPY, PARAGRAPH_GAP, lineHeight, wrapLines } from "./text";
import {
  BARBACK_BODY_H, BARBACK_RUN, BOARD_H, BOARD_W, BOARD_X, C, CELL, COLS,
  HUD_CONTENT, RECIPE_H, ROWS, W, barBackPass, layoutFor, type Layout,
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
  bartenderUrl, bottleUrl, coffeeUrl, drawBarBack, drawBottle, drawMood, getImage,
  guestUrl, logoUrl, MOODS, moodUrl, prefetch, type Mood,
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

/**
 * How long the story panels sit before moving themselves on.
 *
 * The RECIPE screen is deliberately not in here. Every other panel is something
 * being said to the player, and holding those hostage to a tap just adds taps —
 * but the recipe screen is the one they are meant to STUDY, and it is the last
 * thing between them and a stage they get a limited number of swipes at. That
 * one waits.
 */
const PANEL_HOLD = { ask: 2.4, order: 4.2, go: 2.2 } as const;
const DEMO_HOLD = 0.9;

const CONTINUES = 3;

/**
 * How long each reaction holds before he settles back to concentrating.
 *
 * Short. He is answering the swipe that just happened, and a grin still on his
 * face three moves later stops being feedback and becomes wallpaper.
 */
const MOOD_HOLD: Record<Mood, number> = {
  concentrating: 0,
  scared: 1.2,
  happy: 1.0,
  celebrating: 2.0,
};

/** Which reaction wins when two land in the same moment. */
const MOOD_RANK: Record<Mood, number> = {
  concentrating: 0, scared: 1, happy: 2, celebrating: 3,
};

/** The three how-to pages, shown once when a run starts. */
const HOWTO_PAGES = 3;

/** Every reaction, so he never pops in halfway through a stage. */
const MOODS_TO_PREFETCH = MOODS.map(moodUrl);

/**
 * The bottles the how-to pages illustrate.
 *
 * They are chosen for how well they read side by side, not from the stage's
 * palette, so they have to be asked for by name — otherwise the very first
 * thing a new player sees is four stand-ins.
 */
const HOWTO_ART = [
  bottleUrl("bourbon"), bottleUrl("gin"), bottleUrl("malort"),
  bottleUrl("scotch"), bottleUrl("tequila"), coffeeUrl(),
];

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

type Anim =
  | { kind: "idle" }
  | { kind: "swap"; a: Piece; b: Piece; t: number; dur: number }
  | { kind: "clear"; t: number }
  | { kind: "fall"; t: number }
  | { kind: "settle"; t: number };

type Phase =
  /** The marquee: start the game, or go and look at the board. */
  | "intro"
  /** Three pages of how to play, once per run. */
  | "howto"
  /** The bartender takes the order. */
  | "ask"
  /** The guest asks for something invented. */
  | "order"
  /** The bartender agrees to attempt it. */
  | "go"
  /** The shot's recipe, full screen, immediately before play. */
  | "recipe"
  | "play"
  | "won"
  | "lost"
  | "gameover";

interface Game {
  phase: Phase;
  phaseT: number;
  /** Which how-to page, while phase is "howto". */
  page: number;
  mood: Mood;
  /** Seconds left on the current reaction. */
  moodT: number;
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
  barback: { t: number; running: boolean };
  shake: number;
  recentOrders: number[];
  recentGuests: number[];
  /** True once onGameOver has fired, so a run can only be reported once. */
  reported: boolean;
}

/**
 * Put a reaction on the bartender's face.
 *
 * Louder reactions interrupt quieter ones, never the other way round: a break
 * that also poured the guest's shot should leave him cheering, not grinning,
 * whichever of the two the engine reported first.
 */
function setMood(g: Game, mood: Mood) {
  if (g.moodT > 0 && MOOD_RANK[mood] < MOOD_RANK[g.mood]) return;
  g.mood = mood;
  g.moodT = MOOD_HOLD[mood];
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
      setMood(g, "scared");
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

  // The opening deal cascades but pays nothing, and the bartender must not
  // react to it — he was grinning at the board before the player had touched it.
  if (!step.counted) return;
  setMood(g, step.recipeHit ? "celebrating" : "happy");
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
  if (step.spawns.length) startBarBack(g);
}

// ─── The bar back ────────────────────────────────────────────────────────────

/**
 * Send the bar back across the bar.
 *
 * Cosmetic from top to bottom: nothing waits for him and no bottle on the board
 * is a bottle he threw. He exists because a board that silently refills from
 * nowhere feels like a spreadsheet, and one that gets restocked by somebody
 * running past feels like a bar.
 *
 * The throwing is drawn INTO his sheet, so there is nothing to spawn here — a
 * separate particle system on top of it would have him throwing two bottles for
 * every one he picks up.
 */
function startBarBack(g: Game) {
  if (g.barback.running) return;
  g.barback.running = true;
  g.barback.t = 0;
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

  if (g.moodT > 0) {
    g.moodT -= dt;
    if (g.moodT <= 0) g.mood = "concentrating";
  }

  // Bar back
  const bb = g.barback;
  if (bb.running) {
    bb.t += dt;
    if (bb.t > BARBACK_RUN) {
      bb.running = false;
      bb.t = 0;
    }
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
  // No background panel: the bartender stands behind these readouts and would
  // be erased by one. Everything here is keylined instead, which is how a
  // cabinet has always put bright type over a busy picture.
  const y = layout.backbarY - HUD_CONTENT;
  const box = bartenderBox(layout);
  const label = (text: string, x: number, ly: number, color: string, scale = 1, align: "left" | "right" | "center" = "left") =>
    drawTextMarquee(ctx, text, x, ly, color, scale, align, C.black);

  label(`STAGE ${g.stageNo}`, 16, y, C.dim);

  // Swipes: the largest number on the screen, because it is the clock.
  const low = g.state.swipesLeft <= 5;
  label(String(g.state.swipesLeft), 16, y + 10, low ? C.hot : C.white, 3);
  label("SWIPES", 16, y + 34, low ? C.hot : C.dim);

  // What the guest ordered, one chip per bottle, low enough on the right to
  // clear the cabinet's exit button on the shortest screen.
  const chipW = 42;
  const chips = g.rules.targets.length;
  const startX = W - 16 - chips * chipW;
  label("CLEAR TO ADVANCE", W - 16, y + 20, C.dim, 1, "right");
  g.rules.targets.forEach((target, i) => {
    const cx = startX + i * chipW + chipW / 2;
    const done = g.state.got[i] >= target.need;
    drawBottle(ctx, target.kind, cx, y + 40, 22, { alpha: done ? 0.4 : 1 });
    label(done ? "OK" : `${g.state.got[i]}/${target.need}`, cx, y + 53, done ? C.good : C.bone, 1, "center");
  });

  // The score drops to small lettering rather than running under the bartender.
  const score = String(g.total + g.state.score);
  label("SCORE", 16, y + 46, C.dim);
  const scoreScale = 52 + textWidth(score, 2) < box.left - 6 ? 2 : 1;
  label(score, 52, y + (scoreScale === 2 ? 44 : 46), C.brass, scoreScale);

  // One bar for the order as a whole. The chips answer "how am I doing on Gin";
  // this answers "am I going to make it", which is the question actually being
  // asked every few seconds.
  //
  // Pinned to the very top edge. It used to sit at the foot of the HUD, which
  // is exactly the height the bartender's chest reaches now that he is centred
  // and full size — so a progress meter ran straight through him, and neither
  // he nor it read properly. Up here nothing crosses it, and it clears the
  // cabinet's exit button, which starts a few pixels lower.
  const need = g.rules.targets.reduce((s, t) => s + t.need, 0);
  const got = g.rules.targets.reduce((s, t, i) => s + Math.min(g.state.got[i], t.need), 0);
  fillRect(ctx, 0, 0, W, 4, C.well);
  fillRect(ctx, 0, 0, Math.round((W * got) / Math.max(1, need)), 4, C.good);
}

/**
 * The widest the bartender may be, in logical pixels.
 *
 * The only limit on him. He is cut off by the board's top edge and rises to
 * fill everything above it, so on a tall phone the height alone would make him
 * more than half the screen across — at which point the readouts are sitting on
 * his shoulders rather than beside him. Capping the WIDTH keeps him large
 * without letting him take over the whole bar.
 */
const BARTENDER_MAX_W = 122;

/**
 * Where he stands: torso cut off by the top of the grid, centred, filling
 * everything above it.
 *
 * There used to be a drawn shelf between him and the board, with the bar back
 * running along it. Losing it gave him the whole upper third and let him be
 * nearly twice the size — the difference between a decorative sprite and a
 * character whose face can be read without looking away from the board.
 */
function bartenderBox(layout: Layout) {
  // 0.61 is the moods' own aspect; all four are cut from one frame, so one
  // number covers the set.
  const h = Math.min(layout.boardY - 10, BARTENDER_MAX_W / 0.61);
  const w = h * 0.61;
  return { cx: W / 2, groundY: layout.boardY, h, left: W / 2 - w / 2, right: W / 2 + w / 2 };
}

function drawBartender(ctx: CanvasRenderingContext2D, g: Game, layout: Layout) {
  const box = bartenderBox(layout);
  drawMood(ctx, g.mood, box.cx, box.groundY, box.h);
}

/**
 * The bar back, crossing the play field.
 *
 * He used to run along a drawn shelf above the board. That shelf is gone — the
 * bartender fills the space now, and two characters sharing it left neither of
 * them room — so the runner comes through the middle of the screen instead,
 * where there is nothing to crowd and the bottles he throws arc up out of the
 * board toward the bar.
 *
 * Cosmetic from top to bottom: nothing waits for him and no bottle on the board
 * is one he threw. He exists because a board that silently refills from nowhere
 * feels like a spreadsheet, and one that gets restocked by somebody running
 * past feels like a bar.
 */
function drawBarBackRunner(ctx: CanvasRenderingContext2D, g: Game, h: number) {
  if (!g.barback.running) return;
  const pass = barBackPass(g.barback.t);
  drawBarBack(ctx, pass.x, Math.round(h * 0.5), BARBACK_BODY_H, Math.floor(g.barback.t * 14), pass.flip);
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

interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * The window every story panel is shown through.
 *
 * A FIXED shape, sized to the screen and centred, with black all around it.
 * Fitting each panel to the screen instead meant every one was scaled
 * differently — one edge to edge, the next letterboxed by a different amount —
 * so the cast appeared at a different size every time and the whole sequence
 * looked unsteady. A frame that never moves makes them a set.
 *
 * The aspect is the panels' own, so the picture very nearly fills the window
 * and what little slack there is falls inside the border rather than reading as
 * a mistake.
 */
const FRAME_ASPECT = 0.465;
const FRAME_BORDER = 3;

function panelFrame(h: number): Rect {
  const maxW = W - 26;
  // Room above for the order meter, and below for the tap hint.
  const maxH = h - 44;
  let fw = maxW;
  let fh = fw / FRAME_ASPECT;
  if (fh > maxH) {
    fh = maxH;
    fw = fh * FRAME_ASPECT;
  }
  return {
    x: Math.round((W - fw) / 2),
    y: Math.round((h - fh) / 2) - 6,
    w: Math.round(fw),
    h: Math.round(fh),
  };
}

interface PanelDraw {
  frame: Rect;
  /** Where the artwork landed inside the frame, or null until it loads. */
  image: Rect | null;
}

/**
 * Draw a story panel inside the frame, whole.
 *
 * Contained, never cropped: covering the frame and cutting the overflow took
 * the top off the speech bubble on the taller panels, so a guest could be
 * halfway through a line the player never got to read. The dialogue is the
 * entire point of these screens.
 */
function drawPanel(ctx: CanvasRenderingContext2D, url: string, h: number): PanelDraw {
  fillRect(ctx, 0, 0, W, h, C.black);
  const frame = panelFrame(h);

  fillRect(ctx, frame.x - FRAME_BORDER, frame.y - FRAME_BORDER,
    frame.w + FRAME_BORDER * 2, frame.h + FRAME_BORDER * 2, C.panelLip);
  fillRect(ctx, frame.x - 1, frame.y - 1, frame.w + 2, frame.h + 2, C.black);
  fillRect(ctx, frame.x, frame.y, frame.w, frame.h, C.night);

  const img = getImage(url);
  if (!img || !img.naturalWidth) return { frame, image: null };

  const scale = Math.min(frame.w / img.naturalWidth, frame.h / img.naturalHeight);
  const dw = img.naturalWidth * scale;
  const dh = img.naturalHeight * scale;
  const dx = frame.x + (frame.w - dw) / 2;
  const dy = frame.y + (frame.h - dh) / 2;

  ctx.save();
  ctx.beginPath();
  ctx.rect(frame.x, frame.y, frame.w, frame.h);
  ctx.clip();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(img, dx, dy, dw, dh);
  ctx.imageSmoothingEnabled = false;
  ctx.restore();

  return { frame, image: { x: dx, y: dy, w: dw, h: dh } };
}

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
  panel: PanelDraw
) {
  const art = panel.image;
  const box = art
    ? {
        x: art.x + rect.x * art.w,
        y: art.y + rect.y * art.h,
        w: rect.w * art.w,
        h: rect.h * art.h,
      }
    : {
        x: panel.frame.x + 12,
        y: panel.frame.y + panel.frame.h * 0.06,
        w: panel.frame.w - 24,
        h: panel.frame.h * 0.17,
      };

  if (!art) {
    // No art yet — draw the bubble too, so the line is never floating in space.
    fillRect(ctx, box.x - 8, box.y - 8, box.w + 16, box.h + 16, C.black);
    fillRect(ctx, box.x - 6, box.y - 6, box.w + 12, box.h + 12, C.bone);
  }

  for (const scale of [2, 1]) {
    const lines = wrapLines(text, box.w, scale);
    const total = lines.length * lineHeight(scale);
    if (total > box.h && scale > 1) continue;
    let ty = box.y + Math.max(0, (box.h - total) / 2);
    for (const line of lines) {
      drawText(ctx, line, box.x + box.w / 2, ty, C.black, scale, "center");
      ty += lineHeight(scale);
    }
    return;
  }
}

/** A band across the bottom of a story panel, for anything that is not dialogue. */
function drawFooter(ctx: CanvasRenderingContext2D, lines: string[], frame: Rect, accent: string) {
  // Inside the frame, along its bottom edge: outside it the band would float on
  // the black surround and read as a second, unrelated panel.
  const boxH = 22 + lines.length * 12;
  const y = frame.y + frame.h - boxH;
  ctx.globalAlpha = 0.86;
  fillRect(ctx, frame.x, y, frame.w, boxH, C.black);
  ctx.globalAlpha = 1;
  fillRect(ctx, frame.x, y, frame.w, 1, accent);
  lines.forEach((line, i) => {
    drawText(ctx, line, W / 2, y + 11 + i * 12, i === 0 ? accent : C.bone, 1, "center");
  });
}

/** The recipe, laid out for a story screen rather than the HUD. */
function drawRecipeCard(ctx: CanvasRenderingContext2D, g: Game, frame: Rect) {
  const cardH = 52;
  const y = frame.y + frame.h - cardH;
  ctx.globalAlpha = 0.88;
  fillRect(ctx, frame.x, y, frame.w, cardH, C.black);
  ctx.globalAlpha = 1;
  fillRect(ctx, frame.x, y, frame.w, 1, C.brass);
  drawText(ctx, g.rules.shotName.toUpperCase(), W / 2, y + 6, C.brass, 1, "center");
  const step = 32;
  const startX = W / 2 - ((g.rules.recipe.length - 1) * step) / 2;
  g.rules.recipe.forEach((kind, i) => {
    drawBottle(ctx, kind, startX + i * step, y + 32, 26);
  });
}

// ─── Front page, how to play, and the round's recipe ─────────────────────────

/** Where the two buttons on the marquee screen live, in logical pixels. */
function introButtons(h: number) {
  const w = W - 56;
  const x = 28;
  return {
    start: { x, y: Math.round(h * 0.60), w, h: 46 },
    scores: { x, y: Math.round(h * 0.60) + 58, w, h: 40 },
  };
}

function inside(r: { x: number; y: number; w: number; h: number }, x: number, y: number) {
  return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h;
}

function drawButton(
  ctx: CanvasRenderingContext2D,
  r: { x: number; y: number; w: number; h: number },
  label: string,
  fill: string,
  text: string,
  t: number,
  pulse = false
) {
  const lift = pulse ? Math.round(Math.sin(t * 3.4) * 1.2) : 0;
  fillRect(ctx, r.x, r.y + 3 + lift, r.w, r.h, C.black);
  fillRect(ctx, r.x, r.y + lift, r.w, r.h, fill);
  fillRect(ctx, r.x, r.y + lift, r.w, 2, "rgba(255,255,255,0.35)");
  drawText(ctx, label, r.x + r.w / 2, r.y + lift + Math.round(r.h / 2) - 4, text, 1, "center");
}

function drawIntro(
  ctx: CanvasRenderingContext2D,
  h: number,
  t: number,
  withScores: boolean
) {
  fillRect(ctx, 0, 0, W, h, C.black);

  // The marquee, as wide as the screen allows.
  const logo = getImage(logoUrl());
  if (logo && logo.naturalWidth) {
    const lw = W - 20;
    const lh = (logo.naturalHeight / logo.naturalWidth) * lw;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(logo, 10, Math.round(h * 0.30 - lh / 2), lw, Math.round(lh));
    ctx.imageSmoothingEnabled = false;
  } else {
    drawTextMarquee(ctx, "LET'S DO", W / 2, Math.round(h * 0.24), C.brass, 3, "center", C.black);
    drawTextMarquee(ctx, "SHOTS!", W / 2, Math.round(h * 0.24) + 26, C.brass, 4, "center", C.black);
  }

  const b = introButtons(h);
  drawButton(ctx, b.start, "TAP TO START", C.brass, C.black, t, true);
  if (withScores) drawButton(ctx, b.scores, "HIGH SCORES", C.panelLip, C.bone, t);

  drawText(ctx, "COMMON GOOD COCKTAIL HOUSE", W / 2, h - 16, C.dim, 1, "center");
}

/**
 * One page of how to play.
 *
 * Each page shows the rule being described rather than only stating it — real
 * bottle sprites, laid out the way they would sit on the board. Somebody
 * standing at a bar reads three lines of instructions at most, and a picture of
 * four bourbons going off is worth all three of them.
 */
function drawHowTo(ctx: CanvasRenderingContext2D, page: number, h: number, t: number) {
  fillRect(ctx, 0, 0, W, h, C.night);

  const titles = ["THE MOVE", "BIGGER BREAKS", "THE BONUS SHOT"];
  drawText(ctx, `${page + 1} OF ${HOWTO_PAGES}`, W / 2, Math.round(h * 0.11), C.dim, 1, "center");
  drawTextMarquee(ctx, titles[page], W / 2, Math.round(h * 0.16), C.brass, 2, "center", C.black);

  // The rule is DEMONSTRATED inside a framed panel, with the words underneath.
  // Somebody standing at a bar reads three lines of instructions at most, and a
  // picture of four scotches going off is worth all three of them. The panel
  // also gives the page a middle: loose bottles floating on the background left
  // the screen looking like three islands with holes between them.
  const cy = Math.round(h * 0.44);
  const panelTop = cy - 66;
  fillRect(ctx, 20, panelTop, W - 40, 132, C.panel);
  fillRect(ctx, 20, panelTop, W - 40, 1, C.panelLip);
  fillRect(ctx, 20, panelTop + 131, W - 40, 1, C.panelLip);

  const cell = 34;
  const row = (kinds: CellKind[], y: number, lit = -1) => {
    const startX = W / 2 - ((kinds.length - 1) * cell) / 2;
    kinds.forEach((kind, i) => {
      const cx = startX + i * cell;
      const seat = kind === "coffee" ? C.brassDark : BOTTLES[kind].shade;
      fillRect(ctx, cx - cell / 2 + 2, y - cell / 2 + 2, cell - 4, cell - 4, seat);
      drawBottle(ctx, kind, cx, y, cell * 0.86);
      // After the bottle, not before: drawn underneath, the sprite covered it.
      if (i === lit) {
        fillRect(ctx, cx - cell / 2 + 2, y - cell / 2 + 2, cell - 4, 2, C.good);
        fillRect(ctx, cx - cell / 2 + 2, y + cell / 2 - 4, cell - 4, 2, C.good);
      }
    });
    return startX;
  };

  /** A two-headed arrow, for the pair being swapped. */
  const swapArrow = (fromX: number, toX: number, y: number) => {
    fillRect(ctx, fromX, y, toX - fromX, 2, C.brass);
    for (let i = 0; i < 4; i++) {
      fillRect(ctx, fromX + i, y - i, 1, 1 + i * 2, C.brass);
      fillRect(ctx, toX - 1 - i, y - i, 1, 1 + i * 2, C.brass);
    }
  };

  // The words the owner wrote, verbatim. They are long — longer than a line —
  // so the block below wraps them rather than the page assuming a line count.
  let copy: string[];
  if (page === 0) {
    const startX = row(["bourbon", "gin", "gin", "malort"], cy - 42);
    swapArrow(startX - 7, startX + cell + 7, cy - 20);
    row(["gin", "gin", "gin", "malort"], cy + 8, 0);
    drawText(ctx, "THREE IN A ROW BREAKS", W / 2, cy + 44, C.good, 1, "center");
    copy = HOWTO_COPY[0];
  } else if (page === 1) {
    row(["scotch", "scotch", "scotch", "scotch"], cy - 36);
    row(["scotch", "scotch", "scotch", "scotch", "coffee"], cy + 18);
    copy = HOWTO_COPY[1];
  } else {
    // Centred in the panel: with the captions gone the copy carries the page,
    // and content pinned to the top left the frame looking half empty.
    row(["bourbon", "gin", "tequila", "scotch"], cy - 24);
    drawTextMarquee(ctx, "X2", W / 2, cy + 14, C.brass, 2, "center", C.black);
    copy = HOWTO_COPY[2];
  }

  // Wrapped, and each paragraph separated by a blank line.
  let ty = cy + 84;
  for (const paragraph of copy) {
    for (const line of wrapLines(paragraph, W - 44, 1)) {
      drawText(ctx, line, W / 2, ty, C.bone, 1, "center");
      ty += lineHeight(1);
    }
    ty += PARAGRAPH_GAP;
  }

  drawTapHint(ctx, page === HOWTO_PAGES - 1 ? "TAP TO POUR" : "TAP TO CONTINUE", h, t);
}

/** The round's shot, full screen, immediately before the board comes up. */
function drawRecipeScreen(ctx: CanvasRenderingContext2D, g: Game, h: number, t: number) {
  fillRect(ctx, 0, 0, W, h, C.night);

  drawText(ctx, `STAGE ${g.stageNo}`, W / 2, Math.round(h * 0.12), C.dim, 1, "center");
  drawText(ctx, "BONUS SHOT", W / 2, Math.round(h * 0.17), C.dim, 1, "center");
  drawTextMarquee(ctx, g.rules.shotName.toUpperCase(), W / 2, Math.round(h * 0.22), C.brass, 2, "center", C.black);

  // The pour order, big.
  const y = Math.round(h * 0.38);
  const step = 46;
  const startX = W / 2 - ((g.rules.recipe.length - 1) * step) / 2;
  g.rules.recipe.forEach((kind, i) => {
    const cx = startX + i * step;
    fillRect(ctx, cx - 19, y - 22, 38, 44, C.panel);
    fillRect(ctx, cx - 19, y + 19, 38, 3, BOTTLES[kind].color);
    drawBottle(ctx, kind, cx, y - 2, 36);
    drawText(ctx, String(i + 1), cx, y + 26, C.dim, 1, "center");
    if (i < g.rules.recipe.length - 1) drawText(ctx, ">", cx + step / 2, y - 5, C.dim, 1, "center");
  });

  drawText(ctx, "LINE THESE UP IN ORDER", W / 2, Math.round(h * 0.52), C.bone, 1, "center");
  drawText(ctx, "FOR DOUBLE SCORE", W / 2, Math.round(h * 0.52) + 12, C.brass, 1, "center");

  // And what the guest actually ordered, so the goal is on screen too. Same
  // words as the HUD uses over the same bottles, so the screen is teaching the
  // thing the player is about to be looking at all round.
  fillRect(ctx, 20, Math.round(h * 0.63), W - 40, 1, C.panelLip);
  drawText(ctx, "CLEAR TO ADVANCE", W / 2, Math.round(h * 0.66), C.dim, 1, "center");
  const oy = Math.round(h * 0.74);
  const ostep = 54;
  const ox = W / 2 - ((g.rules.targets.length - 1) * ostep) / 2;
  g.rules.targets.forEach((target, i) => {
    const cx = ox + i * ostep;
    drawBottle(ctx, target.kind, cx, oy, 28);
    drawText(ctx, String(target.need), cx, oy + 18, C.bone, 1, "center");
  });
  drawText(ctx, `${g.state.swipesLeft} SWIPES`, W / 2, Math.round(h * 0.86), C.white, 2, "center");

  drawTapHint(ctx, "TAP TO START ROUND", h, t);
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

export default function LetsDoShots({ onGameOver, onShowScores, demo = false }: ArcadeGameProps) {
  const gameRef = useRef<Game | null>(null);
  const overRef = useRef(onGameOver);
  overRef.current = onGameOver;
  const botTimer = useRef(0);

  const newRun = useCallback((): Game => {
    const rng = makeRng((Date.now() ^ Math.floor(Math.random() * 0x7fffffff)) >>> 0);
    const g: Game = {
      phase: "intro",
      phaseT: 0,
      page: 0,
      mood: "concentrating",
      moodT: 0,
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
      barback: { t: 0, running: false },
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
    // The marquee is the first thing on screen and the moods are needed the
    // moment play starts, so both go out ahead of the panels.
    prefetch([
      logoUrl(), ...HOWTO_ART, ...MOODS_TO_PREFETCH,
      bartenderUrl("ask"), bartenderUrl("go"),
    ]);
  }, [newRun]);

  // ── Advancing the story ──────────────────────────────────────────────────
  const advance = useCallback(() => {
    const g = gameRef.current;
    if (!g) return;
    switch (g.phase) {
      case "intro":
        g.phase = "howto";
        g.page = 0;
        g.phaseT = 0;
        break;
      case "howto":
        if (g.page < HOWTO_PAGES - 1) {
          g.page++;
          g.phaseT = 0;
        } else {
          g.phase = "ask";
          g.phaseT = 0;
        }
        break;
      case "ask":
        g.phase = "order";
        g.phaseT = 0;
        break;
      case "order":
        g.phase = "go";
        g.phaseT = 0;
        break;
      case "go":
        g.phase = "recipe";
        g.phaseT = 0;
        break;
      case "recipe":
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
        //
        // Straight back to the recipe, skipping the three intro panels: they
        // have just watched the guest order this and they are trying again, not
        // starting over.
        startStage(g, g.stageNo);
        g.phase = "recipe";
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
      if (g.phase === "intro") {
        const b = introButtons(h);
        if (onShowScores && inside(b.scores, x, y)) {
          onShowScores();
          return;
        }
        // Anywhere else on the marquee starts the game. Only the scores button
        // is a target you have to hit — missing "start" on a front page is a
        // guest deciding the game is broken.
        advance();
        return;
      }
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
    [advance, demo, onShowScores]
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
        drawBartender(ctx, g, layout);
        drawHud(ctx, g, layout);
        drawBoard(ctx, g, layout, t);
        // In FRONT of the board: he runs through the play field, not behind it.
        drawBarBackRunner(ctx, g, h);
        drawRecipe(ctx, g, layout);
        ctx.restore();
        return;
      }

      // ── Story screens ─────────────────────────────────────────────────────
      const hold = demo ? DEMO_HOLD : undefined;

      if (g.phase === "intro") {
        drawIntro(ctx, h, t, Boolean(onShowScores));
        // Attract mode walks itself in; a real guest decides when to start.
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

      if (g.phase === "howto") {
        drawHowTo(ctx, g.page, h, t);
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

      if (g.phase === "recipe") {
        drawRecipeScreen(ctx, g, h, t);
        // Attract mode still walks itself through; a real player starts when
        // they have read it.
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

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
        drawBubble(ctx, g.rules.quip, g.guest.order, panel);
        drawRecipeCard(ctx, g, panel.frame);
        if (g.phaseT > (hold ?? PANEL_HOLD.order)) advance();
        return;
      }

      if (g.phase === "won") {
        const panel = drawPanel(ctx, guestUrl(g.guest.slug, "happy"), h);
        drawBubble(ctx, "Bottoms up!", g.guest.happy, panel);
        drawFooter(ctx, [
          `STAGE ${g.stageNo} CLEARED`,
          `ROUND ${g.state.score}`,
          `TOTAL ${g.total}`,
        ], panel.frame, C.good);

        drawTapHint(ctx, "TAP FOR NEXT ROUND", h, t);
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

      if (g.phase === "lost") {
        const panel = drawPanel(ctx, guestUrl(g.guest.slug, "mad"), h);
        drawBubble(ctx, "Where is my shot??", g.guest.mad, panel);
        drawFooter(ctx, [
          `CONTINUES ${g.continues}`,
          "TAP TO POUR IT AGAIN",
        ], panel.frame, C.hot);
        if (demo && g.phaseT > DEMO_HOLD) advance();
        return;
      }

      // Game over
      const panel = drawPanel(ctx, guestUrl(g.guest.slug, "mad"), h);
      drawBubble(ctx, "Where is my shot??", g.guest.mad, panel);
      drawFooter(ctx, ["GAME OVER", `SCORE ${g.total}`], panel.frame, C.hot);
      drawTapHint(ctx, demo ? "" : "TAP TO FINISH", h, t);
      if (demo && g.phaseT > DEMO_HOLD * 2) advance();
    },
    [advance, demo, onShowScores]
  );

  return <ShotsCanvas onFrame={onFrame} running onSwipe={onSwipe} onTap={onTap} />;
}
