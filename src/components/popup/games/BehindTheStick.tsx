"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeCanvas from "./ArcadeCanvas";
import CRTScreen from "./CRTScreen";
import { ArcadeButton, useArcadeKeys } from "./controls";
import {
  blink,
  clamp,
  clear,
  drawSprite,
  drawText,
  drawTextMarquee,
  GAME_W,
  meter,
  outline,
  P,
  pad,
  rect,
  type Sprite,
} from "./arcade";
import {
  applyStirAngle,
  currentBpm,
  currentRpm,
  freshState,
  GRACE_SECONDS,
  GOOD_HALF,
  MAX_STRIKES,
  NOTES_PER_ROUND,
  RAIL_H,
  RAIL_Y,
  SHAKE_SECONDS,
  STIR_SECONDS,
  update,
  WINDOW_X,
  type Mood,
  type Phase,
  type State,
} from "./behindTheStickCore";
import {
  ARM,
  BARTENDER_COLORS,
  BARTENDER_HEADS,
  BARTENDER_TORSO,
  GUEST,
  GUEST_ANGRY,
  guestColors,
  SHELF_BOTTLE,
  shelfBottleColors,
  TIN,
  TIN_COLORS,
} from "./sprites";
import type { ArcadeGameProps } from "./registry";

// ═══════════════════════════════════════════════════════════════════════════
// BEHIND THE STICK — the presentation layer.
//
// Ingredients slide along the rail; hit the matching button while one sits in
// the window and it goes in the tin. Miss and it hits the floor. Every ten
// pours you shake or stir it out, faster each time.
//
// All the rules live in behindTheStickCore.ts. This file draws and listens.
// ═══════════════════════════════════════════════════════════════════════════

// ─── Ingredient art ──────────────────────────────────────────────────────────

const BOTTLE: Sprite = [
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "....ggg....",
  "...ggggg...",
  "..ggggggg..",
  "..ggggggg..",
  "..glllllg..",
  "..glllllg..",
  "..glllllg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..ggggggg..",
  "..bbbbbbb..",
];

const CITRUS: Sprite = [
  "...........",
  "...fffff...",
  "..fffffff..",
  ".fffffffff.",
  ".ffffwffff.",
  "ffffwwwffff",
  "fffwwwwwfff",
  "ffwwwwwwwff",
  "fffwwwwwfff",
  "ffffwwwffff",
  ".ffffwffff.",
  ".fffffffff.",
  "..fffffff..",
  "...fffff...",
  "...........",
];

const JAR: Sprite = [
  "...ddd.....",
  "....d......",
  "....d......",
  "..hhhhhhh..",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  ".hhhhhhhhh.",
  "..hhhhhhh..",
  "..bbbbbbb..",
  "...........",
];

const DASHER: Sprite = [
  "...........",
  "....ccc....",
  "....ccc....",
  "....ggg....",
  "...ggggg...",
  "...ggggg...",
  "...glllg...",
  "...glllg...",
  "...glllg...",
  "...ggggg...",
  "...ggggg...",
  "...ggggg...",
  "...bbbbb...",
  "...........",
  "...........",
];

interface Ingredient {
  key: string;
  label: string;
  /** Signature colour — the button and the note share it, so matching is fast. */
  color: string;
  sprite: Sprite;
  colors: Record<string, string>;
}

/**
 * Seven ingredients, each a distinct colour AND a distinct silhouette. Colour
 * alone isn't enough at speed on a small screen, and shape alone isn't either —
 * you need both to read a note in a fifth of a second.
 */
