// ─── Behind the Stick — drawing ──────────────────────────────────────────────
//
// Reads the State and paints it. Nothing here changes a score or decides
// anything; see core.ts for that. Every sprite has a code-drawn stand-in so the
// game is complete before a single piece of new art arrives.

import { blink, drawText, drawTextMarquee, textWidth } from "../arcade";
import { INGREDIENT_LABELS, type IngredientKey } from "../cocktails";
import { colorFor } from "../ingredients";
import { ART, drawImgCentred } from "./art";
import * as K from "./constants";
import {
  laneButtonX,
  LANE_BUTTON_Y,
  level,
  type Falling,
  type Fx,
  type State,
} from "./core";
import {
  BEER_LINE,
  BEER_TARGET,
  beerFlow,
  MICRO_HINT,
  MICRO_TITLE,
  popLandX,
  POP_BUCKET_HALF,
  POP_FLIGHT,
  POP_PIVOT_DY,
  POP_TARGET_Y,
  SHOT_SPILL_MAX,
  type BeerSim,
  type PopSim,
  type ShotsSim,
} from "./micro";

type Ctx = CanvasRenderingContext2D;

export const LANE_COLORS = ["#E8352A", "#FFC928", "#3A8BFF", "#F4E9CF"];
const GOLD = "#FFD500";
const RED = "#FF4A3A";
const LIME = "#9CE800";
const CREAM = "#FFF4DC";
const INK = "#140A06";

// ─── Small helpers ───────────────────────────────────────────────────────────

function fill(ctx: Ctx, x: number, y: number, w: number, h: number, c: string) {
  ctx.fillStyle = c;
  ctx.fillRect(x, y, w, h);
}

