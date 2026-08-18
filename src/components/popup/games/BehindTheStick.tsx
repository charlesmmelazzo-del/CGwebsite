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
  beginPour,
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
  GROUND_Y as G_GROUND,
  freshGatherState,
  remaining,
  updateGather,
  type GatherInput,
  type GatherState,
} from "./gatherCore";

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
  const cy = 104;
  const r = 38;

  // The path the dot runs on. Drawn as a dotted ring so it reads as a track to
  // follow rather than as the rim of a glass.
  for (let a = 0; a < 40; a++) {
    const ang = (a / 40) * Math.PI * 2;
    rect(ctx, cx + Math.cos(ang) * r - 1, cy + Math.sin(ang) * r - 1, 2, 2, P.slate);
  }

  // The drink itself, turning inside the ring: a mixing glass with the liquid
  // swirling round at whatever rate the player is actually managing.
  rect(ctx, cx - 15, cy - 18, 30, 36, "#100810");
  rect(ctx, cx - 13, cy - 16, 26, 32, "#7FA8C0");
  rect(ctx, cx - 11, cy - 4, 22, 18, P.amber);
  // Surface, tilted by the swirl.
  const swirl = Math.sin(st.revs * Math.PI * 2) * 3;
  rect(ctx, cx - 11, cy - 5 + swirl, 22, 2, ok ? P.lime : P.tan);
  // The spoon, following the dot round.
  const lead = st.lastAngle ?? -Math.PI / 2;
  rect(ctx, cx + Math.cos(lead) * 8 - 1, cy - 22, 2, 26, "#C8C8D0");

  // The dot the player drags.
  const dx = cx + Math.cos(lead) * r;
  const dy = cy + Math.sin(lead) * r;
  rect(ctx, dx - 4, dy - 4, 8, 8, P.black);
  rect(ctx, dx - 3, dy - 3, 6, 6, ok ? P.lime : P.yellow);

  drawText(ctx, "DRAG THE DOT", cx, cy + 46, P.white, 1, "center");

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

/**
 * The order. A held card naming the drink and listing what goes in it, so the
 * player knows what they are hunting for before the shelves appear.
 */
function drawOrder(ctx: CanvasRenderingContext2D, st: State, t: number) {
  clear(ctx, "#12081F");

  drawTextMarquee(ctx, "ORDER UP!", 112, 44, P.yellow, 2, "center", P.black, P.crimson);

  // The name, split across two lines when it won't fit on one.
  const name = st.cocktail.name.toUpperCase();
  const lines = name.length > 13 ? splitName(name) : [name];
  lines.forEach((line, i) => {
    drawTextMarquee(ctx, line, 112, 84 + i * 20, P.cyan, 2, "center", P.black, "#0A4A6A");
  });

  drawText(ctx, "YOU NEED", 112, 140, P.white, 1, "center");

  // The recipe, as the bottles themselves rather than a list of words — the
  // player is about to be looking for these shapes on a shelf.
  st.cocktail.recipe.forEach((key, i) => {
    const ing = ING_BY_KEY.get(key);
    if (!ing) return;
    const x = 34 + i * 46;
    drawSprite(ctx, ing.sprite, x, 156, ing.colors, 1);
    drawText(ctx, ing.label.toUpperCase().slice(0, 7), x + 5, 176, ing.color, 1, "center");
  });

  if (blink(t, 2)) {
    drawText(ctx, "GET THE INGREDIENTS", 112, 214, P.lime, 1, "center");
  }
}

/** Break a long drink name at a space, nearest the middle. */
function splitName(name: string): string[] {
  const mid = name.length / 2;
  let best = -1;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === " " && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  if (best < 0) return [name];
  return [name.slice(0, best), name.slice(best + 1)];
}

/**
 * The shelves. Everything the bar stocks, floating in three rows, with the
 * recipe ticking off along the bottom as it's collected.
 */