const INGREDIENTS: Ingredient[] = [
  {
    key: "whiskey",
    label: "Whiskey",
    color: P.amber,
    sprite: BOTTLE,
    colors: { c: P.yellow, g: P.amber, l: P.bone, b: P.brown },
  },
  {
    key: "gin",
    label: "Gin",
    color: P.cyan,
    sprite: BOTTLE,
    colors: { c: P.white, g: P.cyan, l: P.white, b: P.teal },
  },
  {
    key: "tequila",
    label: "Tequila",
    color: P.bone,
    sprite: BOTTLE,
    colors: { c: P.grey, g: P.bone, l: P.lime, b: P.grey },
  },
  {
    key: "lemon",
    label: "Lemon",
    color: P.yellow,
    sprite: CITRUS,
    colors: { f: P.yellow, w: P.bone },
  },
  { key: "lime", label: "Lime", color: P.green, sprite: CITRUS, colors: { f: P.green, w: P.lime } },
  {
    key: "honey",
    label: "Honey",
    color: P.orange,
    sprite: JAR,
    colors: { d: P.tan, h: P.orange, b: P.brown },
  },
  {
    key: "bitters",
    label: "Bitters",
    color: P.red,
    sprite: DASHER,
    colors: { c: P.bone, g: P.red, l: P.bone, b: P.crimson },
  },
];

const ING_BY_KEY = new Map(INGREDIENTS.map((i) => [i.key, i]));
const colorFor = (key: string) => ING_BY_KEY.get(key)?.color ?? P.white;

// ─── Scene ───────────────────────────────────────────────────────────────────

function drawBackbar(ctx: CanvasRenderingContext2D, t: number) {
  clear(ctx, "#0C0818");

  // Back wall, with a warm pool of light behind the bartender
  rect(ctx, 0, 14, GAME_W, 130, "#1B1030");
  for (let i = 0; i < 5; i++) {
    rect(ctx, 60 + i * 2, 14, 104 - i * 4, 130, `rgba(90,40,120,${0.10 - i * 0.015})`);
  }

  // Three shelves of stock, each bottle outlined so it reads at this size
  const HUES: [string, string][] = [
    [P.red, "#8E1410"],
    [P.amber, "#A86500"],
    [P.green, "#00701F"],
    [P.cyan, "#1E8F94"],
    [P.purple, "#5A188A"],
    [P.orange, "#A84D00"],
  ];
  for (let s = 0; s < 3; s++) {
    const y = 36 + s * 30;
    for (let b = 0; b < 13; b++) {
      const bx = 6 + b * 17 + (s % 2) * 5;
      if (bx > GAME_W - 10) continue;
      const [body, shade] = HUES[(b + s) % HUES.length];
      drawSprite(ctx, SHELF_BOTTLE, bx, y - 12, shelfBottleColors(body, shade), 1);
    }
    // Shelf plank with a lit front edge
    rect(ctx, 4, y, GAME_W - 8, 3, P.wood);
    rect(ctx, 4, y, GAME_W - 8, 1, P.tan);
    rect(ctx, 4, y + 3, GAME_W - 8, 1, "#5A3010");
  }

  // Back-bar mirror, framed — fills the wall behind the bartender
  rect(ctx, 62, 108, 100, 36, "#3A1C06");
  rect(ctx, 64, 110, 96, 32, "#2A1B4A");
  for (let i = 0; i < 4; i++) {
    rect(ctx, 68 + i * 3, 112, 2, 28, `rgba(255,255,255,${0.05 - i * 0.01})`);
  }
  rect(ctx, 62, 108, 100, 1, P.tan);

  // Pendant lamps over the guest side, each throwing a cone of light
  for (const lx of [56, 168]) {
    rect(ctx, lx, 156, 1, 8, "#4A3010");
    rect(ctx, lx - 5, 164, 11, 3, P.amber);
    rect(ctx, lx - 4, 165, 9, 1, P.yellow);
    for (let i = 0; i < 5; i++) {
      rect(ctx, lx - 6 - i * 3, 167 + i * 8, 13 + i * 6, 8, `rgba(255,160,0,${0.05 - i * 0.008})`);
    }
  }

  // Bar top
  rect(ctx, 0, 144, GAME_W, 8, P.wood);
  rect(ctx, 0, 144, GAME_W, 1, P.tan);
  rect(ctx, 0, 152, GAME_W, 4, "#5A3010");

  // Neon sign, buzzing
  if (blink(t, 0.7)) {
    drawTextMarquee(ctx, "OPEN", 14, 20, P.magenta, 1, "left", "#3A0030");
  }
}