function roundRect(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function circle(ctx: Ctx, x: number, y: number, r: number, c: string) {
  ctx.fillStyle = c;
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Marquee text at any scale, centred. */
function say(ctx: Ctx, text: string, x: number, y: number, color: string, scale: number, shadow = true) {
  drawTextMarquee(ctx, text, x, y, color, scale, "center", INK, shadow ? "rgba(0,0,0,0.55)" : undefined);
}

/** Largest scale (in half steps) that fits `text` in `maxW`. */
function fitScale(text: string, maxW: number, max: number): number {
  let s = max;
  while (s > 1 && textWidth(text, s) > maxW) s -= 0.5;
  return s;
}

function meterBar(ctx: Ctx, x: number, y: number, w: number, h: number, f: number, color: string) {
  fill(ctx, x - 1, y - 1, w + 2, h + 2, INK);
  fill(ctx, x, y, w, h, "#3A2A20");
  fill(ctx, x, y, Math.max(0, Math.min(1, f)) * w, h, color);
  fill(ctx, x, y, w, 1, "rgba(255,255,255,0.25)");
}

/** A bottle, from the painted art or a stand-in in the ingredient's colour. */
function bottle(ctx: Ctx, s: number, ing: string, cx: number, cy: number, h: number) {
  if (drawImgCentred(ctx, s, ART.ingredient(ing), cx, cy, h * 1.35)) return;
  const w = h * 0.38;
  const c = colorFor(ing);
  roundRect(ctx, cx - w / 2, cy - h * 0.2, w, h * 0.7, 4);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, cx - w / 2 + 2, cy - h * 0.2 + 2, w - 4, h * 0.7 - 4, 3);
  ctx.fillStyle = c;
  ctx.fill();
  fill(ctx, cx - w * 0.18, cy - h * 0.5, w * 0.36, h * 0.32, INK);
  fill(ctx, cx - w * 0.12, cy - h * 0.48, w * 0.24, h * 0.3, c);
  fill(ctx, cx - w / 2 + 3, cy, w - 6, h * 0.2, CREAM);
  const label = (INGREDIENT_LABELS[ing as IngredientKey] ?? ing).slice(0, 3);
  drawText(ctx, label, cx, cy + 3, INK, 1, "center");
}

// ─── Scene ───────────────────────────────────────────────────────────────────

function drawPanel(ctx: Ctx, x: number, w: number, tint: string) {
  const g = ctx.createLinearGradient(x, 0, x + w, 0);
  g.addColorStop(0, "#15100E");
  g.addColorStop(0.5, "#221815");
  g.addColorStop(1, "#15100E");
  ctx.fillStyle = g;
  ctx.fillRect(x, 0, w, K.H);
  // Bar mat dots
  ctx.fillStyle = "rgba(255,255,255,0.05)";
  for (let yy = 8; yy < K.H; yy += 14) {
    for (let xx = x + 8 + ((yy / 14) % 2) * 7; xx < x + w - 4; xx += 14) ctx.fillRect(xx, yy, 3, 3);
  }
  fill(ctx, x, 0, w, K.H, tint);
  // Brass edges
  fill(ctx, x, 0, 2, K.H, "#8A6428");
  fill(ctx, x + w - 2, 0, 2, K.H, "#8A6428");
}

function drawCentreBack(ctx: Ctx, st: State, t: number) {
  const l = st.layout;
  const g = ctx.createLinearGradient(0, 0, 0, K.H);
  g.addColorStop(0, "#2A1030");
  g.addColorStop(0.55, "#3A1A12");
  g.addColorStop(1, "#1A0C08");
  ctx.fillStyle = g;
  ctx.fillRect(l.side, 0, l.rightX - l.side, K.H);
  // Back-bar shelves, dim
  for (let s = 0; s < 3; s++) {
    const y = 48 + s * 44;
    fill(ctx, l.side, y, l.rightX - l.side, 3, "#5A3418");
    for (let b = 0; b < 14; b++) {
      const bx = l.side + 10 + b * ((l.rightX - l.side - 20) / 14);
      const hue = ["#6A2A1A", "#2A5A5A", "#6A5A1A", "#3A2A6A"][(b + s) % 4];
      fill(ctx, bx, y - 18, 8, 18, hue);
      fill(ctx, bx + 2, y - 24, 4, 6, hue);
    }
  }
  // Warm lamp glow that breathes
  const pulse = 0.12 + Math.sin(t * 1.3) * 0.03;
  const rg = ctx.createRadialGradient(l.w / 2, 40, 10, l.w / 2, 40, 260);
  rg.addColorStop(0, `rgba(255,170,60,${pulse})`);
  rg.addColorStop(1, "rgba(255,170,60,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(l.side, 0, l.rightX - l.side, K.H);
}

// ─── HUD ─────────────────────────────────────────────────────────────────────

function drawHud(ctx: Ctx, st: State, s: number) {
  const l = st.layout;
  const cx = l.w / 2;
  fill(ctx, cx - 70, 0, 140, 22, "rgba(0,0,0,0.55)");
  say(ctx, String(st.score).padStart(6, "0"), cx, 4, GOLD, 2, false);

  if (st.mode === "solo") {
    for (let i = 0; i < K.SOLO_LIVES; i++) {
      const x = l.side + 8 + i * 20;
      const alive = i < st.lives;
      if (!drawImgCentred(ctx, s, alive ? ART.life : ART.lifeLost, x + 8, 12, 16)) {
        circle(ctx, x + 8, 12, 6, alive ? RED : "#553333");
      }
    }
  } else {
    const p = st.players[st.current];
    if (p) {
      const name = p.name.toUpperCase();
      drawTextMarquee(ctx, name, l.side + 8, 6, CREAM, 1.5, "left", INK);
    }
    const left = st.players.filter((q) => q.alive).length;
    drawText(ctx, `${left}/${st.players.length} IN`, l.side + 8, 20, "#C8B89A", 1, "left");
  }
  drawText(ctx, `DRINK ${level(st)}`, l.rightX - 8, 24, "#C8B89A", 1, "right");
}

// ─── Grab ────────────────────────────────────────────────────────────────────

function drawItem(ctx: Ctx, s: number, st: State, it: Falling, t: number) {
  const l = st.layout;
  const x = K.panelX(l, it.side) + it.x * l.side;
  const y = it.y;
  const h = K.ITEM_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(it.spin);
  switch (it.kind) {
    case "bottle":
      bottle(ctx, s, it.ing ?? "ice", 0, 0, h);
      break;
    case "can":
      roundRect(ctx, -10, -15, 20, 30, 3);
      ctx.fillStyle = INK;
      ctx.fill();
      fill(ctx, -8, -13, 16, 26, "#B8C0C8");
      fill(ctx, -8, -4, 16, 8, "#C83A2A");
      fill(ctx, -2, -13, 3, 26, "#8890A0");
      fill(ctx, -9, 2, 7, 3, INK);
      break;
    case "glass":
      ctx.fillStyle = INK;
      ctx.beginPath();
      ctx.moveTo(-14, -12);
      ctx.lineTo(-4, -18);
      ctx.lineTo(0, -8);
      ctx.lineTo(8, -17);
      ctx.lineTo(14, -12);
      ctx.lineTo(11, 16);
      ctx.lineTo(-11, 16);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#BCE6F4";
      ctx.beginPath();
      ctx.moveTo(-11, -9);
      ctx.lineTo(-4, -14);
      ctx.lineTo(0, -4);
      ctx.lineTo(8, -13);
      ctx.lineTo(11, -9);
      ctx.lineTo(9, 13);
      ctx.lineTo(-9, 13);
      ctx.closePath();
      ctx.fill();
      fill(ctx, -6, -6, 2, 16, "#FFFFFF");
      break;
    case "napkin":
      fill(ctx, -14, -12, 28, 24, INK);
      fill(ctx, -12, -10, 24, 20, "#F2EEE4");
      fill(ctx, 2, -4, 8, 4, "#C83A5A");
      fill(ctx, -12, 6, 10, 4, "#CFC8B8");
      break;
    case "phone":
      roundRect(ctx, -10, -17, 20, 34, 4);
      ctx.fillStyle = INK;
      ctx.fill();
      fill(ctx, -7, -13, 14, 24, "#2A3A5A");
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.moveTo(-6, -10);
      ctx.lineTo(1, -1);
      ctx.lineTo(-3, 4);
      ctx.lineTo(6, 10);
      ctx.stroke();
      if (blink(t, 10)) {
        fill(ctx, -15, -6, 3, 2, CREAM);
        fill(ctx, 12, 4, 3, 2, CREAM);
      }
      break;
    case "vodka":
    case "jug": {
      const big = it.kind === "jug";
      const w = big ? 30 : 20;
      const hh = big ? 38 : 40;
      roundRect(ctx, -w / 2, -hh / 2 + 8, w, hh - 8, big ? 6 : 3);
      ctx.fillStyle = INK;
      ctx.fill();
      roundRect(ctx, -w / 2 + 2, -hh / 2 + 10, w - 4, hh - 12, big ? 5 : 2);
      ctx.fillStyle = "#DCE8E8";
      ctx.fill();
      fill(ctx, -4, -hh / 2 - 2, 8, 12, INK);
      fill(ctx, -2, -hh / 2, 4, 9, "#DCE8E8");
      ctx.save();
      ctx.rotate(-0.12);
      fill(ctx, -w / 2 + 1, -2, w - 2, 12, "#FFFFFF");
      drawText(ctx, big ? "VODKUH" : "VODKA", 0, 1, "#3A3AC0", big ? 0.75 : 0.62, "center");
      ctx.restore();
      // Flies
      for (let i = 0; i < 3; i++) {
        const a = t * 6 + i * 2.1;
        fill(ctx, Math.cos(a) * 16 - 1, -hh / 2 + Math.sin(a * 1.3) * 6 - 4, 2, 2, INK);
      }
      break;
    }
    case "bomb": {
      circle(ctx, 0, 3, 15, INK);
      circle(ctx, 0, 3, 13, "#2A2A34");
      circle(ctx, -5, -2, 4, "#5A5A6A");
      fill(ctx, -3, -14, 6, 5, "#6A6A70");
      ctx.strokeStyle = "#C8A060";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -14);
      ctx.quadraticCurveTo(6, -22, 10, -20);
      ctx.stroke();
      const big = blink(t, 8);
      circle(ctx, 10, -20, big ? 5 : 3, big ? GOLD : "#FF7B00");
      break;
    }
    case "tips":
      roundRect(ctx, -13, -14, 26, 30, 4);
      ctx.fillStyle = INK;
      ctx.fill();
      roundRect(ctx, -11, -12, 22, 26, 3);
      ctx.fillStyle = "#E8B830";
      ctx.fill();
      fill(ctx, -8, -18, 6, 10, "#5AA04A");
      fill(ctx, 1, -20, 6, 12, "#6AB05A");
      say(ctx, "$", 0, -3, "#FFF6C0", 1.4, false);
      break;
    case "cherry":
      ctx.strokeStyle = "#5A3A10";
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(2, -16, 10, -18);
      ctx.stroke();
      circle(ctx, 0, 6, 12, INK);
      circle(ctx, 0, 6, 10, "#FFB800");
      circle(ctx, -3, 2, 3, "#FFF6C0");
      if (blink(t, 4)) {
        fill(ctx, 11, -6, 2, 8, "#FFFFFF");
        fill(ctx, 8, -3, 8, 2, "#FFFFFF");
      }
      break;
    case "ice":
      fill(ctx, -15, -15, 30, 30, INK);
      fill(ctx, -13, -13, 26, 26, "#BDEBFF");
      fill(ctx, -13, -13, 26, 6, "#FFFFFF");
      fill(ctx, 4, -2, 5, 9, "#8FD0F0");
      break;
    case "watch":
      circle(ctx, 0, 2, 15, INK);
      circle(ctx, 0, 2, 13, "#D8A840");
      circle(ctx, 0, 2, 10, CREAM);
      fill(ctx, -2, -17, 4, 6, "#D8A840");
      fill(ctx, -1, -5, 2, 8, INK);
      fill(ctx, -1, 1, 7, 2, INK);
      break;
  }
  ctx.restore();
}

function drawGrabPanel(ctx: Ctx, s: number, st: State, side: 0 | 1, t: number) {
  const l = st.layout;
  const g = st.grab;
  const x = K.panelX(l, side);
  drawPanel(ctx, x, l.side, g.iceT > 0 ? "rgba(120,200,255,0.12)" : "rgba(0,0,0,0)");
  for (const it of g.items) if (it.side === side) drawItem(ctx, s, st, it, t);

  if (g.stinkT[side] > 0) {
    const a = Math.min(1, g.stinkT[side] / 0.6) * 0.62;
    ctx.fillStyle = `rgba(150,160,40,${a})`;
    ctx.fillRect(x, 0, l.side, K.H);
    for (let i = 0; i < 6; i++) {
      const yy = ((t * 40 + i * 60) % (K.H + 40)) - 20;
      const xx = x + l.side * (0.15 + ((i * 37) % 70) / 100);
      circle(ctx, xx, K.H - yy, 22 + (i % 3) * 8, `rgba(120,130,30,${a})`);
    }
    say(ctx, "PEE-YOO!", x + l.side / 2, K.H / 2 - 8, "#E8F060", 2);
  }
}

/** The order ticket in the centre: what to grab, and what's been got. */
function drawTicket(ctx: Ctx, s: number, st: State, label: string, t: number) {
  const l = st.layout;
  const g = st.grab;
  const cw = l.rightX - l.side;
  const w = Math.min(cw - 24, 300);
  const x = l.w / 2 - w / 2;
  const y = 44;
  const h = 190;
  ctx.save();
  ctx.translate(l.w / 2, y + h / 2);
  ctx.rotate(Math.sin(t * 1.4) * 0.012);
  ctx.translate(-l.w / 2, -(y + h / 2));
  fill(ctx, x + 4, y + 5, w, h, "rgba(0,0,0,0.45)");
  fill(ctx, x, y, w, h, "#F5EAD0");
  for (let i = 0; i < w; i += 8) fill(ctx, x + i, y - 3, 4, 3, "#F5EAD0");
  fill(ctx, l.w / 2 - 16, y - 8, 32, 10, "#B8903A");

  drawText(ctx, label, l.w / 2, y + 8, "#8A6A4A", 1, "center");
  const name = st.order.name.toUpperCase();
  drawText(ctx, name, l.w / 2, y + 20, INK, fitScale(name, w - 24, 2), "center");

  const n = st.order.recipe.length;
  const slot = (w - 16) / n;
  const by = y + 80;
  st.order.recipe.forEach((ing, i) => {
    const cx = x + 8 + slot * (i + 0.5);
    const got = g.got.includes(ing);
    if (got) circle(ctx, cx, by + 2, 26, "rgba(156,232,0,0.25)");
    ctx.globalAlpha = got ? 0.45 : 1;
    bottle(ctx, s, ing, cx, by, 46);
    ctx.globalAlpha = 1;
    const lab = (INGREDIENT_LABELS[ing as IngredientKey] ?? ing).toUpperCase();
    drawText(ctx, lab, cx, by + 36, INK, fitScale(lab, slot - 4, 1), "center");
    if (got) {
      ctx.strokeStyle = "#3A8A10";
      ctx.lineWidth = 5;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 12, by);
      ctx.lineTo(cx - 3, by + 10);
      ctx.lineTo(cx + 14, by - 14);
      ctx.stroke();
    }
  });

  const f = g.timeLeft / g.timeMax;
  meterBar(ctx, x + 14, y + 150, w - 28, 10, f, f < 0.3 ? (blink(t, 6) ? RED : "#A02010") : "#E89A20");
  const method = st.order.finish === "shake" ? "SHAKEN" : "STIRRED";
  drawText(ctx, method, l.w / 2, y + 168, "#8A6A4A", 1, "center");
  ctx.restore();

  if (g.done) {
    say(ctx, "ORDER READY!", l.w / 2, y + h + 14, LIME, 2);
  }
}