function drawGather(ctx: CanvasRenderingContext2D, gs: GatherState, t: number) {
  clear(ctx, "#0E0A20");

  // Back wall, so the shelves read as being in a room.
  for (let y = 0; y < 5; y++) {
    rect(ctx, 0, 20 + y * 34, GAME_W, 1, "#1E1638");
  }

  // ── The stock ───────────────────────────────────────────────────────────
  for (const item of gs.items) {
    if (item.taken) continue;
    const ing = ING_BY_KEY.get(item.key);
    if (!ing) continue;
    const bob = Math.sin(t * 2 + item.bob) * 2;
    const needed = gs.needed.includes(item.key);

    // A quiet halo under the ones this drink actually wants. The recipe is on
    // screen anyway; this is a reading aid, not the answer.
    if (needed) {
      outline(
        ctx,
        Math.round(item.x - 8),
        Math.round(item.y - 9 + bob),
        16,
        18,
        blink(t, 2) ? P.lime : "#2A5A10"
      );
    }
    drawSprite(
      ctx,
      ing.sprite,
      Math.round(item.x - 5),
      Math.round(item.y - 7 + bob),
      ing.colors,
      1
    );
  }

  // ── The bartender ───────────────────────────────────────────────────────
  const running = Math.abs(gs.vx) > 1 && gs.onGround;
  const step = running && Math.floor(t * 8) % 2 === 0;
  drawBartender(
    ctx,
    Math.round(gs.x),
    Math.round(gs.y) + (step ? 1 : 0),
    "ok",
    gs.onGround ? "idle" : "serve",
    t
  );

  // Floor
  rect(ctx, 0, G_GROUND, GAME_W, 4, P.wood);
  rect(ctx, 0, G_GROUND, GAME_W, 1, P.tan);

  // ── Feedback on the last grab ───────────────────────────────────────────
  if (gs.flash) {
    const ing = ING_BY_KEY.get(gs.flash.key);
    drawText(
      ctx,
      gs.flash.good ? `+${ing?.label.toUpperCase() ?? "OK"}` : "NOT THAT ONE",
      112,
      G_GROUND - 44,
      gs.flash.good ? P.lime : P.red,
      1,
      "center"
    );
  }

  // ── The recipe, ticking off ─────────────────────────────────────────────
  rect(ctx, 0, G_GROUND + 4, GAME_W, GAME_H - G_GROUND - 4, "#100A1C");
  drawText(ctx, "RECIPE", 6, G_GROUND + 9, P.white, 1);

  gs.needed.forEach((key, i) => {
    const ing = ING_BY_KEY.get(key);
    if (!ing) return;
    const has = gs.collected.includes(key);
    const x = 8 + i * 54;
    const y = G_GROUND + 18;
    drawSprite(ctx, ing.sprite, x, y, ing.colors, 1);
    // A tick through the ones already in hand.
    if (has) {
      rect(ctx, x - 1, y + 7, 13, 2, P.lime);
      drawText(ctx, "OK", x + 14, y + 5, P.lime, 1);
    }
  });

  const left = remaining(gs).length;
  if (left === 0) {
    drawTextMarquee(ctx, "TO THE BAR!", 112, 120, P.lime, 2, "center", P.black, "#00551C");
  }
}


// ─── The pad ─────────────────────────────────────────────────────────────────

/**
 * A home-console controller: D-pad on the left, action button on the right,
 * both on a moulded grey body with the shoulders a real pad has.
 *
 * Directions are HELD, not tapped, so every control here is a pointerdown /
 * pointerup pair. `setPointerCapture` matters more than it looks: without it,
 * sliding a thumb off the edge of a button never fires pointerup and the
 * bartender runs into the wall forever.
 */