/** The public side of the bar: rail, panelled front, brass foot rail. */
function drawBarFront(ctx: CanvasRenderingContext2D) {
  // Bar rail the guests lean on
  rect(ctx, 0, 214, GAME_W, 5, P.wood);
  rect(ctx, 0, 214, GAME_W, 1, P.tan);
  rect(ctx, 0, 219, GAME_W, 2, "#4A2808");

  // Panelled front
  rect(ctx, 0, 221, GAME_W, RAIL_Y - 221, "#5A3010");
  for (let i = 0; i < 6; i++) {
    const px = 6 + i * 36;
    rect(ctx, px, 225, 28, RAIL_Y - 231, "#6B3A14");
    rect(ctx, px, 225, 28, 1, "#8A5020");
    rect(ctx, px, RAIL_Y - 7, 28, 1, "#3A1C06");
  }
  // Brass foot rail catching the light
  rect(ctx, 0, RAIL_Y - 4, GAME_W, 2, P.amber);
  rect(ctx, 0, RAIL_Y - 4, GAME_W, 1, P.yellow);
}

/**
 * The bartender, assembled from parts: expression comes from the head sprite,
 * pose from where the arms are drawn.
 */
function drawBartender(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  mood: Mood,
  pose: "idle" | "shake" | "stir" | "serve",
  t: number,
  /**
   * Live shake input. `count` flips the tin over one tap at a time and `since`
   * is seconds since the last tap, so the sprite moves at exactly the rate the
   * player is tapping and settles when they stop. Absent outside the shake.
   */
  shake?: { count: number; since: number },
  /** Completed revolutions this stir, for the same reason as `shake`. */
  stir?: number
) {
  const C = BARTENDER_COLORS;
  // Sprite is 20 wide; torso sits 12 tall with the head's 14 above it.
  const x = cx - 10;
  const torsoY = baseY - 12;
  const headY = torsoY - 14;

  // Resting once the player has gone quiet for half a second, so a stalled
  // shake reads as stalled rather than carrying on without them.
  const resting = !shake || shake.since > 0.5;
  const shakeUp = !!shake && shake.count % 2 === 1;
  const bob = pose === "shake" && !resting ? (shakeUp ? -1 : 1) : 0;

  drawSprite(ctx, BARTENDER_HEADS[mood] ?? BARTENDER_HEADS.ok, x, headY + bob, C, 1);
  drawSprite(ctx, BARTENDER_TORSO, x, torsoY, C, 1);

  // Arms. 4 wide, 9 tall, hung off each shoulder.
  const armY = torsoY + 2;
  if (pose === "shake") {
    // Both arms up, tin overhead. The lift alternates on each tap, so the
    // tin visibly travels once per tap however fast or slow that is.
    const lift = resting ? 2 : shakeUp ? 0 : 4;
    drawSprite(ctx, ARM, x - 1, armY - 8 + lift, C, 1);
    drawSprite(ctx, ARM, x + 17, armY - 8 + lift, C, 1);
    drawSprite(ctx, TIN, cx - 6, headY - 16 + lift, TIN_COLORS, 1);
  } else if (pose === "stir") {
    // Sways once per half-turn the player actually makes, so a stalled hand
    // stalls the spoon — the same principle as the shake above.
    const sway = stir === undefined ? 0 : Math.floor(stir * 2) % 2 === 0 ? 0 : 2;
    drawSprite(ctx, ARM, x - 1, armY, C, 1);
    drawSprite(ctx, ARM, x + 15 + sway, armY - 4, C, 1);
    // Mixing glass on the bar, and the spoon in it
    rect(ctx, cx + 6, baseY - 14, 14, 15, "#100810");
    rect(ctx, cx + 7, baseY - 13, 12, 13, "#7FA8C0");
    rect(ctx, cx + 8, baseY - 9, 10, 8, P.amber);
    rect(ctx, cx + 12 + sway, baseY - 30, 2, 18, "#C8C8D0");
  } else if (pose === "serve") {
    drawSprite(ctx, ARM, x - 1, armY, C, 1);
    drawSprite(ctx, ARM, x + 17, armY + 3, C, 1);
  } else {
    drawSprite(ctx, ARM, x - 1, armY, C, 1);
    drawSprite(ctx, ARM, x + 17, armY, C, 1);
  }

  // Sweat beads once it's going badly
  if (mood === "worried" || mood === "panic") {
    const drop = Math.floor(t * 6) % 3;
    rect(ctx, x + 17, headY + 4 + drop * 3, 2, 3, P.cyan);
    if (mood === "panic") rect(ctx, x, headY + 6 + drop * 3, 2, 3, P.cyan);
  }
}

