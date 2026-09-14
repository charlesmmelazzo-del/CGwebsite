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
  PIXEL_SCALE,
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
import { artworkUrl, ingredientArt, warmIngredientArt } from "./ingredientImages";
import {
  DECK_ART,
  drawArt,
  drawArtCentred,
  drawArtFrame,
  drawArtStanding,
  drawArtStrip,
  artGameHeight,
  drinkArt,
  warmStickArt,
  type StickArtName,
} from "./stickArt";
import {
  BUBBLE_R,
  live as liveBubbles,
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

/**
 * Where the painted back bar's counter starts, in game pixels. The bartender
 * stands behind it: he is drawn after the background and then the counter and
 * everything below it is drawn again over his waist.
 */
const COUNTER_Y = 152;

/** A black wash over the scene, for the close-ups that sit on top of it. */
function dim(ctx: CanvasRenderingContext2D, amount: number) {
  ctx.fillStyle = `rgba(0,0,0,${amount})`;
  ctx.fillRect(0, 0, GAME_W, GAME_H);
}

/** The painted back bar, or the drawn one until it loads. */
function drawBackbar(ctx: CanvasRenderingContext2D, t: number) {
  if (drawArt(ctx, "bg-backbar", 0, 0, GAME_W, GAME_H)) {
    // The sign buzzes: mostly lit, with the odd flicker off.
    const flicker = Math.floor(t * 9) % 23 === 0 || Math.floor(t * 9) % 31 === 0;
    drawArt(ctx, flicker ? "neon-off" : "neon-on", 7, 84, 40, 24.4);
    return;
  }
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

/**
 * The counter and the bar front, redrawn over the bartender's waist. A slice
 * of the same background image, so it lines up with what is behind him.
 */
function drawCounterOver(ctx: CanvasRenderingContext2D): boolean {
  return drawArtSlice(ctx, "bg-backbar", COUNTER_Y);
}

/** Redraw the background from `fromY` down. */
function drawArtSlice(ctx: CanvasRenderingContext2D, name: StickArtName, fromY: number): boolean {
  ctx.save();
  ctx.beginPath();
  ctx.rect(0, fromY, GAME_W, GAME_H - fromY);
  ctx.clip();
  const ok = drawArt(ctx, name, 0, 0, GAME_W, GAME_H);
  ctx.restore();
  return ok;
}

/** The painted bartender, in the pose and mood asked for. */
function bartenderArt(mood: Mood | "over"): StickArtName {
  if (mood === "over") return "bartender-over";
  if (mood === "panic") return "bartender-panic";
  if (mood === "worried") return "bartender-worried";
  return "bartender-happy";
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
  const wx = WINDOW_X - GOOD_HALF - 2;
  const ww = (GOOD_HALF + 2) * 2;

  if (drawArtStrip(ctx, "rail-strip", -2, RAIL_Y, GAME_W + 4, RAIL_H, 0.42)) {
    // The window pulses so the eye finds it without reading anything.
    if (blink(t, 3)) {
      ctx.fillStyle = "rgba(255,213,0,0.16)";
      ctx.fillRect(wx, RAIL_Y + 3, ww, RAIL_H - 6);
    }
    drawArtFrame(ctx, "pour-window", wx - 2, RAIL_Y - 1, ww + 4, RAIL_H + 2, 0.24, 7);
  } else {
    rect(ctx, 0, RAIL_Y, GAME_W, RAIL_H, "#101020");
    rect(ctx, 0, RAIL_Y, GAME_W, 1, P.slate);
    rect(ctx, 0, RAIL_Y + RAIL_H - 1, GAME_W, 1, P.slate);
    rect(ctx, wx, RAIL_Y + 1, ww, RAIL_H - 2, "#182848");
    outline(ctx, wx, RAIL_Y + 1, ww, RAIL_H - 2, blink(t, 3) ? P.cyan : P.teal);
  }

  for (const n of st.notes) {
    if (n.judged) continue;
    drawIngredient(ctx, n.ing, n.x, RAIL_Y + 19, 30);
  }
}

function drawShake(ctx: CanvasRenderingContext2D, st: State, t: number) {
  const ok = currentBpm(st) >= st.target;
  const settling = st.phaseT <= GRACE_SECONDS;

  // A close-up: the bar pushed back into the dark and the tin in two hands.
  // The frame flips once per tap, so it moves exactly as fast as the player.
  drawBackbar(ctx, t);
  dim(ctx, 0.62);
  const resting = st.phaseT - st.lastTapT > 0.5;
  const up = !resting && st.shakeCount % 2 === 1;
  const drewTin = drawArtCentred(
    ctx,
    up ? "shaker-2" : "shaker-1",
    112,
    146 + (resting ? 0 : up ? -4 : 4),
    176
  );
  if (!drewTin) clear(ctx, P.black);

  // One word for what to do. Deliberately no rate meter and no BPM readout:
  // the only thing a player can act on is "keep going" or "speed up", so a
  // number they have to interpret mid-shake is noise.
  if (!drawArtCentred(ctx, "banner-shake-it", 112, 238, 164)) {
    drawTextMarquee(ctx, "SHAKE", 112, 236, P.yellow, 3, "center", P.black, "#8A6A00");
  }

  // One word for how it is going, held back through the grace period so the
  // first thing a player sees is not a scolding.
  if (!settling) {
    drawTextMarquee(
      ctx,
      ok ? "GOOD!" : "GO FASTER!",
      112,
      22,
      ok ? P.lime : P.red,
      2,
      "center",
      P.black,
      ok ? "#00551C" : "#3A0000"
    );
  }

  // How much shaking is left, as a bar rather than a ticking number.
  const total = SHAKE_SECONDS + GRACE_SECONDS;
  meter(ctx, 52, 268, 120, 5, clamp((total - st.phaseT) / total, 0, 1), P.cyan);
}

function drawStir(ctx: CanvasRenderingContext2D, st: State, t: number) {
  const rpm = currentRpm(st);
  const ok = rpm >= st.target;

  const cx = 112;
  const cy = 116;
  const lead = st.lastAngle ?? -Math.PI / 2;

  // The drink only. The dial that turns it is on the deck below, so drawing a
  // track and a dot up here too would be two controls for one action.
  drawBackbar(ctx, t);
  dim(ctx, 0.62);

  // Glass, then the swirl on its surface, then the spoon down into it. The
  // spoon follows the dial round, and the swirl turns once per third of a lap
  // the player actually makes — a stalled hand stalls the drink.
  const glassW = 110;
  const glassH = glassW * (238 / 177);
  const glassTop = 206 - glassH;
  const drewGlass = drawArtStanding(ctx, "mixing-glass", cx, 206, glassH);
  if (drewGlass) {
    const frame = (["swirl-1", "swirl-2", "swirl-3"] as const)[Math.floor(st.revs * 3) % 3];
    drawArtCentred(ctx, frame, cx, glassTop + glassH * 0.39, glassW * 0.74, 0.9);
    const spoonX = cx + Math.cos(lead) * glassW * 0.24;
    drawArtStanding(ctx, "bar-spoon", spoonX, glassTop + glassH * 0.62, 115);
  } else {
    clear(ctx, P.black);
    rect(ctx, cx - 22, cy - 26, 44, 52, "#100810");
    rect(ctx, cx - 19, cy - 23, 38, 46, "#7FA8C0");
    rect(ctx, cx - 16, cy - 4, 32, 24, P.amber);

    // Surface, tilted by the swirl the player is actually managing.
    const swirl = Math.sin(st.revs * Math.PI * 2) * 4;
    rect(ctx, cx - 16, cy - 6 + swirl, 32, 3, ok ? P.lime : P.tan);
    rect(ctx, cx - 16, cy - 2 - swirl, 32, 2, "#B07830");

    rect(ctx, cx + Math.round(Math.cos(lead) * 11) - 1, cy - 34, 3, 36, "#C8C8D0");
    rect(ctx, cx + Math.round(Math.cos(lead) * 11) - 2, cy - 36, 5, 4, P.white);
  }

  // Same treatment as the shake: one instruction, one verdict, no readout.
  if (!drawArtCentred(ctx, "banner-stir-it", 112, 238, 164)) {
    drawTextMarquee(ctx, "STIR", 112, 250, P.yellow, 3, "center", P.black, "#8A6A00");
  }

  if (st.phaseT > GRACE_SECONDS) {
    drawTextMarquee(
      ctx,
      ok ? "GOOD!" : "GO FASTER!",
      112,
      22,
      ok ? P.lime : P.red,
      2,
      "center",
      P.black,
      ok ? "#00551C" : "#3A0000"
    );
  }

  const total = STIR_SECONDS + GRACE_SECONDS;
  meter(ctx, 52, 268, 120, 5, clamp((total - st.phaseT) / total, 0, 1), P.cyan);
}

/**
 * The drink going across the bar.
 *
 * Wordless on purpose. It used to shout ORDER UP!, which is the exact phrase
 * the next card opens with — the same words twice in three seconds read as the
 * game repeating itself. A guest smiling at a drink says it without saying it.
 */
/** A finished cocktail, drawn from rects like everything else on the tube. */
function drawCocktail(ctx: CanvasRenderingContext2D, cx: number, cy: number, s = 1) {
  const u = (n: number) => Math.round(n * s);
  // Bowl, tapering to the stem.
  for (let i = 0; i < u(9); i++) {
    const w = u(20) - i * 2;
    rect(ctx, cx - w / 2, cy - u(10) + i, w, 1, i < u(3) ? P.magenta : P.pink);
  }
  rect(ctx, cx - u(10), cy - u(11), u(20), u(1) + 1, P.white);
  rect(ctx, cx - 1, cy - u(1), u(2), u(9), P.slate);
  rect(ctx, cx - u(6), cy + u(8), u(12), u(2), P.slate);
  // Garnish, so it reads as a drink rather than a funnel.
  rect(ctx, cx + u(5), cy - u(14), u(2), u(5), P.lime);
  rect(ctx, cx + u(4), cy - u(15), u(4), u(2), P.green);
}

/**
 * The serve.
 *
 * Both characters on black, side on, and the drink travels between them. The
 * old version showed one guest appearing at the bar with a glass sliding past
 * — which read as a glass moving of its own accord past somebody who happened
 * to be there. Two figures and a handover is the same beat, legibly.
 */
function drawServe(ctx: CanvasRenderingContext2D, st: State, t: number) {
  const bartenderX = 60;
  const guestX = 178;
  /** Top of the painted bar front both of them lean on. */
  const barY = 214;

  // ── The handover ────────────────────────────────────────────────────────
  // Eased so it leaves slowly, crosses quickly and settles — a linear slide
  // looks like a prop on a rail.
  const p = clamp(st.phaseT / 1.5, 0, 1);
  const ease = p < 0.5 ? 2 * p * p : 1 - Math.pow(-2 * p + 2, 2) / 2;
  const arrived = p >= 1;

  drawBackbar(ctx, t);
  dim(ctx, 0.55);

  // Hands on the bar while the drink crosses, then a toast once it lands. The
  // guest waits, and has it in hand the moment it arrives.
  const drewPair =
    drawArtStanding(ctx, arrived ? "bartender-serve" : "bartender-happy", bartenderX, barY + 12, 156) &&
    drawArtStanding(ctx, arrived ? "guest-happy" : "guest-wait", guestX, barY + 8, 100);

  if (!drewPair) {
    clear(ctx, P.black);
    drawBartender(ctx, bartenderX, 250, "happy", "serve", t);
    drawGuest(ctx, guestX, 250, "happy", t, P.teal, "#005058");
  } else {
    drawArtStrip(ctx, "bar-front", -4, barY, GAME_W + 8, GAME_H - barY + 6, 0.3);
  }

  // The drink itself, along the bar top in a shallow arc so it is carried
  // rather than dragged. Gone once the guest is holding it.
  const x = bartenderX + 30 + ease * (guestX - bartenderX - 58);
  const lift = Math.sin(ease * Math.PI) * 12;
  const art = drinkArt(st.cocktail.key);
  if (!arrived || !drewPair) {
    if (!(drewPair && art && drawArtStanding(ctx, art, x, barY + 4 - lift, drinkHeight(art, 44)))) {
      drawCocktail(ctx, x, barY - lift, 1.3);
    }
  }

  if (arrived && blink(t, 3)) {
    if (!drawArtCentred(ctx, "banner-nice-one", 112, 44, 176)) {
      drawTextMarquee(ctx, "NICE ONE!", 112, 60, P.lime, 2, "center", P.black, "#00551C");
    }
  }
}

function drawOver(ctx: CanvasRenderingContext2D, t: number, tooSlow: boolean): boolean {
  // The guest who didn't get a drink, leaning in from the right.
  const drewGuest = drawArtStanding(ctx, "guest-angry", 190, GAME_H + 4, 96);
  const banner = tooSlow ? "banner-too-slow" : "banner-game-over";
  if (drewGuest && drawArtCentred(ctx, banner, 78, 196, 140)) {
    if (blink(t, 2)) {
      drawTextMarquee(ctx, "WHERE IS MY DRINK!?", 76, 236, P.yellow, 1, "center");
    }
    return true;
  }
  rect(ctx, 0, RAIL_Y - 6, GAME_W, RAIL_H + 12, "#101020");
  drawTextMarquee(ctx, "GAME OVER", 112, RAIL_Y + 4, P.red, 2, "center", P.black, "#3A0000");
  if (blink(t, 2)) {
    drawTextMarquee(ctx, "WHERE IS MY DRINK!?", 112, RAIL_Y + 24, P.yellow, 1, "center");
  }
  return false;
}

function drawHud(ctx: CanvasRenderingContext2D, st: State) {
  rect(ctx, 0, 0, GAME_W, 13, P.black);
  drawText(ctx, `SCORE ${pad(Math.max(0, st.score))}`, 4, 3, P.white, 1);
  drawText(ctx, `ROUND ${st.round}`, 148, 3, P.cyan, 1);
  // Lives as glasses: standing until a spill knocks one over.
  for (let i = 0; i < MAX_STRIKES; i++) {
    const lost = i < st.strikes;
    const cx = 114 + i * 12;
    if (!drawArtStanding(ctx, lost ? "life-lost" : "life", cx, 12, 11)) {
      drawText(ctx, lost ? "X" : "-", cx - 6, 3, lost ? P.red : P.slate, 1);
    }
  }
}

/**
 * A banner for one of the game's shouted words, with the drawn lettering as
 * the fallback. ROUND gets its number written into the blank on its right.
 */
function drawBanner(ctx: CanvasRenderingContext2D, text: string, cx: number, cy: number) {
  const W = 172;
  const round = /^ROUND (\d+)$/.exec(text);
  const name: StickArtName | null = round
    ? "banner-round"
    : text === "SHAKE IT!"
      ? "banner-shake-it"
      : text === "STIR IT!"
        ? "banner-stir-it"
        : text === "TOO SLOW!"
          ? "banner-too-slow"
          : text === "ORDER UP!"
            ? "banner-order-up"
            : null;
  if (name && drawArtCentred(ctx, name, cx, cy, W)) {
    if (round) {
      drawTextMarquee(ctx, round[1], cx + W * 0.3, cy - 7, "#FFE9B0", 2, "center", P.black);
    }
    return;
  }
  drawTextMarquee(ctx, text, cx, cy, P.yellow, 2, "center", P.black, P.crimson);
}

/**
 * A glass's height when the tallest glass is drawn at `tallest`. The sprites
 * were cut at one shared scale, so this keeps a rocks glass shorter than a
 * coupe instead of stretching every drink to the same height.
 */
function drinkHeight(art: StickArtName, tallest: number): number {
  const TALLEST_SOURCE = 85; // the tallest glass, in game pixels at 1:1
  return ((artGameHeight(art) ?? TALLEST_SOURCE) / TALLEST_SOURCE) * tallest;
}

/** The score words that float off the rail, as painted plaques. */
const POP_ART: Record<string, StickArtName> = {
  PERFECT: "pop-perfect",
  GOOD: "pop-good",
  MISS: "pop-miss",
  OOPS: "pop-oops",
};

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
  const framed = drawArt(ctx, "bg-card", 0, 0, GAME_W, GAME_H);
  if (framed) {
    // The painted chalkboard, warmed a touch on the flash beat.
    if (lit) {
      ctx.fillStyle = "rgba(255,190,110,0.07)";
      ctx.fillRect(0, 0, GAME_W, GAME_H);
    }
  } else {
    clear(ctx, lit ? "#2A1040" : "#12081F");
  }

  if (heading === "ORDER UP!") {
    drawBanner(ctx, heading, 112, 38);
  } else {
    drawTextMarquee(ctx, heading, 112, 34, headingColor, 2, "center", P.black, P.crimson);
  }

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
  // Raised clear of the painted frame's bottom rail when there is one.
  const lift = framed ? 12 : 0;
  const secs = Math.ceil(remaining);
  drawText(ctx, `${secs}`, 112, GAME_H - 26 - lift, P.yellow, 1, "center");
  meter(ctx, 52, GAME_H - 14 - lift, 120, 5, clamp(remaining / total, 0, 1), P.yellow);
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
  // The bar the player is about to work, in the dark behind the title.
  if (drawArt(ctx, "bg-backbar", 0, 0, GAME_W, GAME_H)) dim(ctx, 0.7);

  if (logo && logo.complete && logo.naturalWidth > 0) {
    const maxW = GAME_W - 16;
    const scale = Math.min(maxW / logo.naturalWidth, 150 / logo.naturalHeight);
    const w = Math.round(logo.naturalWidth * scale);
    const h = Math.round(logo.naturalHeight * scale);
    // Smoothing on for this one draw. The source is far larger than the space
    // it lands in, and the buffer-wide nearest-neighbour setting would sample
    // it down to a handful of surviving rows.
    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(logo, (GAME_W - w) / 2, 96 - h / 2, w, h);
    ctx.imageSmoothingEnabled = false;
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
  const art = drinkArt(st.cocktail.key);
  if (art && drawArt(ctx, "bg-card", 0, 0, GAME_W, GAME_H)) {
    drawOrderCardArt(ctx, st, t, name, art);
    return;
  }
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
    drawIngredient(ctx, key, x + 5, 172, 30);
    drawText(ctx, ing.label.toUpperCase().slice(0, 7), x + 5, 194, ing.color, 1, "center");
  });
}