// ─── Build ───────────────────────────────────────────────────────────────────

const VP_Y = 26;
/** Perspective: 0 far .. 1 at the line. */
function persp(z: number): number {
  const D = 2.6;
  const zz = Math.max(-0.2, Math.min(1.15, z));
  return (1 / (D - zz * (D - 1)) - 1 / D) / (1 - 1 / D);
}

function lanePoint(st: State, lane: number, z: number) {
  const f = persp(z);
  const bx = laneButtonX(st.layout, lane);
  return {
    x: st.layout.w / 2 + (bx - st.layout.w / 2) * f,
    y: VP_Y + (LANE_BUTTON_Y - VP_Y) * f,
    scale: 0.18 + 0.82 * f,
  };
}

function drawBuild(ctx: Ctx, s: number, st: State, t: number, frozen: boolean) {
  const l = st.layout;
  const b = st.build;
  fill(ctx, 0, 0, l.w, K.H, "#120812");
  const rg = ctx.createRadialGradient(l.w / 2, VP_Y, 4, l.w / 2, VP_Y, 200);
  rg.addColorStop(0, "rgba(255,190,90,0.5)");
  rg.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, l.w, 220);
  if (!b) return;

  // Lane rails, with beat ticks rolling toward the player
  for (let lane = 0; lane < K.LANES; lane++) {
    const bx = laneButtonX(l, lane);
    const halfBottom = 26;
    ctx.fillStyle = lane % 2 === 0 ? "#3A2014" : "#301A10";
    ctx.beginPath();
    ctx.moveTo(l.w / 2 - 1, VP_Y);
    ctx.lineTo(l.w / 2 + 1, VP_Y);
    ctx.lineTo(bx + halfBottom, LANE_BUTTON_Y);
    ctx.lineTo(bx - halfBottom, LANE_BUTTON_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = LANE_COLORS[lane];
    ctx.globalAlpha = 0.5;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
    const beat = K.beatSeconds(level(st));
    for (let k = 0; k < 8; k++) {
      const z = 1 - (((k * beat - (b.clock % beat) + beat) / b.travel) % (8 * beat / b.travel));
      if (z < 0 || z > 1) continue;
      const p = lanePoint(st, lane, z);
      fill(ctx, p.x - 20 * p.scale, p.y, 40 * p.scale, Math.max(1, 2 * p.scale), "rgba(255,220,160,0.18)");
    }
  }

  // Notes, far ones first
  const notes = b.notes
    .filter((n) => !n.judged || (n.judged === "miss" && b.clock - n.t < 0.3))
    .map((n) => ({ n, z: 1 - (n.t - b.clock) / b.travel }))
    .filter(({ z }) => z >= 0 && z <= 1.25)
    .sort((a, c) => a.z - c.z);
  for (const { n, z } of notes) {
    const p = lanePoint(st, n.lane, z);
    const r = 24 * p.scale;
    ctx.globalAlpha = n.judged === "miss" ? 0.35 : 1;
    circle(ctx, p.x, p.y, r + 2, INK);
    circle(ctx, p.x, p.y, r, LANE_COLORS[n.lane]);
    circle(ctx, p.x, p.y - r * 0.25, r * 0.7, "rgba(255,255,255,0.25)");
    bottle(ctx, s, st.order.recipe[n.lane], p.x, p.y - 2 * p.scale, 34 * p.scale);
    ctx.globalAlpha = 1;
  }

  // Buttons
  for (let lane = 0; lane < K.LANES; lane++) {
    const bx = laneButtonX(l, lane);
    const since = b.clock - b.pressedAt[lane];
    const lit = since >= 0 && since < 0.12;
    circle(ctx, bx, LANE_BUTTON_Y + 3, 31, INK);
    circle(ctx, bx, LANE_BUTTON_Y + 3, 29, "#B8903A");
    circle(ctx, bx, LANE_BUTTON_Y + (lit ? 3 : 0), 24, lit ? "#FFFFFF" : LANE_COLORS[lane]);
    circle(ctx, bx, LANE_BUTTON_Y - 5 + (lit ? 3 : 0), 15, "rgba(255,255,255,0.22)");
    bottle(ctx, s, st.order.recipe[lane], bx, LANE_BUTTON_Y + (lit ? 3 : 0), 30);
  }

  // The drink's name and the combo, top centre under the score
  const name = st.order.name.toUpperCase();
  drawText(ctx, name, l.w / 2, 30, CREAM, 1, "center");
  if (b.combo >= 5) say(ctx, `${b.combo} COMBO`, l.w / 2, 44, b.combo >= 15 ? GOLD : LIME, 1.5);
  if (frozen) fill(ctx, 0, 0, l.w, K.H, "rgba(0,0,0,0.5)");
}