function drawTin(ctx: CanvasRenderingContext2D, x: number, y: number, fill: number) {
  drawSprite(ctx, TIN, x, y, TIN_COLORS, 1);
  // Contents rise as the round goes on
  const h = Math.round(clamp(fill, 0, 1) * 9);
  if (h > 0) rect(ctx, x + 2, y + 13 - h, 8, h, P.amber);
}

function drawGuest(
  ctx: CanvasRenderingContext2D,
  cx: number,
  baseY: number,
  state: "wait" | "happy" | "angry",
  t: number,
  shirt: string,
  shirtShadow: string
) {
  const sprite = state === "angry" ? GUEST_ANGRY : GUEST;
  drawSprite(ctx, sprite, cx - 7, baseY - 16, guestColors(shirt, shirtShadow), 1);

  if (state === "angry" && blink(t, 6)) {
    // Shout lines
    rect(ctx, cx + 9, baseY - 15, 5, 1, P.yellow);
    rect(ctx, cx + 9, baseY - 11, 5, 1, P.yellow);
    rect(ctx, cx - 14, baseY - 15, 5, 1, P.yellow);
  }
  if (state === "happy") {
    // A finished drink in hand
    rect(ctx, cx + 8, baseY - 12, 7, 9, "#100810");
    rect(ctx, cx + 9, baseY - 11, 5, 7, P.cyan);
    rect(ctx, cx + 9, baseY - 9, 5, 4, P.amber);
  }
}

function drawRail(ctx: CanvasRenderingContext2D, st: State, t: number) {
  rect(ctx, 0, RAIL_Y, GAME_W, RAIL_H, "#101020");
  rect(ctx, 0, RAIL_Y, GAME_W, 1, P.slate);
  rect(ctx, 0, RAIL_Y + RAIL_H - 1, GAME_W, 1, P.slate);

  const wx = WINDOW_X - GOOD_HALF - 2;
  const ww = (GOOD_HALF + 2) * 2;
  rect(ctx, wx, RAIL_Y + 1, ww, RAIL_H - 2, "#182848");
  outline(ctx, wx, RAIL_Y + 1, ww, RAIL_H - 2, blink(t, 3) ? P.cyan : P.teal);

  for (const n of st.notes) {
    if (n.judged) continue;
    const ing = ING_BY_KEY.get(n.ing);
    if (!ing) continue;
    drawSprite(ctx, ing.sprite, Math.round(n.x - 5), RAIL_Y + 13, ing.colors, 1);
  }
}