/**
 * The order card with the drink painted on it: what they asked for, what it
 * looks like, and the four bottles it takes, top to bottom.
 */
function drawOrderCardArt(
  ctx: CanvasRenderingContext2D,
  st: State,
  t: number,
  name: string,
  art: StickArtName
) {
  if (blink(t, 3)) {
    ctx.fillStyle = "rgba(255,190,110,0.07)";
    ctx.fillRect(0, 0, GAME_W, GAME_H);
  }
  drawBanner(ctx, "ORDER UP!", 112, 38);

  // Every glass at one scale, so a rocks glass sits shorter than a coupe.
  drawArtStanding(ctx, art, 112, 122, drinkHeight(art, 62));

  if (name.length <= 13) {
    drawTextMarquee(ctx, name, 112, 129, P.cyan, 2, "center", P.black, "#0A4A6A");
  } else {
    drawTextMarquee(ctx, name, 112, 132, P.cyan, 1, "center", P.black);
  }

  st.cocktail.recipe.forEach((key, i) => {
    const ing = ING_BY_KEY.get(key);
    if (!ing) return;
    const x = 39 + i * 49;
    drawIngredient(ctx, key, x, 164, 28);
    drawText(ctx, ing.label.toUpperCase().slice(0, 7), x, 182, ing.color, 1, "center");
  });

  let y = 201;
  for (const line of [
    "Tap the right ingredients to select them!",
    "Avoid wrong ingredients or you lose points!",
  ]) {
    for (const wrapped of wrapText(line, 30)) {
      drawText(ctx, wrapped, 112, y, P.white, 1, "center");
      y += 10;
    }
    y += 4;
  }

  const remaining = cardRemaining(st);
  drawText(ctx, `${Math.ceil(remaining)}`, 112, GAME_H - 38, P.yellow, 1, "center");
  meter(ctx, 52, GAME_H - 26, 120, 5, clamp(remaining / CARD_SECONDS, 0, 1), P.yellow);
}