// ─── Finish ──────────────────────────────────────────────────────────────────

function drawFinishPanel(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  const x = l.rightX;
  const cx = x + l.side / 2;
  drawPanel(ctx, x, l.side, "rgba(40,120,200,0.06)");
  const f = st.finish;
  if (!f) {
    say(ctx, "SERVED!", cx, K.H / 2 - 8, LIME, 2);
    return;
  }

  if (f.result) {
    const ok = f.result === "served";
    const bob = Math.sin(f.resultT * 8) * 3;
    if (ok) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 2;
        const r = 40 + f.resultT * 30;
        fill(ctx, cx + Math.cos(a) * r - 2, K.H * 0.45 + Math.sin(a) * r - 2, 4, 4, GOLD);
      }
      if (!drawImgCentred(ctx, s, ART.drink(f.cocktail.key), cx, K.H * 0.45 + bob, 110)) {
        circle(ctx, cx, K.H * 0.45, 30, "#E8A040");
      }
    }
    say(ctx, ok ? "SERVED!" : f.cocktail.finish === "shake" ? "WATERY!" : "TOO WARM!", cx, K.H * 0.75, ok ? LIME : RED, 2);
    return;
  }

  const shake = f.cocktail.finish === "shake";
  say(ctx, shake ? "SHAKE!" : "STIR!", cx, 36, GOLD, 2);

  if (shake) {
    const y = 70 + f.tinY * (K.H - 150);
    const moving = f.pointer !== null;
    const art = moving && Math.floor(f.strokes) % 2 === 1 ? ART.shaker2 : ART.shaker1;
    if (!drawImgCentred(ctx, s, art, cx, y + 40, 120)) {
      roundRect(ctx, cx - 18, y, 36, 80, 6);
      ctx.fillStyle = INK;
      ctx.fill();
      roundRect(ctx, cx - 15, y + 3, 30, 74, 5);
      ctx.fillStyle = "#C8D0D8";
      ctx.fill();
      fill(ctx, cx - 8, y + 6, 4, 68, "#FFFFFF");
    }
    // Frost creeping up the tin as the meter fills
    ctx.fillStyle = `rgba(230,245,255,${f.meter * 0.45})`;
    ctx.fillRect(cx - 22, y + 80 - f.meter * 75, 44, f.meter * 75);
    if (moving) {
      for (let i = 0; i < 3; i++) fill(ctx, cx - 36 - i * 6, y + 20 + i * 14, 2, 18, "rgba(255,255,255,0.5)");
    } else if (blink(t, 2)) {
      say(ctx, "DRAG", cx, K.H - 64, CREAM, 1.5);
      say(ctx, "UP + DOWN", cx, K.H - 48, CREAM, 1.5);
    }
  } else {
    const c = { x: cx, y: K.H * 0.52 };
    if (!drawImgCentred(ctx, s, ART.mixingGlass, c.x, c.y + 20, 120)) {
      fill(ctx, c.x - 28, c.y - 30, 56, 80, INK);
      fill(ctx, c.x - 25, c.y - 27, 50, 74, "#9CC8E0");
      fill(ctx, c.x - 25, c.y, 50, 47, "#C8702A");
    }
    ctx.strokeStyle = "rgba(255,213,0,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = f.lastAngle ?? t * 2;
    const sx = c.x + Math.cos(a) * 18;
    const sy = c.y + Math.sin(a) * 8 - 50;
    ctx.strokeStyle = "#D8D8E0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(sx, sy);
    ctx.lineTo(c.x + Math.cos(a) * 10, c.y + 10);
    ctx.stroke();
    const tx = c.x + Math.cos(a) * 46;
    const ty = c.y + Math.sin(a) * 46;
    circle(ctx, tx, ty, 8, f.pointer !== null ? GOLD : "rgba(255,213,0,0.5)");
    if (f.pointer === null && blink(t, 2)) say(ctx, "CIRCLES!", cx, K.H - 40, CREAM, 1.5);
  }

  // Meter up the inside edge, time along the bottom
  meterBar(ctx, x + 8, 60, 8, K.H - 120, 0, "#000");
  const mh = (K.H - 120) * f.meter;
  fill(ctx, x + 8, 60 + (K.H - 120) - mh, 8, mh, shake ? "#BDEBFF" : "#E8A040");
  const tf = f.timeLeft / K.FINISH_SECONDS;
  meterBar(ctx, x + 14, K.H - 18, l.side - 28, 7, tf, tf < 0.3 && blink(t, 6) ? RED : "#E89A20");
}