function drawShake(ctx: CanvasRenderingContext2D, st: State) {
  const ok = currentBpm(st) >= st.target;
  const settling = st.phaseT <= GRACE_SECONDS;

  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");

  // One word for what to do. Deliberately no rate meter and no BPM readout:
  // the only thing a player can act on is "keep going" or "speed up", so a
  // number they have to interpret mid-shake is noise.
  drawTextMarquee(ctx, "SHAKE", 112, RAIL_Y + 2, P.yellow, 2, "center", P.black, "#8A6A00");

  // One word for how it is going, held back through the grace period so the
  // first thing a player sees is not a scolding.
  if (!settling) {
    drawTextMarquee(
      ctx,
      ok ? "GOOD!" : "GO FASTER!",
      112,
      96,
      ok ? P.lime : P.red,
      2,
      "center",
      P.black,
      ok ? "#00551C" : "#3A0000"
    );
  }

  // How much shaking is left, as a bar rather than a ticking number.
  const total = SHAKE_SECONDS + GRACE_SECONDS;
  meter(ctx, 52, RAIL_Y + 26, 120, 4, clamp((total - st.phaseT) / total, 0, 1), P.cyan);
}

function drawStir(ctx: CanvasRenderingContext2D, st: State) {
  const rpm = currentRpm(st);
  const ok = rpm >= st.target;

  const cx = 112;
  const cy = 108;
  const r = 34;
  for (let a = 0; a < 32; a++) {
    const ang = (a / 32) * Math.PI * 2;
    rect(ctx, cx + Math.cos(ang) * r - 1, cy + Math.sin(ang) * r - 1, 2, 2, P.slate);
  }
  const lead = st.lastAngle ?? -Math.PI / 2;
  rect(ctx, cx + Math.cos(lead) * r - 2, cy + Math.sin(lead) * r - 2, 5, 5, ok ? P.lime : P.yellow);
  drawText(ctx, "DRAG IN A CIRCLE", cx, cy - 4, P.white, 1, "center");

  // Same treatment as the shake: one instruction, one verdict, no readout.
  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawTextMarquee(ctx, "STIR", 112, RAIL_Y + 2, P.yellow, 2, "center", P.black, "#8A6A00");

  if (st.phaseT > GRACE_SECONDS) {
    drawTextMarquee(
      ctx,
      ok ? "GOOD!" : "GO FASTER!",
      112,
      60,
      ok ? P.lime : P.red,
      2,
      "center",
      P.black,
      ok ? "#00551C" : "#3A0000"
    );
  }

  const total = STIR_SECONDS + GRACE_SECONDS;
  meter(ctx, 52, RAIL_Y + 26, 120, 4, clamp((total - st.phaseT) / total, 0, 1), P.cyan);
}

function drawServe(ctx: CanvasRenderingContext2D, st: State) {
  const p = clamp(st.phaseT / 1.6, 0, 1);
  const x = 120 + p * 60;
  rect(ctx, x, 186, 8, 12, P.cyan);
  rect(ctx, x + 1, 188, 6, 4, P.amber);
  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawTextMarquee(ctx, "ORDER UP!", 112, RAIL_Y + 6, P.lime, 2, "center", P.black, P.forest);
}

function drawOver(ctx: CanvasRenderingContext2D, t: number) {
  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawTextMarquee(ctx, "GAME OVER", 112, RAIL_Y + 4, P.red, 2, "center", P.black, "#3A0000");
  if (blink(t, 2)) {
    drawTextMarquee(ctx, "WHERE IS MY DRINK!?", 112, RAIL_Y + 24, P.yellow, 1, "center");
  }
}