/**
 * Bubble Buster. The bar's stock drifting in a tank, the recipe underneath.
 */
function drawBubbles(ctx: CanvasRenderingContext2D, bs: BubbleState, t: number) {
  // The painted tank, squeezed to the play area so its sand floor sits on the
  // recipe panel rather than behind it.
  const painted = drawArt(ctx, "bg-tank", 0, 0, GAME_W, TANK_BOTTOM + 4);
  if (!painted) {
    clear(ctx, "#0A0820");
    // Tank glass, so the play area has an edge the bounces make sense against.
    outline(ctx, 0, TANK_TOP, GAME_W, TANK_BOTTOM - TANK_TOP, "#2A2258");
    for (let i = 0; i < 6; i++) {
      rect(ctx, 0, TANK_TOP + 10 + i * 30, GAME_W, 1, "#150F33");
    }
  }

  for (const b of bs.bubbles) {
    if (b.popped) continue;
    const ing = ING_BY_KEY.get(b.key);
    if (!ing) continue;
    const x = Math.round(b.x);
    const y = Math.round(b.y);
    const needed = bs.needed.includes(b.key) && !bs.collected.includes(b.key);
    const size = BUBBLE_R * 2 + 4;

    // ── Popping ────────────────────────────────────────────────────────────
    // Three painted frames of the burst, falling back to a ring that expands
    // and thins.
    if (b.popping > 0) {
      const k = 1 - b.popping / 0.35;
      const frame = (["bubble-pop-1", "bubble-pop-2", "bubble-pop-3"] as const)[
        Math.min(2, Math.floor(k * 3))
      ];
      if (!drawArtCentred(ctx, frame, x, y, size + 8)) {
        const r = Math.round(BUBBLE_R + k * 9);
        ring(ctx, x, y, r, k < 0.5 ? P.white : P.slate);
      }
      continue;
    }

    // Slightly taller than the bubble, so the bottle fills it rather than
    // floating in the middle of a ring.
    drawIngredient(ctx, b.key, x, y, BUBBLE_R * 2 - 2);

    // The glass goes OVER the bottle, so its shine reads as the bottle being
    // inside a bubble rather than stuck to a disc.
    if (drawArtCentred(ctx, "bubble", x, y, size)) {
      if (needed && blink(t, 2.5)) ring(ctx, x, y, BUBBLE_R + 2, P.lime);
    } else {
      ring(ctx, x, y, BUBBLE_R, needed && blink(t, 2.5) ? P.lime : "#5A6A9A");
      rect(ctx, x - 5, y - BUBBLE_R + 2, 3, 2, P.white);
    }
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
    drawIngredient(ctx, key, x + 5, y + 7, 22);
    if (has) {
      rect(ctx, x - 3, y + 14, 17, 2, P.lime);
      drawText(ctx, "OK", x + 18, y + 5, P.lime, 1);
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
 * The round's four ingredients, two down each side, sized to the deck.
 *
 * A 2x2 grid in columns — recipe 1 and 2 on the left, 3 and 4 on the right,
 * matching the number keys — hugging the sides so each thumb has its own pair
 * and the middle stays clear. Each bottle is as tall as its half of the deck
 * allows rather than a fixed 70px: the deck is a different height on every
 * phone, and a fixed icon was a small bottle floating in a big black strip on
 * a tall one and cropped on a short one.
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
  return (
    <div className="w-full h-full max-w-[420px] mx-auto grid grid-cols-2 grid-rows-2 grid-flow-col gap-x-10 gap-y-2 px-2">
      {recipe.slice(0, 4).map((key) => {
        const ing = ING_BY_KEY.get(key);
        if (!ing) return null;
        const src = artworkUrl(key) ?? iconUrls[key];
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
            className="min-h-0 min-w-0 select-none flex flex-col items-center justify-center gap-1 rounded-xl bg-white/[0.04] disabled:opacity-30 active:translate-y-[3px] active:bg-white/[0.1] transition-transform"
            style={{
              touchAction: "none",
              WebkitTouchCallout: "none",
              WebkitTapHighlightColor: "transparent",
            }}
          >
            {/* The sprite IS the control — the bottle is what the player is
                matching against the rail. The box takes whatever height the
                cell has, so the icon appearing after mount never shifts the
                target under a thumb. */}
            <span className="relative flex-1 min-h-0 w-full">
              {src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={src}
                  alt=""
                  draggable={false}
                  className="absolute inset-0 m-auto h-full max-h-[120px] w-auto max-w-full"
                  style={{
                    // The artwork is square with the bottle centred in it, so
                    // it is sized by height and its empty sides may overhang.
                    aspectRatio: "1 / 1",
                    objectFit: "contain",
                    imageRendering: artworkUrl(key) ? "auto" : "pixelated",
                    filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.6))",
                  }}
                />
              )}
            </span>
            <span
              className="shrink-0 text-[13px] font-black uppercase leading-none tracking-tight"
              style={{
                // Cream, not the ingredient's colour: rum and vermouth are
                // dark browns and reds that vanish against the black deck,
                // and the bottle above already carries the colour.
                color: "#F3E6C8",
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
}

// ─── The shake button ────────────────────────────────────────────────────────

/**
 * The big red arcade button. Two painted states, swapped on contact rather
 * than on click — a rapid tap must register the moment it lands, and the
 * pressed art has to show for exactly as long as the thumb is down.
 */
function ShakeButton({ onTap }: { onTap: () => void }) {
  const [pressed, setPressed] = useState(false);
  const release = () => setPressed(false);
  return (
    <button
      type="button"
      aria-label="Shake"
      onPointerDown={(e) => {
        e.preventDefault();
        setPressed(true);
        onTap();
      }}
      onPointerUp={release}
      onPointerLeave={release}
      onPointerCancel={release}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        touchAction: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      className="select-none w-[168px] bg-transparent p-0 border-0"
    >
      {/* Both states are in the DOM so the swap never waits on a decode. */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={DECK_ART.shake} alt="" draggable={false} className="w-full h-auto" hidden={pressed} />
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={DECK_ART.shakePressed} alt="" draggable={false} className="w-full h-auto" hidden={!pressed} />
    </button>
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
      {/* The track: the painted brass ring */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={DECK_ART.dialTrack}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute inset-0 w-full h-full pointer-events-none select-none"
      />
      <p className="absolute inset-0 flex items-center justify-center text-center text-[8px] tracking-[0.2em] uppercase text-white/40 leading-tight pointer-events-none">
        stir
      </p>
      {/* The knob that rides it */}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={DECK_ART.dialKnob}
        alt=""
        aria-hidden
        draggable={false}
        className="absolute w-[40px] h-auto pointer-events-none select-none"
        style={{
          left: "50%",
          top: "50%",
          transform: `translate(-50%,-50%) translate(${dotX}px, ${dotY}px) scale(${down ? 1.12 : 1})`,
          filter: "drop-shadow(0 3px 0 rgba(0,0,0,0.5))",
          transition: "transform 40ms linear",
        }}
      />
    </div>
  );
}

/**
 * Draw an ingredient at a given height, artwork if we have it and the
 * string-art sprite if we don't.
 *
 * `h` is the height in game pixels; the string-art sprites are 15 tall, so
 * passing 15 keeps the two paths the same size on screen.
 */
function drawIngredient(
  ctx: CanvasRenderingContext2D,
  key: string,
  cx: number,
  cy: number,
  h = 15
) {
  const art = ingredientArt(key, h);
  if (art) {
    // The cached canvas is PIXEL_SCALE times denser than the grid, so it is
    // drawn back down to logical size and lands 1:1 on device pixels.
    const w = art.width / PIXEL_SCALE;
    const hh = art.height / PIXEL_SCALE;
    ctx.drawImage(art, cx - w / 2, cy - hh / 2, w, hh);
    return;
  }
  const ing = ING_BY_KEY.get(key);
  if (ing) drawSprite(ctx, ing.sprite, Math.round(cx - 5), Math.round(cy - 7), ing.colors, 1);
}

// ─── The demo bot ────────────────────────────────────────────────────────────

/**
 * Plays the game, badly on purpose.
 *
 * A demo that plays perfectly is a worse advert than one that fumbles: nobody
 * watching a flawless run learns that missing is possible, and the strike
 * counter never moves. So this hits most notes and drops the occasional one,
 * and shakes a little above the target rather than at some impossible rate.
 *
 * It is deliberately not clever. A demo bot that models the game properly is a
 * second implementation of the rules that has to be kept in step with the
 * first; this one only reads state the player can also see.
 */
function runDemoBot(
  st: State,
  bubbles: BubbleState | null,
  dt: number,
  memo: { nextTap: number; stirAngle: number; shakeAcc: number; noteSeen: Set<number> }
) {
  switch (st.phase) {
    case "gather": {
      if (!bubbles) break;
      memo.nextTap -= dt;
      if (memo.nextTap > 0) break;
      memo.nextTap = 0.55;
      // Take a needed one most of the time, and now and then a wrong one, so
      // the "NOT THAT ONE" feedback gets shown to whoever is watching.
      const wanted = liveBubbles(bubbles).filter(
        (b) => bubbles.needed.includes(b.key) && !bubbles.collected.includes(b.key)
      );
      const wrong = liveBubbles(bubbles).filter((b) => !bubbles.needed.includes(b.key));
      const pickWrong = wrong.length > 0 && bubbles.collected.length > 0 && Math.random() < 0.18;
      const target = pickWrong ? wrong[0] : wanted[0];
      if (target) tapBubbles(bubbles, target.x, target.y);
      break;
    }

    case "pour": {
      for (const n of st.notes) {
        if (n.judged || memo.noteSeen.has(n.id)) continue;
        if (Math.abs(n.x - WINDOW_X) > GOOD_HALF) continue;
        memo.noteSeen.add(n.id);
        // One in seven goes past untouched. Three of those is a game over,
        // which is exactly the thing worth showing.
        if (Math.random() < 0.86) st.presses.push(n.ing);
      }
      break;
    }

    case "shake": {
      // A shade above the target, so the meter reads GOOD! without pinning.
      const perSecond = (st.target + 18) / 60;
      memo.shakeAcc += dt * perSecond;
      while (memo.shakeAcc >= 1) {
        st.shakeTaps++;
        memo.shakeAcc -= 1;
      }
      break;
    }

    case "stir": {
      const radiansPerSecond = ((st.target + 12) / 60) * Math.PI * 2;
      memo.stirAngle += radiansPerSecond * dt;
      applyStirAngle(st, memo.stirAngle);
      break;
    }

    default:
      // Cards and the serve run themselves.
      break;
  }
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BehindTheStick({ onGameOver, demo = false }: ArcadeGameProps) {
  const s = useRef<State>(freshState(colorFor));
  // Bubble Buster has its own simulation, rebuilt at the start of each gather
  // phase from the round's own recipe.
  const g = useRef<BubbleState | null>(null);

  // The title art. Loaded imperatively because the canvas draws it directly;
  // a React <Image> would be a second copy the frame loop can't reach.
  const botMemo = useRef({ nextTap: 0.6, stirAngle: 0, shakeAcc: 0, noteSeen: new Set<number>() });

  const logoRef = useRef<HTMLImageElement | null>(null);
  useEffect(() => {
    warmIngredientArt();
    warmStickArt();
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

      // The bot moves before the rules do, so a press it makes this frame is
      // judged this frame — the same order a real press arrives in.
      if (demo) runDemoBot(st, g.current, dt, botMemo.current);

      const { finished } = update(st, dt);

      // A demo loops instead of ending. It must never report a score: a
      // leaderboard entry from a game nobody played would be indistinguishable
      // from a cheated one.
      if (finished && demo) {
        s.current = freshState(colorFor);
        g.current = null;
        botMemo.current = { nextTap: 0.6, stirAngle: 0, shakeAcc: 0, noteSeen: new Set<number>() };
        return;
      }

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
        // What's coming, in the gap under the words: the tin going, or the
        // bartender at the mixing glass.
        if (st.cocktail.finish === "shake") {
          const frame = Math.floor(t * 5) % 2 === 0 ? "shaker-1" : "shaker-2";
          drawArtCentred(ctx, frame, 112, 206, 92);
        } else {
          drawArtStanding(ctx, "bartender-stir", 112, 244, 96);
        }
        return;
      }
      if (st.phase === "gather" && g.current) {
        drawBubbles(ctx, g.current, t);
        return;
      }

      // ── Shake, stir and serve are close-ups ───────────────────────────
      // The bar pushed back into the dark behind them. The bartender was
      // competing with the one object the player is acting on.
      if (st.phase === "shake" || st.phase === "stir" || st.phase === "serve") {
        if (st.phase === "shake") drawShake(ctx, st, t);
        else if (st.phase === "stir") drawStir(ctx, st, t);
        else drawServe(ctx, st, t);
        drawHud(ctx, st);
        // SHAKE IT! and STIR IT! already sit at the bottom of their screens.
        const repeated = st.banner === "SHAKE IT!" || st.banner === "STIR IT!";
        if (st.bannerTimer > 0 && st.banner && !repeated) drawBanner(ctx, st.banner, 112, 96);
        return;
      }

      drawBackbar(ctx, t);

      const mood = st.phase === "over" ? "panic" : st.mood;

      // Behind the counter, hands on the bar: the painted counter is drawn
      // again over his waist so he stands behind it rather than on top of it.
      const drewArt = drawArtStanding(
        ctx,
        bartenderArt(st.phase === "over" ? "over" : mood),
        112,
        COUNTER_Y + 4,
        124
      );
      if (drewArt) drawCounterOver(ctx);

      // Until the art loads, the pixel bartender stands in. Drawn at 3x, an
      // INTEGER scale — 1.5 lands sprite pixels on fractional device pixels and
      // opens hairline seams through the art.
      if (!drewArt) {
        ctx.save();
        ctx.translate(112, 232);
        ctx.scale(3, 3);
        ctx.imageSmoothingEnabled = false;
        drawBartender(ctx, 0, 0, mood, "idle", t);
        ctx.restore();
        drawTin(ctx, 172, 140, st.tinFill);
        // No guests behind the bar at all. The guest gets his own scene at the
        // serve, where the handover actually happens.
        drawBarFront(ctx);
      }

      let overArt = false;
      if (st.phase === "pour") drawRail(ctx, st, t);
      else if (st.phase === "over") overArt = drawOver(ctx, t, st.banner === "TOO SLOW!");

      for (const sp of st.splashes) {
        // Three painted frames across the splash's short life.
        const frame = (["splash-1", "splash-2", "splash-3"] as const)[
          Math.min(2, Math.floor((1 - sp.life / 0.7) * 3))
        ];
        if (!drawArtStanding(ctx, frame, sp.x, RAIL_Y + 30, 16)) {
          rect(ctx, sp.x - 3, sp.y, 6, 2, sp.color);
          rect(ctx, sp.x - 5, sp.y + 2, 2, 2, sp.color);
          rect(ctx, sp.x + 4, sp.y + 2, 2, 2, sp.color);
        }
      }
      for (const p of st.pops) {
        const art = POP_ART[p.text];
        // Kept on screen: a pop at the rail's end would otherwise hang off it.
        const px = clamp(p.x, 30, GAME_W - 30);
        if (p.text === "PERFECT") {
          const k = clamp(p.life / 0.8, 0, 1);
          drawArtCentred(ctx, "sparkle", WINDOW_X, RAIL_Y + 19, 14 + (1 - k) * 18, k);
        }
        if (!art || !drawArtCentred(ctx, art, px, p.y - 6, 56)) {
          drawText(ctx, p.text, p.x, p.y, p.color, 1, "center");
        }
      }

      drawHud(ctx, st);

      if (st.bannerTimer > 0 && st.banner && !overArt) {
        drawBanner(ctx, st.banner, 112, 96);
      }
    },
    [onGameOver, demo]
  );

  // Cards and Bubble Buster take the whole cabinet; only the phases that are
  // actually played with a control keep the 60/40 split.
  const fullScreenPhase =
    demo ||
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
    // h-full, not a viewport height. The cabinet around this owns how tall the
    // game is; picking a height here meant the screen and its container each
    // had an opinion, and the loser was the picture.
    <div className="flex flex-col h-full w-full" style={{ minHeight: 0 }}>
      <div
        className={`min-h-0 flex items-center justify-center bg-black px-2 pt-2 ${
          fullScreenPhase || demo ? "flex-1" : "flex-[4]"
        }`}
        onPointerDown={onTankTap}
        onContextMenu={(e) => e.preventDefault()}
      >
        {/*
          The aspect box lives HERE, not on the canvas. Sized by height first so
          the screen grows to whatever the row gives it, with max-width pulling
          it back on a narrow phone — aspect-ratio then shrinks the height to
          match, so the picture always fits both ways round without distorting.
        */}
        <div
          className="h-full max-h-full max-w-full"
          style={{ aspectRatio: `${GAME_W} / ${GAME_H}` }}
        >
          <CRTScreen glow="#FFA000" fill scanlines={false}>
            <ArcadeCanvas onFrame={onFrame} running fit="contain" />
          </CRTScreen>
        </div>
      </div>

      {/*
        The deck only exists when something is played on it.
        In demo mode there is never a deck — see ArcadeGameProps.demo. A card explaining
        the game, or a tank you tap directly, has no controls — leaving an empty
        40% strip under them wastes the screen and makes the card look cropped.
      */}
      <div
        hidden={fullScreenPhase || demo}
        className={`${fullScreenPhase || demo ? "hidden" : "flex"} flex-[2] min-h-0 p-2 bg-black select-none items-center justify-center`}
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
            <ShakeButton onTap={tapShake} />
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