function drawWaitingPanel(ctx: Ctx, st: State, t: number) {
  const l = st.layout;
  drawPanel(ctx, 0, l.side, "rgba(156,232,0,0.06)");
  const cx = l.side / 2;
  circle(ctx, cx, K.H / 2 - 20, 26, "#3A8A10");
  ctx.strokeStyle = "#FFFFFF";
  ctx.lineWidth = 6;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 12, K.H / 2 - 20);
  ctx.lineTo(cx - 3, K.H / 2 - 10);
  ctx.lineTo(cx + 13, K.H / 2 - 32);
  ctx.stroke();
  say(ctx, "GOT IT!", cx, K.H / 2 + 16, LIME, 2);
  if (blink(t, 2)) drawText(ctx, "FINISH THE DRINK", cx, K.H / 2 + 40, CREAM, 1, "center");
}

// ─── Micro games ─────────────────────────────────────────────────────────────

const MICRO_BG: Record<string, [string, string]> = {
  beer: ["#FF9A1A", "#C85A00"],
  shots: ["#9A3AE0", "#5A1A9A"],
  pop: ["#FFC928", "#D8761A"],
};

function burst(ctx: Ctx, w: number, a: string, b: string, t: number) {
  fill(ctx, 0, 0, w, K.H, b);
  ctx.fillStyle = a;
  const cx = w / 2;
  const cy = K.H / 2;
  for (let i = 0; i < 16; i++) {
    const a0 = (i / 16) * Math.PI * 2 + t * 0.8;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.arc(cx, cy, w, a0, a0 + Math.PI / 16);
    ctx.closePath();
    ctx.fill();
  }
}

function drawMicro(ctx: Ctx, s: number, st: State, t: number) {
  const m = st.micro;
  if (!m) return;
  const w = st.layout.w;
  const [a, b] = MICRO_BG[m.kind];

  if (m.phase === "intro") {
    burst(ctx, w, a, b, t);
    const pop = Math.min(1, m.t / 0.18);
    const title = MICRO_TITLE[m.kind];
    const sc = fitScale(title, w - 40, 6) * (0.6 + 0.4 * pop);
    const wob = Math.sin(t * 20) * 2;
    say(ctx, title, w / 2 + wob, K.H / 2 - 50, CREAM, sc);
    const hint = MICRO_HINT[m.kind];
    say(ctx, hint, w / 2, K.H / 2 + 30, "#FFFFFF", fitScale(hint, w - 40, 2));
    meterBar(ctx, w / 2 - 80, K.H - 40, 160, 8, 1 - m.t / K.MICRO_INTRO, CREAM);
    return;
  }

  if (m.phase === "result") {
    burst(ctx, w, m.won ? "#7AD81A" : "#E8352A", m.won ? "#3A8A10" : "#7A1010", t);
    const pop = 1 + Math.max(0, 0.4 - m.t) * 1.5;
    say(ctx, m.won ? "SUCCESS!" : "FAIL!", w / 2, K.H / 2 - 40, m.won ? GOLD : CREAM, 6 * pop);
    const pts = m.won ? `+${K.microWin(level(st))}` : `${K.PTS_MICRO_FAIL}`;
    say(ctx, pts, w / 2, K.H / 2 + 34, CREAM, 3);
    return;
  }

  if (m.phase === "resume") {
    drawBuild(ctx, s, st, t, true);
    say(ctx, "BACK TO IT!", w / 2, K.H / 2 - 20, GOLD, 4);
    return;
  }

  const sim = m.sim;
  if (sim.kind === "beer") drawBeer(ctx, s, sim, w, t);
  else if (sim.kind === "shots") drawShots(ctx, s, sim, w, t);
  else drawPop(ctx, s, sim, w, t);
  meterBar(ctx, w / 2 - 100, 8, 200, 8, 1 - sim.t / sim.duration, CREAM);
}

function barScene(ctx: Ctx, w: number, top: string, counterY: number) {
  const g = ctx.createLinearGradient(0, 0, 0, counterY);
  g.addColorStop(0, top);
  g.addColorStop(1, "#1A0C08");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, counterY);
  fill(ctx, 0, counterY, w, K.H - counterY, "#6A3A18");
  fill(ctx, 0, counterY, w, 4, "#C88A48");
  fill(ctx, 0, counterY + 4, w, 3, "#3A1A08");
}

function drawBeer(ctx: Ctx, s: number, sim: BeerSim, w: number, t: number) {
  const counter = K.H - 40;
  barScene(ctx, w, "#3A2410", counter);
  const gx = w / 2;
  const gw = 86;
  const gh = 170;
  const top = counter - gh;
  // Glass body, then beer and foam inside it
  ctx.fillStyle = "rgba(200,230,255,0.18)";
  ctx.beginPath();
  ctx.moveTo(gx - gw / 2, top);
  ctx.lineTo(gx + gw / 2, top);
  ctx.lineTo(gx + gw / 2 - 10, counter);
  ctx.lineTo(gx - gw / 2 + 10, counter);
  ctx.closePath();
  ctx.fill();
  ctx.save();
  ctx.clip();
  const lh = sim.liquid * gh;
  const fh = sim.foam * gh;
  fill(ctx, gx - gw, counter - lh, gw * 2, lh, "#E89A10");
  for (let i = 0; i < 6; i++) {
    const by = counter - ((t * 40 + i * 29) % Math.max(1, lh));
    fill(ctx, gx - 30 + ((i * 17) % 60), by, 3, 3, "rgba(255,240,180,0.6)");
  }
  fill(ctx, gx - gw, counter - lh - fh, gw * 2, fh, "#FFF8E8");
  ctx.restore();
  ctx.strokeStyle = "#E8F4FF";
  ctx.lineWidth = 3;
  ctx.stroke();

  // The foam line, and the tick for "full enough"
  const ly = counter - BEER_LINE * gh;
  ctx.strokeStyle = RED;
  ctx.lineWidth = 2;
  ctx.setLineDash([8, 5]);
  ctx.beginPath();
  ctx.moveTo(gx - gw / 2 - 30, ly);
  ctx.lineTo(gx + gw / 2 + 30, ly);
  ctx.stroke();
  ctx.setLineDash([]);
  drawText(ctx, "TOO MUCH FOAM", gx + gw / 2 + 34, ly - 3, RED, 1, "left");
  const ty = counter - BEER_TARGET * gh;
  fill(ctx, gx - gw / 2 - 16, ty - 1, 10, 3, LIME);
  drawText(ctx, "FULL", gx - gw / 2 - 20, ty - 3, LIME, 1, "right");

  // The bottle, tipping over the rim
  const angle = sim.tilt * 2.3;
  ctx.save();
  ctx.translate(gx - 20, top - 16);
  ctx.rotate(angle);
  roundRect(ctx, -14, -80, 28, 64, 6);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, -11, -77, 22, 58, 5);
  ctx.fillStyle = "#6A3A10";
  ctx.fill();
  fill(ctx, -7, -16, 14, 18, INK);
  fill(ctx, -5, -14, 10, 16, "#6A3A10");
  fill(ctx, -10, -60, 20, 18, CREAM);
  ctx.restore();
  if (beerFlow(sim.tilt).flow > 0) {
    const px = gx - 20 + Math.sin(angle) * 2;
    fill(ctx, px - 2, top - 10, 4, counter - sim.liquid * gh - top + 10, "#F0A820");
  }

  // The thumb slider down the right edge
  const sx = w - 40;
  fill(ctx, sx - 4, 50, 8, K.H - 110, "rgba(0,0,0,0.5)");
  const ky = K.H - 40 - sim.aim * (K.H - 100);
  circle(ctx, sx, ky, 16, sim.pointer !== null ? GOLD : CREAM);
  drawText(ctx, "TILT", sx, 34, CREAM, 1.5, "center");
  if (sim.pointer === null && blink(t, 2)) say(ctx, "HOLD + SLIDE UP", w * 0.2, K.H / 2, CREAM, 1.5);
}