function GamePad({
  onDir,
  onJump,
}: {
  onDir: (d: "left" | "right" | null) => void;
  onJump: (down: boolean) => void;
}) {
  const hold = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
    fn();
  };
  const release = (fn: () => void) => (e: React.PointerEvent) => {
    e.preventDefault();
    fn();
  };

  const dpadFace =
    "absolute bg-[#2A2A32] active:bg-[#4A4A58] transition-colors select-none";

  return (
    <div
      className="h-24 flex items-center justify-between px-3 rounded-xl"
      style={{
        background: "linear-gradient(180deg,#C8C8CE,#9A9AA4)",
        boxShadow: "inset 0 2px 0 rgba(255,255,255,0.5), inset 0 -3px 0 rgba(0,0,0,0.3)",
        touchAction: "none",
      }}
    >
      {/* D-pad */}
      <div className="relative w-[76px] h-[76px]">
        <div className="absolute left-[26px] top-0 w-[24px] h-[76px] rounded-[3px] bg-[#1A1A20]" />
        <div className="absolute top-[26px] left-0 h-[24px] w-[76px] rounded-[3px] bg-[#1A1A20]" />
        <button
          aria-label="Left"
          className={`${dpadFace} left-[2px] top-[28px] w-[22px] h-[20px] rounded-l-[3px]`}
          onPointerDown={hold(() => onDir("left"))}
          onPointerUp={release(() => onDir(null))}
          onPointerCancel={release(() => onDir(null))}
          onPointerLeave={release(() => onDir(null))}
        />
        <button
          aria-label="Right"
          className={`${dpadFace} right-[2px] top-[28px] w-[22px] h-[20px] rounded-r-[3px]`}
          onPointerDown={hold(() => onDir("right"))}
          onPointerUp={release(() => onDir(null))}
          onPointerCancel={release(() => onDir(null))}
          onPointerLeave={release(() => onDir(null))}
        />
        {/* The up and down faces are dead. A real pad has four, and a pad with
            two would read as broken rather than as deliberate. */}
        <div className={`${dpadFace} left-[28px] top-[2px] w-[20px] h-[22px] rounded-t-[3px] opacity-60`} />
        <div className={`${dpadFace} left-[28px] bottom-[2px] w-[20px] h-[22px] rounded-b-[3px] opacity-60`} />
        <div className="absolute left-[32px] top-[32px] w-[12px] h-[12px] rounded-full bg-[#111]" />
      </div>

      <p className="hidden sm:block text-[7px] tracking-[0.2em] uppercase text-black/45 text-center leading-tight">
        arrows
        <br />
        + space
      </p>

      {/* Action button */}
      <button
        aria-label="Jump"
        onPointerDown={hold(() => onJump(true))}
        onPointerUp={release(() => onJump(false))}
        onPointerCancel={release(() => onJump(false))}
        onPointerLeave={release(() => onJump(false))}
        className="select-none w-[62px] h-[62px] rounded-full text-black text-[10px] font-black tracking-[0.1em] uppercase active:translate-y-[3px] active:shadow-[0_1px_0_#7A0F0A] transition-transform"
        style={{
          background: "radial-gradient(circle at 36% 30%, #FF8A80 0%, #E42B20 55%, #C01810 100%)",
          boxShadow: "0 4px 0 #7A0F0A, inset 0 0 0 2px #8A1810",
        }}
      >
        Jump
      </button>
    </div>
  );
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
    <div className="flex flex-col gap-2">
      {keys.map((key, i) => {
        const ing = ING_BY_KEY.get(key);
        if (!ing) return null;
        // Second button steps inward, so the pair sits on a diagonal.
        const indent = i === 1 ? (side === "left" ? "ml-7" : "mr-7") : "";
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
            className={`${indent} select-none w-[62px] h-[62px] rounded-full border-[3px] border-black flex flex-col items-center justify-center gap-0.5 disabled:opacity-30 active:translate-y-[3px] transition-transform`}
            style={{
              background: `radial-gradient(circle at 36% 30%, #FFFFFF 0%, ${ing.color} 52%, ${ing.color} 100%)`,
              boxShadow: `0 4px 0 rgba(0,0,0,0.55)`,
              touchAction: "manipulation",
            }}
          >
            {/* Fixed box either way, so the icon appearing after mount doesn't
                shift the button under the player's thumb. */}
            <span style={{ width: 15, height: 20 }} className="flex items-center">
              {iconUrls[key] && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={iconUrls[key]}
                  alt=""
                  width={11}
                  height={15}
                  style={{ imageRendering: "pixelated", width: 15, height: 20 }}
                />
              )}
            </span>
            <span className="text-[7px] font-black tracking-wider text-black/80 uppercase leading-none">
              {ing.label.slice(0, 6)}
            </span>
          </button>
        );
      })}
    </div>
  );

  return (
    <div className="h-24 flex items-center justify-between px-1">
      {column(left, "left")}
      {column(right, "right")}
    </div>
  );
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function BehindTheStick({ onGameOver }: ArcadeGameProps) {
  const s = useRef<State>(freshState(colorFor));
  // The platformer has its own simulation. It is rebuilt at the start of each
  // gather phase, from the round's own recipe.
  const g = useRef<GatherState | null>(null);
  const gIn = useRef<GatherInput>({ left: false, right: false, jump: false });
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

      // The shelves: arrows to run, space to jump. Held, so the release
      // handler below matters as much as this one.
      if (st.phase === "gather") {
        if (key === "ArrowLeft") gIn.current.left = true;
        else if (key === "ArrowRight") gIn.current.right = true;
        else if (key === " " || key === "Spacebar" || key === "ArrowUp") gIn.current.jump = true;
        return;
      }

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
    (key) => {
      if (key === "ArrowLeft") gIn.current.left = false;
      else if (key === "ArrowRight") gIn.current.right = false;
      else if (key === " " || key === "Spacebar" || key === "ArrowUp") gIn.current.jump = false;
    }
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
        if (!g.current) g.current = freshGatherState(st.cocktail.recipe);
        updateGather(g.current, dt, gIn.current);
        if (g.current.done) {
          st.score += g.current.score;
          g.current = null;
          beginPour(st);
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
      if (st.phase === "order") {
        drawOrder(ctx, st, t);
        return;
      }
      if (st.phase === "gather" && g.current) {
        drawGather(ctx, g.current, t);
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
        {uiPhase === "gather" ? (
          // ── The pad ──────────────────────────────────────────────────────
          // A home-console controller: D-pad left, action button right, both
          // sat on a moulded body. Held rather than tapped, so these are
          // pointer-down/up pairs and not clicks.
          <GamePad
            onDir={(d) => {
              gIn.current.left = d === "left";
              gIn.current.right = d === "right";
            }}
            onJump={(down) => {
              gIn.current.jump = down;
            }}
          />
        ) : uiPhase === "shake" ? (
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
          <p className="h-24 flex items-center justify-center text-center text-[11px] tracking-widest uppercase text-white/50 leading-relaxed px-4">
            Drag the dot around the glass
          </p>
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
