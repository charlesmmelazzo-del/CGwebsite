"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import ArcadeCanvas from "./ArcadeCanvas";
import CRTScreen from "./CRTScreen";
import { useArcadeKeys } from "./controls";
import {
  blink,
  clamp,
  clear,
  drawSprite,
  drawText,
  drawTextMarquee,
  GAME_H,
  GAME_W,
  meter,
  outline,
  P,
  pad,
  rect,
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
  beginBuild,
  cardRemaining,
  CARD_SECONDS,
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
import { INGREDIENTS, ING_BY_KEY, colorFor } from "./ingredients";
import {
  BUBBLE_R,
  TANK_BOTTOM,
  TANK_TOP,
  freshBubbleState,
  tapBubbles,
  updateBubbles,
  type BubbleState,
} from "./bubbleCore";

// ═══════════════════════════════════════════════════════════════════════════
// BEHIND THE STICK — the presentation layer.
//
// Ingredients slide along the rail; hit the matching button while one sits in
// the window and it goes in the tin. Miss and it hits the floor. Every ten
// pours you shake or stir it out, faster each time.
//
// All the rules live in behindTheStickCore.ts. This file draws and listens.
// ═══════════════════════════════════════════════════════════════════════════

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
  const cy = 116;

  // The drink only. The dial that turns it is on the deck below, so drawing a
  // track and a dot up here too would be two controls for one action.
  rect(ctx, cx - 22, cy - 26, 44, 52, "#100810");
  rect(ctx, cx - 19, cy - 23, 38, 46, "#7FA8C0");
  rect(ctx, cx - 16, cy - 4, 32, 24, P.amber);

  // Surface, tilted by the swirl the player is actually managing.
  const swirl = Math.sin(st.revs * Math.PI * 2) * 4;
  rect(ctx, cx - 16, cy - 6 + swirl, 32, 3, ok ? P.lime : P.tan);
  rect(ctx, cx - 16, cy - 2 - swirl, 32, 2, "#B07830");

  // The spoon, following the dial round.
  const lead = st.lastAngle ?? -Math.PI / 2;
  rect(ctx, cx + Math.round(Math.cos(lead) * 11) - 1, cy - 34, 3, 36, "#C8C8D0");
  rect(ctx, cx + Math.round(Math.cos(lead) * 11) - 2, cy - 36, 5, 4, P.white);

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

/**
 * The drink going across the bar.
 *
 * Wordless on purpose. It used to shout ORDER UP!, which is the exact phrase
 * the next card opens with — the same words twice in three seconds read as the
 * game repeating itself. A guest smiling at a drink says it without saying it.
 */
function drawServe(ctx: CanvasRenderingContext2D, st: State) {
  const p = clamp(st.phaseT / 1.6, 0, 1);
  // The glass slides from the bartender's hand to the guest.
  const x = 120 + p * 52;
  rect(ctx, x, 184, 9, 14, P.cyan);
  rect(ctx, x + 1, 186, 7, 5, P.amber);
  rect(ctx, x + 2, 198, 5, 2, P.slate);
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

/**
 * Every screen that explains something, drawn the same way.
 *
 * One layout for all of them so a card never looks like a different kind of
 * screen: heading, lines, and a countdown along the bottom. The countdown is
 * the important part — without it a card that sits for four seconds reads as
 * the game having frozen, and people start tapping.
 */
function drawCard(
  ctx: CanvasRenderingContext2D,
  opts: {
    heading: string;
    headingColor?: string;
    sub?: string;
    lines: string[];
    remaining: number;
    total: number;
    flash?: boolean;
    t: number;
  }
) {
  const { heading, sub, lines, remaining, total, t } = opts;
  const headingColor = opts.headingColor ?? P.yellow;

  // A flashing card alternates its ground, which is what "full screen flashing"
  // looked like on hardware that had no alpha to fade with.
  const lit = opts.flash ? blink(t, 3) : false;
  clear(ctx, lit ? "#2A1040" : "#12081F");

  drawTextMarquee(ctx, heading, 112, 34, headingColor, 2, "center", P.black, P.crimson);

  if (sub) {
    drawTextMarquee(ctx, sub, 112, 66, P.cyan, 2, "center", P.black, "#0A4A6A");
  }

  let y = sub ? 104 : 84;
  for (const line of lines) {
    for (const wrapped of wrapText(line, 30)) {
      drawText(ctx, wrapped, 112, y, P.white, 1, "center");
      y += 11;
    }
    y += 5;
  }

  // ── Countdown ────────────────────────────────────────────────────────────
  const secs = Math.ceil(remaining);
  drawText(ctx, `${secs}`, 112, GAME_H - 26, P.yellow, 1, "center");
  meter(ctx, 52, GAME_H - 14, 120, 5, clamp(remaining / total, 0, 1), P.yellow);
}

/** Greedy wrap at whole words, for the 5x7 font's ~30 characters a line. */
function wrapText(text: string, width: number): string[] {
  const out: string[] = [];
  let line = "";
  for (const word of text.split(" ")) {
    if (line.length === 0) line = word;
    else if (line.length + 1 + word.length <= width) line += ` ${word}`;
    else {
      out.push(line);
      line = word;
    }
  }
  if (line) out.push(line);
  return out;
}

/**
 * The title card on boot.
 *
 * Falls back to drawn lettering when the logo image hasn't loaded — the canvas
 * cannot wait on a network fetch, and a blank three seconds would look broken.
 */
function drawBoot(
  ctx: CanvasRenderingContext2D,
  t: number,
  logo: HTMLImageElement | null
) {
  clear(ctx, P.black);

  if (logo && logo.complete && logo.naturalWidth > 0) {
    const maxW = GAME_W - 16;
    const scale = Math.min(maxW / logo.naturalWidth, 150 / logo.naturalHeight);
    const w = Math.round(logo.naturalWidth * scale);
    const h = Math.round(logo.naturalHeight * scale);
    ctx.drawImage(logo, Math.round((GAME_W - w) / 2), Math.round(96 - h / 2), w, h);
  } else {
    drawTextMarquee(ctx, "BEHIND", 112, 62, P.yellow, 3, "center", P.black, P.crimson);
    drawTextMarquee(ctx, "THE STICK", 112, 104, P.red, 3, "center", P.black, "#3A0000");
  }

  if (blink(t, 2)) {
    drawText(ctx, "COMMON GOOD COCKTAIL HOUSE", 112, 196, P.cyan, 1, "center");
  }
}

/** The order card: the drink, and the four bottles to go and find. */
function drawOrderCard(ctx: CanvasRenderingContext2D, st: State, t: number) {
  const name = st.cocktail.name.toUpperCase();
  drawCard(ctx, {
    heading: "ORDER UP!",
    sub: name.length > 13 ? undefined : name,
    lines:
      name.length > 13
        ? [name, "Tap the right ingredients to select them!", "Avoid wrong ingredients or you lose points!"]
        : ["Tap the right ingredients to select them!", "Avoid wrong ingredients or you lose points!"],
    remaining: cardRemaining(st),
    total: CARD_SECONDS,
    flash: true,
    t,
  });

  // The recipe as the bottles themselves — the shapes the player is about to
  // hunt for, not a list of words.
  st.cocktail.recipe.forEach((key, i) => {
    const ing = ING_BY_KEY.get(key);
    if (!ing) return;
    const x = 34 + i * 46;
    drawSprite(ctx, ing.sprite, x, 176, ing.colors, 1);
    drawText(ctx, ing.label.toUpperCase().slice(0, 7), x + 5, 196, ing.color, 1, "center");
  });
}


/**
 * Bubble Buster. The bar's stock drifting in a tank, the recipe underneath.
 */
function drawBubbles(ctx: CanvasRenderingContext2D, bs: BubbleState, t: number) {
  clear(ctx, "#0A0820");

  // Tank glass, so the play area has an edge the bounces make sense against.
  outline(ctx, 0, TANK_TOP, GAME_W, TANK_BOTTOM - TANK_TOP, "#2A2258");
  for (let i = 0; i < 6; i++) {
    rect(ctx, 0, TANK_TOP + 10 + i * 30, GAME_W, 1, "#150F33");
  }

  for (const b of bs.bubbles) {
    if (b.popped) continue;
    const ing = ING_BY_KEY.get(b.key);
    if (!ing) continue;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const needed = bs.needed.includes(b.key) && !bs.collected.includes(b.key);

    // ── Popping ────────────────────────────────────────────────────────────
    // A ring that expands and thins, which reads as a burst without needing
    // any extra sprites.
    if (b.popping > 0) {
      const k = 1 - b.popping / 0.35;
      const r = Math.round(BUBBLE_R + k * 9);
      ring(ctx, x, y, r, k < 0.5 ? P.white : P.slate);
      continue;
    }

    // The bubble itself: a ring with a highlight, so it reads as glass rather
    // than as a disc the ingredient is stuck to.
    ring(ctx, x, y, BUBBLE_R, needed && blink(t, 2.5) ? P.lime : "#5A6A9A");
    rect(ctx, x - 5, y - BUBBLE_R + 2, 3, 2, P.white);

    drawSprite(ctx, ing.sprite, x - 5, y - 7, ing.colors, 1);
  }

  // ── Feedback ─────────────────────────────────────────────────────────────
  if (bs.flash) {
    const ing = ING_BY_KEY.get(bs.flash.key);
    drawText(
      ctx,
      bs.flash.good ? `+${ing?.label.toUpperCase() ?? "OK"}` : "NOT THAT ONE",
      112,
      TANK_TOP + 6,
      bs.flash.good ? P.lime : P.red,
      1,
      "center"
    );
  }

  // ── The recipe, ticking off ──────────────────────────────────────────────
  rect(ctx, 0, TANK_BOTTOM + 2, GAME_W, GAME_H - TANK_BOTTOM - 2, "#100A1C");
  drawText(ctx, "RECIPE", 6, TANK_BOTTOM + 6, P.white, 1);

  bs.needed.forEach((key, i) => {
    const ing = ING_BY_KEY.get(key);
    if (!ing) return;
    const has = bs.collected.includes(key);
    const x = 8 + i * 54;
    const y = TANK_BOTTOM + 16;
    drawSprite(ctx, ing.sprite, x, y, ing.colors, 1);
    if (has) {
      rect(ctx, x - 1, y + 7, 13, 2, P.lime);
      drawText(ctx, "OK", x + 14, y + 5, P.lime, 1);
    }
  });
}

/** A one-pixel circle, drawn the way the rest of the art is: as rects. */
function ring(ctx: CanvasRenderingContext2D, cx: number, cy: number, r: number, color: string) {
  const steps = Math.max(10, Math.round(r * 2.2));
  for (let i = 0; i < steps; i++) {
    const a = (i / steps) * Math.PI * 2;
    rect(ctx, Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1, color);
  }
}



// ─── The pour deck ───────────────────────────────────────────────────────────

/**
 * The round's four ingredients as round cabinet buttons, two down each side.
 *
 * Offset diagonally rather than stacked square: on a phone both thumbs come in
 * from the bottom corners, and a straight column means the lower button is
 * under the hand that's reaching for the upper one. The gap in the middle is
 * where the screen shows through above.
 */
function PourDeck({
  recipe,
  iconUrls,
  disabled,
  onPress,
}: {
  recipe: readonly string[];
  iconUrls: Record<string, string>;
  disabled: boolean;
  onPress: (key: string) => void;
}) {
  const left = recipe.slice(0, 2);
  const right = recipe.slice(2, 4);

  const column = (keys: readonly string[], side: "left" | "right") => (
    <div className="flex flex-col gap-3">
      {keys.map((key, i) => {
        const ing = ING_BY_KEY.get(key);
        if (!ing) return null;
        // Second one steps inward, so the pair sits on a diagonal and a thumb
        // reaching for the upper never covers the lower.
        const indent = i === 1 ? (side === "left" ? "ml-9" : "mr-9") : "";
        return (
          <button
            key={key}
            type="button"
            aria-label={ing.label}
            disabled={disabled}
            onPointerDown={(e) => {
              e.preventDefault();
              onPress(key);
            }}
            onContextMenu={(e) => e.preventDefault()}
            className={`${indent} select-none flex flex-col items-center justify-end gap-1 px-1 disabled:opacity-30 active:translate-y-[3px] transition-transform`}
            style={{
              touchAction: "none",
              WebkitTouchCallout: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* The sprite IS the control. A drawn button around a drawn bottle
                was two frames around one picture; the bottle is what the player
                is matching against the rail, so show that and nothing else.
                Fixed box either way, so the icon appearing after mount doesn't
                shift the target under a thumb. */}
            <span style={{ width: 54, height: 74 }} className="flex items-end justify-center">
              {iconUrls[key] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrls[key]}
                  alt=""
                  width={11}
                  height={15}
                  style={{
                    imageRendering: "pixelated",
                    width: 54,
                    height: 74,
                    filter: `drop-shadow(0 3px 0 rgba(0,0,0,0.6))`,
                  }}
                />
              )}
            </span>
            <span
              className="text-[10px] font-black uppercase leading-none tracking-tight"
              style={{
                color: ing.color,
                fontFamily: "var(--font-pixel, ui-monospace, monospace)",
                textShadow: "2px 2px 0 #000",
              }}
            >
              {ing.label}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="w-full flex items-center justify-between px-1 sm:px-4">
      {column(left, "left")}
      {column(right, "right")}
    </div>
  );
}


// ─── The stir dial ───────────────────────────────────────────────────────────

/**
 * A dot on a circular track, on the deck where every other control lives.
 *
 * The stir used to be read off the canvas itself — drag anywhere on the screen
 * and the angle to its centre counted. That put a control in the one region of
 * the cabinet that is otherwise pure animation, with no visible thing to grab,
 * which reads as the game glitching rather than as an instruction.
 *
 * Pointer capture is what makes it usable: a stir is a continuous circular
 * drag, and without capture the first time the thumb leaves the 120px dial the
 * events stop arriving and the drink stops turning mid-lap.
 */
function StirDial({
  wrapRef,
  onAngle,
  onRelease,
}: {
  wrapRef: React.RefObject<HTMLDivElement>;
  onAngle: (angle: number) => void;
  onRelease: () => void;
}) {
  const [angle, setAngle] = useState(-Math.PI / 2);
  const [down, setDown] = useState(false);

  const track = (e: React.PointerEvent) => {
    const el = wrapRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const a = Math.atan2(
      e.clientY - (r.top + r.height / 2),
      e.clientX - (r.left + r.width / 2)
    );
    setAngle(a);
    onAngle(a);
  };

  const R = 52;
  const dotX = Math.cos(angle) * R;
  const dotY = Math.sin(angle) * R;

  return (
    <div
      ref={wrapRef}
      className="relative w-[132px] h-[132px] touch-none"
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
        setDown(true);
        track(e);
      }}
      onPointerMove={(e) => {
        if (!down) return;
        e.preventDefault();
        track(e);
      }}
      onPointerUp={() => {
        setDown(false);
        onRelease();
      }}
      onPointerCancel={() => {
        setDown(false);
        onRelease();
      }}
      onContextMenu={(e) => e.preventDefault()}
      style={{ WebkitTouchCallout: "none", WebkitTapHighlightColor: "transparent" }}
    >
      {/* The track */}
      <div
        aria-hidden
        className="absolute inset-0 rounded-full border-[3px] border-dashed border-white/30"
      />
      <p className="absolute inset-0 flex items-center justify-center text-center text-[8px] tracking-[0.2em] uppercase text-white/40 leading-tight pointer-events-none">
        stir
      </p>
      {/* The dot */}
      <div
        aria-hidden
        className="absolute w-[34px] h-[34px] rounded-full border-[3px] border-black"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) translate(${dotX}px, ${dotY}px) scale(${down ? 1.12 : 1})`,
          background: `radial-gradient(circle at 36% 30%, #FFFFFF 0%, ${P.lime} 55%, ${P.green} 100%)`,
          boxShadow: "0 3px 0 rgba(0,0,0,0.5)",
          transition: "transform 40ms linear",
        }}
      />
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BehindTheStick({ onGameOver }: ArcadeGameProps) {
  const s = useRef<State>(freshState(colorFor));
  // Bubble Buster has its own simulation, rebuilt at the start of each gather
  // phase from the round's own recipe.
  const g = useRef<BubbleState | null>(null);

  // The title art. Loaded imperatively because the canvas draws it directly;
  // a React <Image> would be a second copy the frame loop can't reach.
  const logoRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    const img = new window.Image();
    img.src = "/popup/art/logo-behind-the-stick.png";
    img.onload = () => {
      logoRef.current = img;
    };
  }, []);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const endedRef = useRef(false);

  // Mirrored into React only so the right controls render — never per frame.
  const [uiPhase, setUiPhase] = useState<Phase>("boot");
  const uiPhaseRef = useRef<Phase>("boot");

  const press = useCallback((key: string) => {
    if (s.current.phase === "pour") s.current.presses.push(key);
  }, []);

  const tapShake = useCallback(() => {
    if (s.current.phase === "shake") s.current.shakeTaps++;
  }, []);

  /**
   * A tap in the tank.
   *
   * The canvas is letterboxed inside its row, so a click at the row's
   * coordinates is not a click in game space. Read the CANVAS rect rather than
   * the container's and scale by the 224x288 buffer, or every tap lands off by
   * however much black is either side of the picture.
   */
  const onTankTap = useCallback((e: React.PointerEvent) => {
    const st = s.current;
    if (st.phase !== "gather" || !g.current) return;
    const canvas = (e.currentTarget as HTMLElement).querySelector("canvas");
    if (!canvas) return;
    const r = canvas.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return;
    tapBubbles(
      g.current,
      ((e.clientX - r.left) / r.width) * GAME_W,
      ((e.clientY - r.top) / r.height) * GAME_H
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

      // Number keys map onto the pour deck, so 1-4 are this drink's own four
      // ingredients rather than fixed positions in a list that no longer shows.
      const idx = "1234".indexOf(key);
      if (idx >= 0) {
        const key4 = st.cocktail.recipe[idx];
        if (key4) press(key4);
      }
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

      // ── The shelves ───────────────────────────────────────────────────
      if (st.phase === "gather") {
        if (!g.current) g.current = freshBubbleState(st.cocktail.recipe);
        updateBubbles(g.current, dt);
        if (g.current.done) {
          st.score += g.current.score;
          g.current = null;
          beginBuild(st);
        }
      } else if (st.phase !== "order" && g.current) {
        g.current = null;
      }

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
      if (st.phase === "boot") {
        drawBoot(ctx, t, logoRef.current);
        return;
      }
      if (st.phase === "howto") {
        drawCard(ctx, {
          heading: "HOW TO PLAY",
          lines: [
            "You are tonight's guest bartender!",
            "As drinks are ordered you will grab the ingredients the recipe needs.",
            "Then tap the ingredients in rhythm to put them in your shaker or mixing glass.",
            "Then shake or stir fast enough to make the drink properly!",
            "Good luck!",
          ],
          remaining: cardRemaining(st),
          total: CARD_SECONDS,
          t,
        });
        return;
      }
      if (st.phase === "order") {
        drawOrderCard(ctx, st, t);
        return;
      }
      if (st.phase === "build") {
        drawCard(ctx, {
          heading: "LET'S BUILD",
          sub: "THAT DRINK!",
          lines: [
            "Tap the right ingredient in time as they slide across the bar to toss them in.",
            "Tap at the wrong time and you will spill!",
            "Spill too many and it's game over!",
          ],
          remaining: cardRemaining(st),
          total: CARD_SECONDS,
          flash: true,
          t,
        });
        return;
      }
      if (st.phase === "make") {
        drawCard(ctx, {
          heading: "NOW MAKE",
          sub: "THAT DRINK!",
          headingColor: P.lime,
          lines:
            st.cocktail.finish === "shake"
              ? [
                  "Tap as fast as you can to shake it properly!",
                  "The faster you shake, the more points you get!",
                ]
              : [
                  "Stir around the circle!",
                  "The faster you stir, the more points you get!",
                ],
          remaining: cardRemaining(st),
          total: CARD_SECONDS,
          flash: true,
          t,
        });
        return;
      }
      if (st.phase === "gather" && g.current) {
        drawBubbles(ctx, g.current, t);
        return;
      }

      drawBackbar(ctx, t);

      const pose =
        st.phase === "shake"
          ? "shake"
          : st.phase === "stir"
            ? "stir"
            : st.phase === "serve"
              ? "serve"
              : "idle";
      // Drawn at 2x now the crowd is gone. He is the only thing to watch during
      // a round, and at 1x he was a 20-pixel figure lost in the middle of the
      // screen. An INTEGER scale on purpose — 1.5 or 1.7 lands sprite pixels on
      // fractional device pixels and opens hairline seams through the art.
      ctx.save();
      ctx.translate(112, 168);
      ctx.scale(2, 2);
      ctx.imageSmoothingEnabled = false;
      drawBartender(
        ctx,
        0,
        0,
        st.phase === "over" ? "panic" : st.mood,
        pose,
        t,
        st.phase === "shake"
          ? { count: st.shakeCount, since: st.phaseT - st.lastTapT }
          : undefined,
        st.phase === "stir" ? st.revs : undefined
      );
      ctx.restore();
      // The tin stays outside the transform so it keeps its place on the bar
      // rather than floating up with him.
      if (pose === "idle") drawTin(ctx, 172, 140, st.tinFill);

      // No crowd while the drink is being built. A wall of guests during the
      // rhythm phase competes with the only thing the player is watching, and
      // it stops the bartender being drawn big enough to read. One guest steps
      // in only to take the drink, or to ask where it is.
      if (st.phase === "serve") {
        drawGuest(ctx, 176, 214, "happy", t, P.teal, "#005058");
      } else if (st.phase === "over") {
        drawGuest(ctx, 176, 214, "angry", t, P.red, "#7A0F0A");
      }
      drawBarFront(ctx);

      if (st.phase === "pour") drawRail(ctx, st, t);
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

  // Cards and Bubble Buster take the whole cabinet; only the phases that are
  // actually played with a control keep the 60/40 split.
  const fullScreenPhase =
    uiPhase === "boot" ||
    uiPhase === "howto" ||
    uiPhase === "order" ||
    uiPhase === "build" ||
    uiPhase === "make" ||
    uiPhase === "gather" ||
    uiPhase === "serve" ||
    uiPhase === "over";

  return (
    /*
      A cabinet has a screen and a deck, and they don't move. 60% of the height
      is the screen — animation and information only — and the bottom 40% is
      where every control lives, whatever the phase.
      
      This is why the stir dial is down here rather than drawn on the canvas:
      controls appearing over the animation, in a place nothing else ever
      appears, read as a glitch rather than as a control.
    */
    <div className="flex flex-col" style={{ height: "min(78vh, 640px)" }}>
      <div
        className={`min-h-0 flex items-center justify-center bg-black px-2 pt-2 ${
          fullScreenPhase ? "flex-1" : "flex-[3]"
        }`}
        onPointerDown={onTankTap}
        onContextMenu={(e) => e.preventDefault()}
      >
        <CRTScreen glow="#FFA000">
          <ArcadeCanvas onFrame={onFrame} running fit="height" />
        </CRTScreen>
      </div>

      {/*
        The deck only exists when something is played on it. A card explaining
        the game, or a tank you tap directly, has no controls — leaving an empty
        40% strip under them wastes the screen and makes the card look cropped.
      */}
      <div
        hidden={fullScreenPhase}
        className={`${fullScreenPhase ? "hidden" : "flex"} flex-[2] min-h-0 p-2 bg-black select-none items-center justify-center`}
        style={{
          touchAction: "none",
          WebkitUserSelect: "none",
          WebkitTouchCallout: "none",
          WebkitTapHighlightColor: "transparent",
        }}
        onContextMenu={(e) => e.preventDefault()}
      >
        {uiPhase === "boot" || uiPhase === "howto" || uiPhase === "order" ||
        uiPhase === "build" || uiPhase === "make" ? (
          // Cards run on their own timer. Nothing to press.
          <p className="text-center text-[10px] tracking-[0.3em] uppercase text-white/35">
            {uiPhase === "boot" ? "" : `${Math.ceil(cardRemaining(s.current))}`}
          </p>
        ) : uiPhase === "gather" ? (
          <p className="text-center text-[11px] tracking-[0.2em] uppercase text-white/55 leading-relaxed px-6">
            Tap the ingredients the recipe needs
          </p>
        ) : uiPhase === "shake" ? (
          <div className="flex items-center justify-center">
            <button
              type="button"
              aria-label="Shake"
              // pointerdown, not click — a rapid tap must register on contact.
              onPointerDown={(e) => {
                e.preventDefault();
                tapShake();
              }}
              onContextMenu={(e) => e.preventDefault()}
              style={{
                background: P.lime,
                touchAction: "none",
                WebkitTouchCallout: "none",
                WebkitTapHighlightColor: "transparent",
              }}
              className="select-none w-[112px] h-[112px] rounded-full border-[4px] border-black text-black text-[15px] font-black tracking-[0.12em] uppercase shadow-[0_6px_0_#00551C] active:translate-y-[5px] active:shadow-[0_1px_0_#00551C] transition-transform"
            >
              Shake
            </button>
          </div>
        ) : uiPhase === "stir" ? (
          <StirDial
            wrapRef={wrapRef}
            onAngle={(a) => applyStirAngle(s.current, a)}
            onRelease={endStir}
          />
        ) : (
          // ── The pour deck ────────────────────────────────────────────────
          // Only this drink's four ingredients, as round cabinet buttons, two
          // per side and offset so a thumb reaching from each corner of a
          // phone lands on one without covering the other.
          <PourDeck
            recipe={s.current.cocktail.recipe}
            iconUrls={iconUrls}
            disabled={uiPhase !== "pour"}
            onPress={press}
          />
        )}
      </div>
    </div>
  );
}