function drawShots(ctx: Ctx, s: number, sim: ShotsSim, w: number, t: number) {
  const counter = K.H - 60;
  barScene(ctx, w, "#2A1040", counter);
  for (let i = 0; i < 20; i++) {
    const c = ["#FF4AB0", "#4AE0FF", "#FFD500"][i % 3];
    circle(ctx, ((i * 97) % w), 30 + ((i * 53) % 120), 3 + Math.sin(t * 3 + i) * 1.5, c);
  }
  // Spill puddle
  if (sim.spill > 0) {
    ctx.fillStyle = "rgba(232,154,16,0.55)";
    ctx.beginPath();
    ctx.ellipse(w / 2, counter + 18, 40 + sim.spill * 220, 8 + sim.spill * 10, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (let i = 0; i < sim.glasses.length; i++) {
    const g = sim.glasses[i];
    const gw = 36;
    const gh = 46;
    const glass = () => {
      ctx.beginPath();
      ctx.moveTo(g.x - gw / 2, counter - gh);
      ctx.lineTo(g.x + gw / 2, counter - gh);
      ctx.lineTo(g.x + gw / 2 - 5, counter);
      ctx.lineTo(g.x - gw / 2 + 5, counter);
      ctx.closePath();
    };
    glass();
    ctx.fillStyle = "rgba(210,235,255,0.28)";
    ctx.fill();
    ctx.save();
    glass();
    ctx.clip();
    const inner = gh - 10;
    fill(ctx, g.x - gw, counter - 10 - g.fill * inner, gw * 2, g.fill * inner, "#E89A10");
    fill(ctx, g.x - gw, counter - 10, gw * 2, 10, "rgba(210,235,255,0.55)");
    ctx.restore();
    glass();
    ctx.strokeStyle = "#EAF6FF";
    ctx.lineWidth = 2.5;
    ctx.stroke();
    fill(ctx, g.x - gw / 2 + 6, counter - gh + 5, 3, gh - 18, "rgba(255,255,255,0.6)");
    if (g.fill >= 0.85) {
      ctx.strokeStyle = LIME;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(g.x - 8, counter + 14);
      ctx.lineTo(g.x - 2, counter + 20);
      ctx.lineTo(g.x + 9, counter + 8);
      ctx.stroke();
    }
  }
  // Upside-down bottle with its pourer
  const bx = sim.bottleX;
  const by = 70;
  ctx.save();
  ctx.translate(bx, by);
  ctx.rotate(Math.PI);
  if (!drawImgCentred(ctx, s, ART.shotsBottle, 0, 0, 90)) {
    roundRect(ctx, -16, -40, 32, 60, 6);
    ctx.fillStyle = INK;
    ctx.fill();
    roundRect(ctx, -13, -37, 26, 54, 5);
    ctx.fillStyle = "#D89A30";
    ctx.fill();
    fill(ctx, -6, -54, 12, 16, INK);
  }
  ctx.restore();
  fill(ctx, bx - 2, by + 44, 4, 12, "#C8C8D0");
  if (sim.pouring) {
    const land = sim.landing >= 0 ? counter - 44 : counter;
    fill(ctx, bx - 1.5, by + 56, 3, land - by - 56, "#F0B040");
  }
  drawText(ctx, "SPILL", 16, 22, CREAM, 1, "left");
  meterBar(ctx, 50, 20, 90, 8, sim.spill / SHOT_SPILL_MAX, RED);
  if (sim.pointer === null && blink(t, 2)) say(ctx, "HOLD TO POUR", w / 2, 130, CREAM, 2);
}

/** A party guest from the chest up — the stand-in until the guest sheet lands. */
function partyGuest(ctx: Ctx, x: number, y: number, i: number, bonked: boolean, t: number) {
  const shirt = ["#C83A5A", "#3A6AC8", "#E8A020", "#8A4AC8"][i % 4];
  const hair = ["#5A2A10", "#1A1A1A", "#C8A040", "#7A2A1A"][i % 4];
  const skin = ["#F0B890", "#C88A5A", "#F8C8A0", "#A86A40"][i % 4];
  // Arms up, cheering (or flung out, bonked)
  const lift = bonked ? 0 : Math.sin(t * 8 + i) * 4;
  fill(ctx, x - 30, y - 6 + lift, 8, 26, INK);
  fill(ctx, x + 22, y - 6 - lift, 8, 26, INK);
  fill(ctx, x - 29, y - 5 + lift, 6, 24, skin);
  fill(ctx, x + 23, y - 5 - lift, 6, 24, skin);
  roundRect(ctx, x - 24, y + 8, 48, 36, 10);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, x - 22, y + 10, 44, 34, 9);
  ctx.fillStyle = shirt;
  ctx.fill();
  circle(ctx, x, y - 8, 19, INK);
  circle(ctx, x, y - 8, 17, skin);
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.arc(x, y - 12, 17, Math.PI, 0);
  ctx.fill();
  if (bonked) {
    drawText(ctx, "X X", x, y - 12, INK, 1, "center");
    circle(ctx, x + 6, y - 26, 6, "#E86A6A");
    for (let k = 0; k < 3; k++) {
      const a = t * 6 + (k * Math.PI * 2) / 3;
      fill(ctx, x + Math.cos(a) * 22 - 2, y - 30 + Math.sin(a) * 6 - 2, 4, 4, GOLD);
    }
  } else {
    fill(ctx, x - 7, y - 10, 3, 3, INK);
    fill(ctx, x + 4, y - 10, 3, 3, INK);
    fill(ctx, x - 5, y - 2, 10, 3, INK);
  }
}

function drawPop(ctx: Ctx, s: number, sim: PopSim, w: number, t: number) {
  const counter = K.H - 40;
  barScene(ctx, w, "#301830", counter);
  // Disco sparkle
  for (let i = 0; i < 14; i++) {
    const on = Math.floor(t * 6 + i) % 3 === 0;
    if (on) fill(ctx, (i * 131) % w, 20 + ((i * 41) % 40), 3, 3, "#FFFFFF");
  }
  // Guests along the far line
  sim.guests.forEach((gx, i) => {
    const bonked = sim.bonked === i;
    const bob = Math.sin(t * 5 + i) * 3;
    partyGuest(ctx, gx, POP_TARGET_Y + bob, i, bonked, t);
    if (bonked) say(ctx, "OW!", gx, POP_TARGET_Y - 56, RED, 2);
  });
  // Ice bucket
  const bx = sim.bucketX;
  const by = POP_TARGET_Y + 6;
  ctx.fillStyle = INK;
  ctx.beginPath();
  ctx.moveTo(bx - POP_BUCKET_HALF - 2, by - 20);
  ctx.lineTo(bx + POP_BUCKET_HALF + 2, by - 20);
  ctx.lineTo(bx + POP_BUCKET_HALF - 8, by + 26);
  ctx.lineTo(bx - POP_BUCKET_HALF + 8, by + 26);
  ctx.closePath();
  ctx.fill();
  fill(ctx, bx - POP_BUCKET_HALF + 2, by - 17, POP_BUCKET_HALF * 2 - 4, 8, "#E8F0F8");
  fill(ctx, bx - POP_BUCKET_HALF + 6, by - 9, POP_BUCKET_HALF * 2 - 12, 32, "#A8B8C8");
  if (blink(t, 3)) say(ctx, "AIM HERE", bx, by + 32, GOLD, 1);

  const px = w / 2;
  const py = K.H - POP_PIVOT_DY;
  // Aim guide, short, so reading the sway is still the skill
  if (!sim.cork) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.setLineDash([4, 6]);
    ctx.lineWidth = 2;
    const dx = Math.sin(sim.angle);
    const dy = -Math.cos(sim.angle);
    ctx.beginPath();
    ctx.moveTo(px + dx * 112, py + dy * 112);
    ctx.lineTo(px + dx * 190, py + dy * 190);
    ctx.stroke();
    ctx.setLineDash([]);
  }
  // Bottle
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(sim.cork ? sim.cork.angle : sim.angle);
  roundRect(ctx, -18, -70, 36, 70, 8);
  ctx.fillStyle = INK;
  ctx.fill();
  roundRect(ctx, -15, -67, 30, 64, 7);
  ctx.fillStyle = "#1E3A26";
  ctx.fill();
  fill(ctx, -8, -100, 16, 34, INK);
  fill(ctx, -6, -98, 12, 30, "#D8B040");
  fill(ctx, -12, -48, 24, 20, CREAM);
  if (!sim.cork) fill(ctx, -5, -108, 10, 10, "#C8A070");
  ctx.restore();

  if (sim.cork) {
    const k = Math.min(1, sim.cork.t / POP_FLIGHT);
    const tipX = px + Math.sin(sim.cork.angle) * 104;
    const tipY = py - Math.cos(sim.cork.angle) * 104;
    const cx = tipX + (popLandX(w, sim.cork.angle) - tipX) * k;
    const cy = tipY + (POP_TARGET_Y - tipY) * k;
    circle(ctx, cx, cy, 6, "#C8A070");
    if (k < 0.5) {
      for (let i = 0; i < 6; i++) circle(ctx, tipX + (Math.random() - 0.5) * 20, tipY + (Math.random() - 0.5) * 20, 5, CREAM);
    }
  } else if (blink(t, 2)) {
    say(ctx, "TAP TO POP!", px, K.H / 2 + 20, CREAM, 2);
  }
}