function drawHud(ctx: CanvasRenderingContext2D, st: State) {
  rect(ctx, 0, 0, GAME_W, 13, P.black);
  drawText(ctx, `SCORE ${pad(Math.max(0, st.score))}`, 4, 3, P.white, 1);
  drawText(ctx, `ROUND ${st.round}`, 148, 3, P.cyan, 1);
  for (let i = 0; i < MAX_STRIKES; i++) {
    drawText(ctx, i < st.strikes ? "X" : "-", 108 + i * 8, 3, i < st.strikes ? P.red : P.slate, 1);
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BehindTheStick({ onGameOver }: ArcadeGameProps) {
  const s = useRef<State>(freshState(colorFor));
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const endedRef = useRef(false);

  // Mirrored into React only so the right controls render — never per frame.
  const [uiPhase, setUiPhase] = useState<Phase>("ready");
  const uiPhaseRef = useRef<Phase>("ready");

  const press = useCallback((key: string) => {
    if (s.current.phase === "pour") s.current.presses.push(key);
  }, []);

  const tapShake = useCallback(() => {
    if (s.current.phase === "shake") s.current.shakeTaps++;
  }, []);

  const onStirMove = useCallback((e: React.PointerEvent) => {
    const st = s.current;
    if (st.phase !== "stir") return;
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    applyStirAngle(
      st,
      Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2))
    );
  }, []);

  const endStir = useCallback(() => {
    s.current.lastAngle = null;
  }, []);

  useArcadeKeys(
    true,
    (key) => {
      const st = s.current;
      if (st.phase === "shake" && (key === " " || key === "Spacebar")) {
        st.shakeTaps++;
        return;
      }
      const idx = "1234567".indexOf(key);
      if (idx >= 0) press(INGREDIENTS[idx].key);
    },
    () => {}
  );

  useEffect(() => {
    endedRef.current = false;
  }, []);

  // Icons built after mount: they need `document`, and generating them during
  // render would make the server HTML differ from the first client paint.
  const [iconUrls, setIconUrls] = useState<Record<string, string>>({});
  useEffect(() => {
    const out: Record<string, string> = {};
    for (const ing of INGREDIENTS) {
      const c = document.createElement("canvas");
      c.width = 11;
      c.height = 15;
      const cx = c.getContext("2d");
      if (!cx) continue;
      drawSprite(cx, ing.sprite, 0, 0, ing.colors, 1);
      out[ing.key] = c.toDataURL();
    }
    setIconUrls(out);
  }, []);

  const onFrame = useCallback(
    (ctx: CanvasRenderingContext2D, dt: number, t: number) => {
      const st = s.current;

      const { finished } = update(st, dt);
      if (finished && !endedRef.current) {
        endedRef.current = true;
        onGameOver(Math.max(0, Math.round(st.score)), {
          game: "behind-the-stick",
          rounds: st.round,
          poursServed: (st.round - 1) * NOTES_PER_ROUND + st.notesJudged,
          bestBpm: Math.round(st.bestBpm),
          bestRpm: Math.round(st.bestRpm),
        });
      }

      if (st.phase !== uiPhaseRef.current) {
        uiPhaseRef.current = st.phase;
        setUiPhase(st.phase);
      }

      // ── Draw ──────────────────────────────────────────────────────────
      drawBackbar(ctx, t);

      const pose =
        st.phase === "shake"
          ? "shake"
          : st.phase === "stir"
            ? "stir"
            : st.phase === "serve"
              ? "serve"
              : "idle";
      drawBartender(
        ctx,
        112,
        144,
        st.phase === "over" ? "panic" : st.mood,
        pose,
        t,
        st.phase === "shake"
          ? { count: st.shakeCount, since: st.phaseT - st.lastTapT }
          : undefined,
        st.phase === "stir" ? st.revs : undefined
      );
      if (pose === "idle") drawTin(ctx, 152, 130, st.tinFill);

      // A crowd, so the bar reads as busy rather than two people in a void
      drawGuest(ctx, 34, 214, st.phase === "over" ? "angry" : "wait", t, P.blue, "#16257A");
      drawGuest(ctx, 76, 214, st.phase === "over" ? "angry" : "wait", t, P.purple, "#4A1470");
      drawGuest(ctx, 132, 214, "wait", t, P.orange, "#8A3F00");
      drawGuest(
        ctx,
        190,
        214,
        st.phase === "serve" ? "happy" : st.phase === "over" ? "angry" : "wait",
        t,
        P.teal,
        "#005058"
      );
      drawBarFront(ctx);

      if (st.phase === "pour" || st.phase === "ready") drawRail(ctx, st, t);
      else if (st.phase === "shake") drawShake(ctx, st);
      else if (st.phase === "stir") drawStir(ctx, st);
      else if (st.phase === "serve") drawServe(ctx, st);
      else if (st.phase === "over") drawOver(ctx, t);

      for (const sp of st.splashes) {
        rect(ctx, sp.x - 3, sp.y, 6, 2, sp.color);
        rect(ctx, sp.x - 5, sp.y + 2, 2, 2, sp.color);
        rect(ctx, sp.x + 4, sp.y + 2, 2, 2, sp.color);
      }
      for (const p of st.pops) drawText(ctx, p.text, p.x, p.y, p.color, 1, "center");

      drawHud(ctx, st);

      if (st.bannerTimer > 0 && st.banner) {
        drawTextMarquee(ctx, st.banner, 112, 96, P.yellow, 2, "center", P.black, P.crimson);
      }
    },
    [onGameOver]
  );

  return (
    <div>
      <div
        ref={wrapRef}
        onPointerMove={onStirMove}
        onPointerDown={onStirMove}
        onPointerUp={endStir}
        onPointerCancel={endStir}
        onPointerLeave={endStir}
        style={{ touchAction: uiPhase === "stir" ? "none" : "auto" }}
      >
        <CRTScreen glow="#FFA000">
          <ArcadeCanvas onFrame={onFrame} running />
        </CRTScreen>
      </div>

      <div className="p-2 bg-black">
        {uiPhase === "shake" ? (
          // Deliberately not an ArcadeButton: this one is round, thumb-sized
          // and the only thing on screen, because it is the only input that
          // matters during a shake.
          <div className="h-24 flex items-center justify-center">
            <button
              type="button"
              aria-label="Shake"
              // pointerdown, not click — a rapid tap must register on contact.
              onPointerDown={(e) => {
                e.preventDefault();
                tapShake();
              }}
              style={{ background: P.lime, touchAction: "manipulation" }}
              className="select-none w-[84px] h-[84px] rounded-full border-[3px] border-black text-black text-[13px] font-black tracking-[0.12em] uppercase shadow-[0_5px_0_#00551C] active:translate-y-[4px] active:shadow-[0_1px_0_#00551C] transition-transform"
            >
              Shake
            </button>
          </div>
        ) : uiPhase === "stir" ? (
          <div className="h-24 flex items-center justify-center border-2 border-dashed border-white/25 text-center px-4">
            <p className="text-[11px] tracking-widest uppercase text-white/60 leading-relaxed">
              Drag your finger in circles
              <br />
              <span className="text-white/35">on the screen above</span>
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-1.5">
            {INGREDIENTS.map((ing) => (
              <ArcadeButton
                key={ing.key}
                ariaLabel={ing.label}
                color={ing.color}
                disabled={uiPhase !== "pour"}
                onPress={() => press(ing.key)}
                className="h-16"
                label={
                  <span className="flex flex-col items-center gap-1">
                    {/* Fixed box either way, so the icon appearing after mount
                        doesn't shift the button under the player's thumb. */}
                    <span style={{ width: 15, height: 20 }} className="flex items-center">
                      {iconUrls[ing.key] && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={iconUrls[ing.key]}
                          alt=""
                          width={11}
                          height={15}
                          style={{ imageRendering: "pixelated", width: 15, height: 20 }}
                        />
                      )}
                    </span>
                    <span className="text-[8px] tracking-wider">{ing.label.toUpperCase()}</span>
                  </span>
                }
              />
            ))}
            <div className="h-16 flex items-center justify-center text-[7px] tracking-widest uppercase text-white/20 text-center leading-tight">
              keys
              <br />
              1-7
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