// ─── Handoff and game over ───────────────────────────────────────────────────

function roster(ctx: Ctx, st: State, y: number, highlight: number) {
  const w = st.layout.w;
  const names = st.players.map((p) => p.name.toUpperCase());
  const scale = st.players.length > 6 ? 1 : 1.5;
  const gap = 14;
  const widths = names.map((n) => textWidth(n, scale));
  let total = widths.reduce((a, b) => a + b, 0) + gap * (names.length - 1);
  let rows = [names.map((_, i) => i)];
  if (total > w - 40) {
    const half = Math.ceil(names.length / 2);
    rows = [names.slice(0, half).map((_, i) => i), names.slice(half).map((_, i) => i + half)];
  }
  rows.forEach((row, r) => {
    total = row.reduce((a, i) => a + widths[i], 0) + gap * (row.length - 1);
    let x = w / 2 - total / 2;
    for (const i of row) {
      const p = st.players[i];
      const color = !p.alive ? "#6A5A50" : i === highlight ? GOLD : CREAM;
      drawText(ctx, names[i], x, y + r * 16, color, scale, "left");
      if (!p.alive) fill(ctx, x - 2, y + r * 16 + 3.5 * scale, widths[i] + 4, 2, RED);
      x += widths[i] + gap;
    }
  });
}

function drawHandoff(ctx: Ctx, st: State, t: number) {
  const h = st.handoff;
  if (!h) return;
  const w = st.layout.w;
  const out = h.reason === "out";
  burst(ctx, w, out ? "#5A1010" : "#2A1A5A", out ? "#3A0808" : "#1A0E3A", t * 0.5);

  const from = h.from !== null ? st.players[h.from] : null;
  if (out && from) {
    say(ctx, `${from.name.toUpperCase()} IS OUT!`, w / 2, 22, RED, fitScale(`${from.name} IS OUT!`, w - 40, 3));
  } else if (h.reason === "served" && from) {
    say(ctx, "DRINK UP! PASS THE PHONE!", w / 2, 22, LIME, fitScale("DRINK UP! PASS THE PHONE!", w - 40, 3));
  } else {
    say(ctx, "PARTY MODE", w / 2, 22, GOLD, 3);
  }

  drawText(ctx, "UP NEXT", w / 2, 78, "#C8B89A", 2, "center");
  const name = st.players[h.to].name.toUpperCase();
  const wob = Math.sin(t * 6) * 0.2;
  say(ctx, name, w / 2, 104, GOLD, fitScale(name, w - 60, 6) + wob);

  const left = Math.max(0, Math.ceil(K.HANDOFF_SECONDS - h.t));
  say(ctx, String(left), w / 2, 170, CREAM, 5);
  if (h.t >= K.HANDOFF_TAP_GUARD && blink(t, 2)) {
    drawText(ctx, "TAP WHEN READY", w / 2, 222, CREAM, 1.5, "center");
  }
  roster(ctx, st, 256, h.to);
}

function drawOver(ctx: Ctx, st: State, t: number) {
  const w = st.layout.w;
  burst(ctx, w, "#5A1010", "#2A0606", t * 0.3);
  const title = st.mode === "party" ? "EVERYBODY'S OUT!" : "86'D!";
  say(ctx, title, w / 2, 30, RED, fitScale(title, w - 40, 5));
  drawText(ctx, st.mode === "party" ? "TEAM SCORE" : "SCORE", w / 2, 100, "#C8B89A", 2, "center");
  say(ctx, String(st.score).padStart(6, "0"), w / 2, 122, GOLD, 5);
  drawText(ctx, `${st.served} DRINKS SERVED`, w / 2, 172, CREAM, 1.5, "center");
  if (st.mode === "party") {
    const top = [...st.players].sort((a, b) => b.points - a.points).slice(0, 5);
    top.forEach((p, i) => {
      drawText(ctx, `${i + 1}. ${p.name.toUpperCase()}`, w / 2 - 110, 200 + i * 20, i === 0 ? GOLD : CREAM, 1.5, "left");
      drawText(ctx, String(p.points), w / 2 + 110, 200 + i * 20, i === 0 ? GOLD : CREAM, 1.5, "right");
    });
  }
}

// ─── Effects ─────────────────────────────────────────────────────────────────

function drawFx(ctx: Ctx, f: Fx) {
  const k = f.t / f.dur;
  switch (f.kind) {
    case "word": {
      const sc = 1.5 + Math.max(0, 0.15 - f.t) * 4;
      ctx.globalAlpha = 1 - Math.max(0, k - 0.6) / 0.4;
      say(ctx, f.text ?? "", f.x, f.y - k * 24, f.color ?? CREAM, sc, false);
      ctx.globalAlpha = 1;
      break;
    }
    case "grab": {
      ctx.strokeStyle = `rgba(255,230,120,${1 - k})`;
      ctx.lineWidth = 4 * (1 - k) + 1;
      ctx.beginPath();
      ctx.arc(f.x, f.y, 10 + k * 40, 0, Math.PI * 2);
      ctx.stroke();
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        const r = 14 + k * 46;
        fill(ctx, f.x + Math.cos(a) * r - 2, f.y + Math.sin(a) * r - 2, 4, 4, GOLD);
      }
      break;
    }
    case "boom":
      circle(ctx, f.x, f.y, 10 + k * 70, `rgba(255,${Math.round(200 - k * 150)},0,${1 - k})`);
      circle(ctx, f.x, f.y, 6 + k * 40, `rgba(255,255,200,${1 - k})`);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        circle(ctx, f.x + Math.cos(a) * k * 60, f.y + Math.sin(a) * k * 60 - k * 20, 14 * (1 - k) + 4, `rgba(80,70,60,${0.8 - k * 0.8})`);
      }
      break;
    case "shatter":
    case "splash":
      for (let i = 0; i < 10; i++) {
        const a = (i / 10) * Math.PI * 2 + i;
        const r = k * 50;
        const c = f.kind === "shatter" ? "#D8F0FF" : f.ing ? colorFor(f.ing) : "#C8B060";
        fill(ctx, f.x + Math.cos(a) * r - 2, f.y + Math.sin(a) * r + k * k * 40 - 2, 4, 4, c);
      }
      break;
    case "sparkle":
      for (let i = 0; i < 6; i++) {
        const a = (i / 6) * Math.PI * 2 + k * 3;
        const r = k * 34;
        const x = f.x + Math.cos(a) * r;
        const y = f.y + Math.sin(a) * r;
        fill(ctx, x - 1, y - 5, 2, 10, "#FFFFFF");
        fill(ctx, x - 5, y - 1, 10, 2, "#FFFFFF");
      }
      break;
    default:
      break;
  }
}

function drawBanner(ctx: Ctx, st: State) {
  const b = st.banner;
  if (!b) return;
  const w = st.layout.w;
  const pop = b.t < 0.15 ? 0.5 + (b.t / 0.15) * 0.7 : b.t < 0.25 ? 1.2 - ((b.t - 0.15) / 0.1) * 0.2 : 1;
  const fade = b.t > b.dur - 0.25 ? (b.dur - b.t) / 0.25 : 1;
  ctx.globalAlpha = Math.max(0, fade);
  const sc = fitScale(b.text, w * 0.7, 5) * pop;
  const y = st.stage === "build" ? 110 : K.H / 2 - 20;
  say(ctx, b.text, w / 2, y, b.color, sc);
  ctx.globalAlpha = 1;
}

// ─── Frame ───────────────────────────────────────────────────────────────────

export function drawFrame(ctx: Ctx, st: State, s: number, t: number): void {
  const l = st.layout;
  ctx.save();
  if (st.shakeT > 0) {
    const m = st.shakeT * 14;
    ctx.translate((Math.random() - 0.5) * m, (Math.random() - 0.5) * m);
  }
  fill(ctx, -20, -20, l.w + 40, K.H + 40, "#000");

  switch (st.stage) {
    case "grab":
      drawCentreBack(ctx, st, t);
      drawGrabPanel(ctx, s, st, 0, t);
      drawGrabPanel(ctx, s, st, 1, t);
      drawTicket(ctx, s, st, "ORDER UP", t);
      drawHud(ctx, st, s);
      break;
    case "finish":
      drawCentreBack(ctx, st, t);
      if (st.grab.done) drawWaitingPanel(ctx, st, t);
      else drawGrabPanel(ctx, s, st, 0, t);
      drawFinishPanel(ctx, s, st, t);
      drawTicket(ctx, s, st, "NEXT ORDER", t);
      drawHud(ctx, st, s);
      break;
    case "build":
      drawBuild(ctx, s, st, t, false);
      drawHud(ctx, st, s);
      break;
    case "micro":
      drawMicro(ctx, s, st, t);
      break;
    case "handoff":
      drawHandoff(ctx, st, t);
      break;
    case "over":
      drawOver(ctx, st, t);
      break;
  }

  if (st.stage !== "micro" && st.stage !== "handoff") {
    for (const f of st.fx) drawFx(ctx, f);
    drawBanner(ctx, st);
  }
  if (st.flash) {
    ctx.fillStyle = `rgba(228,43,32,${0.35 * (1 - st.flash.t / 0.35)})`;
    ctx.fillRect(0, 0, l.w, K.H);
  }
  ctx.restore();
}
