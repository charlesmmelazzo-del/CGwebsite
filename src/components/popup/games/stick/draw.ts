// ─── Behind the Stick — drawing ──────────────────────────────────────────────
//
// Reads the State and paints it. Nothing here changes a score or decides
// anything; see core.ts for that. Every sprite has a code-drawn stand-in, so
// the game still plays on the frames before its art has downloaded.

import { blink, drawText, drawTextMarquee, textWidth } from "../arcade";
import { INGREDIENT_LABELS, type IngredientKey } from "../cocktails";
import { colorFor } from "../ingredients";
import { ART, aspect as aspectOf, drawBackdrop, drawImg, drawImgCentred, drawImgWide, drawThreeSlice, type V2Name } from "./art";
import * as K from "./constants";
import {
  isWanted,
  laneButtonX,
  LANE_BUTTON_Y,
  level,
  vesselPos,
  type Flying,
  type Fx,
  type State,
} from "./core";
import {
  BEER_BOTTLE_Y,
  BEER_COUNTER_Y,
  BEER_GLASS_H,
  BEER_MOUTH,
  BEER_SPILL_MAX,
  MICRO_HINT,
  MICRO_TITLE,
  popLandX,
  POP_BUCKET_HALF,
  POP_FLIGHT,
  POP_PIVOT_DY,
  POP_TARGET_Y,
  SHOT_REST_Y,
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

/** A v2 sprite at a height, centred. */
function spr(ctx: Ctx, s: number, name: V2Name, cx: number, cy: number, h: number): boolean {
  return drawImgCentred(ctx, s, ART.v2(name), cx, cy, h);
}

/** A v2 word banner at a width, centred. */
function wordArt(ctx: Ctx, s: number, name: V2Name, cx: number, cy: number, w: number): boolean {
  return drawImgWide(ctx, s, ART.v2(name), cx, cy, w);
}

/** A timer in its brass frame. */
function brassMeter(ctx: Ctx, x: number, y: number, w: number, h: number, f: number, color: string) {
  const pad = h * 0.55;
  if (!drawThreeSlice(ctx, ART.v2("timer-frame"), x - pad, y - pad, w + pad * 2, h + pad * 2)) {
    meterBar(ctx, x, y, w, h, f, color);
    return;
  }
  fill(ctx, x, y, w, h, "#2A1A12");
  fill(ctx, x, y, Math.max(0, Math.min(1, f)) * w, h, color);
  fill(ctx, x, y, w, 1, "rgba(255,255,255,0.3)");
  drawThreeSlice(ctx, ART.v2("timer-frame"), x - pad, y - pad, w + pad * 2, h + pad * 2);
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

function drawPanel(ctx: Ctx, s: number, x: number, w: number, tint: string) {
  if (drawImg(ctx, s, ART.v2("panel-side"), x, 0, w, K.H)) {
    fill(ctx, x, 0, w, K.H, tint);
    return;
  }
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

function drawCentreBack(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  if (drawBackdrop(ctx, s, ART.v2("bg-main"), l.side, 0, l.rightX - l.side, K.H)) {
    fill(ctx, l.side, 0, l.rightX - l.side, K.H, "rgba(10,4,8,0.25)");
    return;
  }
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
      if (!spr(ctx, s, alive ? "heart" : "heart-broken", x + 8, 12, 18)) {
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

// ─── Instruction cards ───────────────────────────────────────────────────────

interface Line {
  text: string;
  color: string;
  scale: number;
}

/** Break `text` into lines that fit `maxW` at `scale`. */
function wrap(text: string, maxW: number, scale: number): string[] {
  const words = text.split(" ");
  const lines: string[] = [];
  let cur = "";
  for (const wd of words) {
    const next = cur ? `${cur} ${wd}` : wd;
    if (cur && textWidth(next, scale) > maxW) {
      lines.push(cur);
      cur = wd;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

/**
 * A flashing instruction card: the words, wrapped and centred, over a panel
 * that pulses so the eye goes straight to it, with a bar showing how long it
 * stays up — so it reads as "about to start", not as the game waiting.
 */
function drawCard(
  ctx: Ctx,
  x: number,
  y: number,
  w: number,
  h: number,
  lines: Line[],
  t: number,
  remaining: number,
  total: number,
  accent = GOLD,
  /** A painted word that stands in for the first line, once it has loaded. */
  headline?: { name: V2Name; w: number; s: number }
) {
  const flash = blink(t, 3);
  fill(ctx, x + 4, y + 5, w, h, "rgba(0,0,0,0.5)");
  fill(ctx, x - 3, y - 3, w + 6, h + 6, flash ? accent : INK);
  fill(ctx, x, y, w, h, flash ? "#2A1240" : "#1C0C2C");

  const pad = 12;
  const laid: { text: string; color: string; scale: number }[] = [];
  const hw = headline ? Math.min(headline.w, w - 24) : 0;
  const art = headline ? ART.v2(headline.name) : null;
  const head = headline && art ? imgHeightAt(art, hw) : null;
  if (head !== null) lines = lines.slice(1);
  for (const ln of lines) {
    // Shrink before wrapping a short line; wrap a long one rather than shrinking it to nothing.
    let sc = ln.scale;
    while (sc > 1.5 && textWidth(ln.text, sc) > w - pad * 2 && !ln.text.includes(" ")) sc -= 0.5;
    for (const part of wrap(ln.text, w - pad * 2, sc)) {
      laid.push({ text: part, color: ln.color, scale: Math.min(sc, fitScale(part, w - pad * 2, sc)) });
    }
  }
  const gap = 5;
  const total_h = laid.reduce((a, l) => a + l.scale * 7 + gap, -gap) + (head !== null ? head + gap * 2 : 0);
  let ly = y + (h - 12 - total_h) / 2;
  if (head !== null && headline) {
    const pop = 1 + Math.sin(t * 9) * 0.03;
    wordArt(ctx, headline.s, headline.name, x + w / 2, ly + head / 2, hw * pop);
    ly += head + gap * 2;
  }
  for (const l of laid) {
    say(ctx, l.text, x + w / 2, ly, l.color, l.scale);
    ly += l.scale * 7 + gap;
  }
  meterBar(ctx, x + 14, y + h - 10, w - 28, 4, total > 0 ? remaining / total : 0, accent);
}

/** Height a painted image comes out at a given width, or null if it hasn't loaded. */
function imgHeightAt(url: string, w: number): number | null {
  const a = aspectOf(url);
  return a === null ? null : w / a;
}

function centreBox(st: State) {
  const l = st.layout;
  return { x: l.side + 10, w: l.rightX - l.side - 20 };
}

// ─── Grab ────────────────────────────────────────────────────────────────────

/**
 * Canvas filters draw the greyed-out things in true greyscale. Safari hasn't
 * always had them, so there the same things are drawn onto a layer and washed
 * grey over their own pixels instead — flatter, but just as clearly "not this".
 */
const CANVAS_FILTER =
  typeof CanvasRenderingContext2D !== "undefined" && "filter" in CanvasRenderingContext2D.prototype;
let greyLayer: HTMLCanvasElement | null = null;

function drawGreyed(ctx: Ctx, draw: (c: Ctx) => void) {
  if (CANVAS_FILTER) {
    ctx.save();
    ctx.filter = "grayscale(1) brightness(0.62) contrast(0.85)";
    draw(ctx);
    ctx.restore();
    return;
  }
  const W = ctx.canvas.width;
  const Hh = ctx.canvas.height;
  if (!greyLayer) greyLayer = document.createElement("canvas");
  if (greyLayer.width !== W || greyLayer.height !== Hh) {
    greyLayer.width = W;
    greyLayer.height = Hh;
  }
  const g = greyLayer.getContext("2d");
  if (!g) return draw(ctx);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.clearRect(0, 0, W, Hh);
  g.setTransform(ctx.getTransform());
  draw(g);
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalCompositeOperation = "source-atop";
  g.fillStyle = "rgba(84,82,90,0.8)";
  g.fillRect(0, 0, W, Hh);
  g.globalCompositeOperation = "source-over";
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.drawImage(greyLayer, 0, 0);
  ctx.restore();
}

const ITEM_ART: Partial<Record<Flying["kind"], V2Name | ((t: number) => V2Name)>> = {
  can: "can",
  glass: "glass-broken",
  napkin: "napkin",
  phone: "phone",
  vodka: "vodka",
  jug: "jug",
  bomb: (t) => (blink(t, 6) ? "bomb-1" : "bomb-2"),
};

function drawItem(ctx: Ctx, s: number, st: State, it: Flying, t: number) {
  const l = st.layout;
  const x = K.panelX(l, it.side) + it.x * l.side;
  const y = it.y;
  const h = K.ITEM_H;
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(it.spin);
  const art = ITEM_ART[it.kind];
  if (art) {
    const name = typeof art === "function" ? art(t) : art;
    if (spr(ctx, s, name, 0, 0, h * (it.kind === "jug" || it.kind === "vodka" ? 1.2 : 1))) {
      ctx.restore();
      return;
    }
  }
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
  }
  ctx.restore();
}

/** "Get ready", with which thumb, while a card is up over an empty panel. */
function panelReady(ctx: Ctx, st: State, side: 0 | 1, t: number) {
  const l = st.layout;
  const cx = K.panelX(l, side) + l.side / 2;
  if (blink(t, 2)) say(ctx, "GET READY!", cx, K.H / 2 - 18, GOLD, 2);
  drawText(ctx, side === 0 ? "LEFT THUMB" : "RIGHT THUMB", cx, K.H / 2 + 8, CREAM, 1, "center");
}

function drawGrabPanel(ctx: Ctx, s: number, st: State, side: 0 | 1, t: number) {
  const l = st.layout;
  const g = st.grab;
  const x = K.panelX(l, side);
  drawPanel(ctx, s, x, l.side, "rgba(0,0,0,0)");
  if (g.cardT > 0) {
    panelReady(ctx, st, side, t);
    return;
  }

  ctx.save();
  ctx.beginPath();
  ctx.rect(x, 0, l.side, K.H);
  ctx.clip();
  const mine = g.items.filter((it) => it.side === side);
  const wanted = mine.filter((it) => isWanted(st, it));
  const rest = mine.filter((it) => !isWanted(st, it));
  // Everything that isn't wanted first, grey and behind; then the wanted
  // bottles in full colour on top, each in a pulsing glow.
  if (rest.length) drawGreyed(ctx, (c) => rest.forEach((it) => drawItem(c, s, st, it, t)));
  for (const it of wanted) {
    const ix = x + it.x * l.side;
    const r = 30 + Math.sin(t * 8) * 3;
    const glow = ctx.createRadialGradient(ix, it.y, 4, ix, it.y, r);
    glow.addColorStop(0, "rgba(255,220,90,0.55)");
    glow.addColorStop(1, "rgba(255,220,90,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(ix - r, it.y - r, r * 2, r * 2);
    drawItem(ctx, s, st, it, t);
  }
  ctx.restore();

  if (g.stinkT[side] > 0) {
    const a = Math.min(1, g.stinkT[side] / 0.6) * 0.62;
    ctx.fillStyle = `rgba(150,160,40,${a})`;
    ctx.fillRect(x, 0, l.side, K.H);
    for (let i = 0; i < 4; i++) {
      const yy = ((t * 40 + i * 90) % (K.H + 60)) - 30;
      const xx = x + l.side * (0.2 + ((i * 37) % 60) / 100);
      ctx.globalAlpha = a / 0.62;
      if (!spr(ctx, s, blink(t + i, 2) ? "stink-1" : "stink-2", xx, K.H - yy, 70)) {
        circle(ctx, xx, K.H - yy, 22 + (i % 3) * 8, `rgba(120,130,30,${a})`);
      }
      ctx.globalAlpha = 1;
    }
    say(ctx, "PEE-YOO!", x + l.side / 2, K.H / 2 - 8, "#E8F060", 2);
  }
}

/** The order ticket in the centre: what to grab, and what's been got. */
function drawTicket(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  const g = st.grab;
  const cw = l.rightX - l.side;
  const w = Math.min(cw - 24, 300);
  const x = l.w / 2 - w / 2;
  const y = 36;
  const h = 184;
  ctx.save();
  ctx.translate(l.w / 2, y + h / 2);
  ctx.rotate(Math.sin(t * 1.4) * 0.012);
  ctx.translate(-l.w / 2, -(y + h / 2));
  if (!drawImg(ctx, s, ART.v2("ticket"), x - 12, y - 46, w + 24, h + 60)) {
    fill(ctx, x + 4, y + 5, w, h, "rgba(0,0,0,0.45)");
    fill(ctx, x, y, w, h, "#F5EAD0");
    for (let i = 0; i < w; i += 8) fill(ctx, x + i, y - 3, 4, 3, "#F5EAD0");
    fill(ctx, l.w / 2 - 16, y - 8, 32, 10, "#B8903A");
  }

  const name = st.order.name.toUpperCase();
  drawText(ctx, name, l.w / 2, y + 26, INK, fitScale(name, w - 40, 2), "center");

  const n = st.order.recipe.length;
  const slot = (w - 16) / n;
  const by = y + 78;
  st.order.recipe.forEach((ing, i) => {
    const cx = x + 8 + slot * (i + 0.5);
    const got = g.got.includes(ing);
    if (got) circle(ctx, cx, by + 2, 26, "rgba(156,232,0,0.25)");
    ctx.globalAlpha = got ? 0.45 : 1;
    bottle(ctx, s, ing, cx, by, 46);
    ctx.globalAlpha = 1;
    const lab = (INGREDIENT_LABELS[ing as IngredientKey] ?? ing).toUpperCase();
    drawText(ctx, lab, cx, by + 36, INK, fitScale(lab, slot - 4, 1), "center");
    if (got) check(ctx, s, cx, by);
  });

  const f = g.timeLeft / g.timeMax;
  brassMeter(ctx, x + 22, y + 146, w - 44, 10, f, f < 0.3 ? (blink(t, 6) ? RED : "#A02010") : "#E89A20");
  const method = st.order.finish === "shake" ? "SHAKEN" : "STIRRED";
  drawText(ctx, method, l.w / 2, y + 166, "#8A6A4A", 1, "center");
  ctx.restore();
}

function check(ctx: Ctx, s: number, cx: number, cy: number, size = 1) {
  if (spr(ctx, s, "check", cx + 2 * size, cy - 2 * size, 34 * size)) return;
  ctx.strokeStyle = "#3A8A10";
  ctx.lineWidth = 5 * size;
  ctx.lineCap = "round";
  ctx.beginPath();
  ctx.moveTo(cx - 12 * size, cy);
  ctx.lineTo(cx - 3 * size, cy + 10 * size);
  ctx.lineTo(cx + 14 * size, cy - 14 * size);
  ctx.stroke();
}

const GRAB_CARD_LINES: Record<string, (st: State) => Line[]> = {
  fresh: () => [
    { text: "GRAB THE COLOR BOTTLES!", color: GOLD, scale: 2 },
    { text: "AVOID THE REST!", color: RED, scale: 2 },
  ],
  retry: () => [
    { text: "NEW ORDER!", color: RED, scale: 2 },
    { text: "GRAB THE COLOR BOTTLES!", color: GOLD, scale: 2 },
  ],
};

function drawGrabStage(ctx: Ctx, s: number, st: State, t: number) {
  const g = st.grab;
  const l = st.layout;
  drawCentreBack(ctx, s, st, t);
  drawGrabPanel(ctx, s, st, 0, t);
  drawGrabPanel(ctx, s, st, 1, t);
  drawTicket(ctx, s, st, t);
  if (g.cardT > 0) {
    const { x, w } = centreBox(st);
    const lines = (GRAB_CARD_LINES[g.card] ?? GRAB_CARD_LINES.fresh)(st);
    drawCard(ctx, x, 222, w, 94, lines, t, g.cardT, g.card === "retry" ? K.GRAB_CARD_SHORT : K.GRAB_CARD);
    const pop = 1 + Math.sin(t * 10) * 0.04;
    wordArt(ctx, s, "w-grab", l.w / 2, 206, 150 * pop);
  }
  drawHud(ctx, st, s);
}

// ─── Build ───────────────────────────────────────────────────────────────────

const VP_Y = 30;
/** Perspective: 0 far .. 1 at the tap zone. */
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
    scale: 0.2 + 0.8 * f,
  };
}

function vesselUrl(st: State): string {
  return st.order.finish === "shake" ? ART.v2("tin-1") : ART.mixingGlass;
}

function drawBuild(ctx: Ctx, s: number, st: State, t: number, frozen: boolean) {
  const l = st.layout;
  const b = st.build;
  const w = l.w;

  const painted = drawBackdrop(ctx, s, ART.v2("bg-highway"), 0, 0, w, K.H, 0.17, VP_Y - 8);
  // The room at the far end of the bar
  if (!painted) {
  const sky = ctx.createLinearGradient(0, 0, 0, K.H);
  sky.addColorStop(0, "#2A1030");
  sky.addColorStop(1, "#0C0608");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, K.H);
  const rg = ctx.createRadialGradient(w / 2, VP_Y, 4, w / 2, VP_Y, 220);
  rg.addColorStop(0, "rgba(255,190,90,0.55)");
  rg.addColorStop(1, "rgba(255,190,90,0)");
  ctx.fillStyle = rg;
  ctx.fillRect(0, 0, w, 240);

  // The bar top, running away from the player to the far end
  const top = ctx.createLinearGradient(0, VP_Y, 0, K.H);
  top.addColorStop(0, "#3A1C0C");
  top.addColorStop(1, "#7A4420");
  ctx.fillStyle = top;
  ctx.beginPath();
  ctx.moveTo(w / 2 - 24, VP_Y);
  ctx.lineTo(w / 2 + 24, VP_Y);
  ctx.lineTo(w + 30, K.H);
  ctx.lineTo(-30, K.H);
  ctx.closePath();
  ctx.fill();
  // Plank seams converging on the far end
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 1;
  for (let i = -6; i <= 6; i++) {
    ctx.beginPath();
    ctx.moveTo(w / 2 + i * 4, VP_Y);
    ctx.lineTo(w / 2 + i * (w / 11), K.H);
    ctx.stroke();
  }
  }
  if (!b) return;

  // Where each bottle slides: a polished runner per lane
  for (let lane = 0; lane < K.LANES; lane++) {
    const bx = laneButtonX(l, lane);
    ctx.fillStyle = "rgba(255,210,150,0.10)";
    ctx.beginPath();
    ctx.moveTo(w / 2 - 2, VP_Y);
    ctx.lineTo(w / 2 + 2, VP_Y);
    ctx.lineTo(bx + 30, LANE_BUTTON_Y);
    ctx.lineTo(bx - 30, LANE_BUTTON_Y);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = LANE_COLORS[lane];
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  // The bartender in the middle, behind his bit of counter, with the tin
  const mood = b.mood;
  const bartender = ART.bartender(mood);
  const bob = mood === "panic" ? Math.sin(t * 30) * 1.5 : Math.sin(t * 3) * 1.5;
  if (!drawImgCentred(ctx, s, bartender, w / 2, K.H - 104 + bob, 150)) {
    circle(ctx, w / 2, K.H - 140, 34, "#F0B890");
    fill(ctx, w / 2 - 40, K.H - 108, 80, 70, "#1A1A1A");
  }
  if (mood !== "happy") {
    // Sweat flying off him, more of it when it's really going wrong
    const drops = mood === "panic" ? 3 : 1;
    for (let i = 0; i < drops; i++) {
      const k = (t * 1.6 + i / drops) % 1;
      const side = i % 2 ? -1 : 1;
      ctx.globalAlpha = 1 - k;
      spr(ctx, s, "sweat", w / 2 + side * (34 + k * 30), K.H - 170 - Math.sin(k * Math.PI) * 24 + k * 30, 14);
      ctx.globalAlpha = 1;
    }
  }
  const counter = ctx.createLinearGradient(0, K.H - 44, 0, K.H);
  counter.addColorStop(0, "#C88A48");
  counter.addColorStop(0.15, "#8A5020");
  counter.addColorStop(1, "#4A2408");
  ctx.fillStyle = counter;
  ctx.fillRect(w / 2 - 108, K.H - 44, 216, 44);
  const v = vesselPos(l);
  const landed = st.fx.some((f) => f.kind === "toss" && f.t > f.dur * 0.85);
  const vh = 60 + (landed ? 4 : 0);
  if (!drawImgCentred(ctx, s, vesselUrl(st), v.x, v.y + 12 - vh / 2, vh)) {
    fill(ctx, v.x - 14, v.y + 12 - vh, 28, vh, "#C8D0D8");
  }

  // Tap zones: a brass ring at the end of each runner, lit as a bottle nears
  for (let lane = 0; lane < K.LANES; lane++) {
    const bx = laneButtonX(l, lane);
    const since = b.clock - b.pressedAt[lane];
    const pressed = since >= 0 && since < 0.12;
    const near = b.notes.some((n) => n.lane === lane && !n.judged && Math.abs(n.t - b.clock) < 0.35);
    const pulse = near ? 0.6 + Math.sin(t * 20) * 0.25 : 0.25;
    const halo = ctx.createRadialGradient(bx, LANE_BUTTON_Y, 20, bx, LANE_BUTTON_Y, 46);
    halo.addColorStop(0, `rgba(255,220,120,${pulse})`);
    halo.addColorStop(1, "rgba(255,220,120,0)");
    ctx.fillStyle = halo;
    ctx.fillRect(bx - 46, LANE_BUTTON_Y - 46, 92, 92);
    const btn = `btn-${lane}${pressed ? "-press" : ""}` as V2Name;
    if (!spr(ctx, s, btn, bx, LANE_BUTTON_Y, 66)) {
      circle(ctx, bx, LANE_BUTTON_Y, 31, INK);
      circle(ctx, bx, LANE_BUTTON_Y, 28, pressed ? "#FFFFFF" : "#D8A840");
      circle(ctx, bx, LANE_BUTTON_Y, 22, pressed ? LANE_COLORS[lane] : "rgba(20,10,6,0.85)");
    }
    ctx.globalAlpha = pressed ? 0.9 : 0.55;
    bottle(ctx, s, st.order.recipe[lane], bx, LANE_BUTTON_Y, 26);
    ctx.globalAlpha = 1;
    say(ctx, "TAP", bx, LANE_BUTTON_Y + 36, near ? GOLD : CREAM, 1, false);
  }

  // Bottles sliding down the bar, far ones first. A missed one topples over the end.
  const notes = b.notes
    .filter((n) => !n.judged || (n.judged === "miss" && b.clock - n.t < 0.45))
    .map((n) => ({ n, z: 1 - (n.t - b.clock) / b.travel }))
    .filter(({ z }) => z >= 0 && z <= 1.4)
    .sort((a, c) => a.z - c.z);
  for (const { n, z } of notes) {
    const p = lanePoint(st, n.lane, z);
    const miss = n.judged === "miss";
    const bh = 44 * p.scale;
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(p.x, p.y + bh * 0.42, bh * 0.35, bh * 0.1, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.save();
    ctx.translate(p.x, p.y);
    if (miss) {
      const k = (b.clock - n.t) / 0.45;
      ctx.globalAlpha = 1 - k;
      ctx.rotate(k * 1.6 * (n.lane < 2 ? -1 : 1));
    }
    bottle(ctx, s, st.order.recipe[n.lane], 0, 0, bh);
    ctx.restore();
  }

  const name = st.order.name.toUpperCase();
  drawText(ctx, name, w / 2, 34, CREAM, 1, "center");
  if (b.combo >= 5) say(ctx, `${b.combo} COMBO`, w / 2, 120, b.combo >= 15 ? GOLD : LIME, 1.5);

  if (b.cardT > 0 && !frozen) {
    fill(ctx, 0, 0, w, K.H, "rgba(0,0,0,0.45)");
    const vessel = st.order.finish === "shake" ? "COCKTAIL SHAKER" : "MIXING GLASS";
    const cw = Math.min(w - 80, 440);
    drawCard(
      ctx,
      w / 2 - cw / 2,
      40,
      cw,
      170,
      [
        { text: "LET'S BUILD THE DRINK!", color: GOLD, scale: 3 },
        { text: "WE GOT OUR BOTTLES!", color: LIME, scale: 2.5 },
        { text: `TAP THE BOTTLES AS THEY SLIDE DOWN THE BAR TO TOSS THEM IN YOUR ${vessel}!`, color: CREAM, scale: 1.5 },
      ],
      t,
      b.cardT,
      K.BUILD_CARD,
      GOLD,
      { name: "w-build-it", w: 240, s }
    );
  }
  if (frozen) fill(ctx, 0, 0, w, K.H, "rgba(0,0,0,0.5)");
}

// ─── Finish ──────────────────────────────────────────────────────────────────

function shakeWord(st: State): string {
  return st.finish?.cocktail.finish === "stir" ? "STIRRING" : "SHAKING";
}

/** The right thumb's panel: the tin or the mixing glass, and its meter. */
function drawFinishPanel(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  const x = l.rightX;
  const mid = x + l.side / 2;
  drawPanel(ctx, s, x, l.side, "rgba(40,120,200,0.06)");
  const f = st.finish;
  if (!f) return;
  // The shaker sits right of the thermometer while it's being worked.
  const cx = f.result ? mid : mid + K.FINISH_TOOL_DX;

  if (f.result) {
    const ok = f.result === "served";
    const bob = Math.sin(f.resultT * 8) * 3;
    if (ok) {
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2 + t * 2;
        const r = 40 + Math.min(1, f.resultT) * 30;
        fill(ctx, cx + Math.cos(a) * r - 2, K.H * 0.45 + Math.sin(a) * r - 2, 4, 4, GOLD);
      }
    }
    if (ok && f.cocktail.finish === "shake") spr(ctx, s, "snowflake", cx, K.H * 0.45, 130 + Math.sin(t * 3) * 6);
    ctx.globalAlpha = ok ? 1 : 0.5;
    if (!drawImgCentred(ctx, s, ART.drink(f.cocktail.key), cx, K.H * 0.45 + bob, 110)) {
      circle(ctx, cx, K.H * 0.45, 30, "#E8A040");
    }
    ctx.globalAlpha = 1;
    if (!ok) spr(ctx, s, "cross", cx, K.H * 0.45, 90 * Math.min(1, 0.6 + f.resultT * 2));
    say(ctx, ok ? "SERVED!" : f.cocktail.finish === "shake" ? "WATERY!" : "TOO WARM!", cx, K.H * 0.75, ok ? LIME : RED, 2);
    return;
  }

  const shake = f.cocktail.finish === "shake";
  const ready = f.cardT > 0;
  ctx.globalAlpha = ready ? 0.45 : 1;
  if (shake) {
    const y = 70 + f.tinY * (K.H - 150);
    const moving = f.pointer !== null;
    const art = moving && f.strokes % 2 === 1 ? ART.shaker2 : ART.shaker1;
    if (!drawImgCentred(ctx, s, art, cx, y + 40, 120)) {
      roundRect(ctx, cx - 18, y, 36, 80, 6);
      ctx.fillStyle = INK;
      ctx.fill();
      roundRect(ctx, cx - 15, y + 3, 30, 74, 5);
      ctx.fillStyle = "#C8D0D8";
      ctx.fill();
    }
    if (moving) {
      if (!spr(ctx, s, "speed-lines", cx - 44, y + 40, 90)) {
        for (let i = 0; i < 3; i++) fill(ctx, cx - 36 - i * 6, y + 20 + i * 14, 2, 18, "rgba(255,255,255,0.5)");
      }
      // A spray of ice every few strokes
      const since = (f.strokes % 4) / 4;
      if (since < 0.5) {
        ctx.globalAlpha = 1 - since * 2;
        spr(ctx, s, "ice-chips", cx + 30, y + 10, 50 + since * 30);
        ctx.globalAlpha = 1;
      }
    }
  } else {
    const c = { x: cx, y: K.H * 0.52 };
    if (!drawImgCentred(ctx, s, ART.mixingGlass, c.x, c.y + 20, 120)) {
      fill(ctx, c.x - 28, c.y - 30, 56, 80, INK);
      fill(ctx, c.x - 25, c.y - 27, 50, 74, "#9CC8E0");
    }
    ctx.strokeStyle = "rgba(255,213,0,0.35)";
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.arc(c.x, c.y, 46, 0, Math.PI * 2);
    ctx.stroke();
    ctx.setLineDash([]);
    const a = f.lastAngle ?? t * 2;
    ctx.strokeStyle = "#D8D8E0";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.moveTo(c.x + Math.cos(a) * 18, c.y + Math.sin(a) * 8 - 50);
    ctx.lineTo(c.x + Math.cos(a) * 10, c.y + 10);
    ctx.stroke();
    circle(ctx, c.x + Math.cos(a) * 46, c.y + Math.sin(a) * 46, 8, f.pointer !== null ? GOLD : "rgba(255,213,0,0.5)");
  }
  ctx.globalAlpha = 1;

  if (ready) {
    panelReady(ctx, st, 1, t);
    return;
  }
  say(ctx, shake ? "SHAKE!" : "STIR!", cx, 30, GOLD, 2);
  if (f.pointer === null && blink(t, 2)) {
    say(ctx, shake ? "DRAG UP + DOWN" : "CIRCLES!", cx, K.H - 44, CREAM, 1.5);
  }

  // The meter up the inside edge, with the line it has to stay above
  const low = f.meter < K.FINISH_LINE;
  const liquid = low ? (blink(t, 6) ? RED : "#A02010") : shake ? "#9CDCFF" : "#E8A040";
  const thermo = ART.v2("thermometer");
  const ta = aspectOf(thermo);
  if (ta !== null) {
    // The painted thermometer: the tube runs from about 6% to 80% of its height.
    const th = K.H - 130;
    const tw = th * ta;
    const tx = x + 4;
    const ty = 56;
    const tubeTop = ty + th * 0.06;
    const tubeBot = ty + th * 0.8;
    const tubeW = tw * 0.26;
    const tcx = tx + tw / 2;
    circle(ctx, tcx, ty + th * 0.88, tw * 0.3, liquid);
    fill(ctx, tcx - tubeW / 2, tubeTop, tubeW, tubeBot - tubeTop, "#2A1A12");
    const lh = (tubeBot - tubeTop) * f.meter;
    fill(ctx, tcx - tubeW / 2, tubeBot - lh, tubeW, lh + th * 0.06, liquid);
    drawImg(ctx, s, thermo, tx, ty, tw, th);
    fill(ctx, tcx - tw * 0.4, tubeBot - (tubeBot - tubeTop) * K.FINISH_LINE - 1, tw * 0.8, 3, GOLD);
  } else {
    const mx = x + 8;
    const my = 60;
    const mh = K.H - 120;
    meterBar(ctx, mx, my, 10, mh, 0, "#000");
    fill(ctx, mx, my + mh * (1 - f.meter), 10, mh * f.meter, liquid);
    fill(ctx, mx - 4, my + mh * (1 - K.FINISH_LINE) - 1, 18, 3, GOLD);
  }
  if (low && f.clock > K.FINISH_GRACE) say(ctx, "FASTER!", cx, K.H / 2 + 60, RED, 2);
  brassMeter(ctx, x + 34, K.H - 18, l.side - 50, 7, 1 - f.clock / K.FINISH_PLAY, "#E89A20");
}

/** A strip of bar counter, for a bartender to stand behind. */
function barCounter(ctx: Ctx, x: number, w: number, y: number) {
  const g = ctx.createLinearGradient(0, y, 0, K.H);
  g.addColorStop(0, "#C88A48");
  g.addColorStop(0.15, "#8A5020");
  g.addColorStop(1, "#4A2408");
  ctx.fillStyle = g;
  ctx.fillRect(x, y, w, K.H - y);
}

/** The left thumb's panel while it isn't grabbing. */
function drawLeftIdle(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  const g = st.grab;
  drawPanel(ctx, s, 0, l.side, g.done ? "rgba(156,232,0,0.06)" : "rgba(0,0,0,0.25)");
  const cx = l.side / 2;
  if (g.done) {
    if (!spr(ctx, s, "check", cx, K.H / 2 - 22, 56)) {
      circle(ctx, cx, K.H / 2 - 20, 26, "#3A8A10");
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 6;
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(cx - 12, K.H / 2 - 20);
      ctx.lineTo(cx - 3, K.H / 2 - 10);
      ctx.lineTo(cx + 13, K.H / 2 - 32);
      ctx.stroke();
    }
    say(ctx, "GOT 'EM!", cx, K.H / 2 + 16, LIME, 2);
  } else if (g.cardT > 0 && !g.pending) {
    panelReady(ctx, st, 0, t);
  }
}

/** A slash down the middle: the next order on the left, the drink in hand on the right. */
function drawSplit(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  const f = st.finish!;
  const g = st.grab;
  const x0 = l.side;
  const x1 = l.rightX;
  const mid = (x0 + x1) / 2;
  const lw = mid - x0;

  // Left: the order
  const lc = x0 + lw / 2 - 6;
  if (g.done) {
    if (!spr(ctx, s, "check", lc, 130, 60)) {
      circle(ctx, lc, 130, 30, "#3A8A10");
      check(ctx, s, lc, 130, 1.2);
    }
    say(ctx, "GOT THE", lc, 180, LIME, 2);
    say(ctx, "BOTTLES!", lc, 200, LIME, 2);
  } else {
    say(ctx, "ORDER UP!", lc, 36, GOLD, fitScale("ORDER UP!", lw - 24, 2));
    const name = st.order.name.toUpperCase();
    drawText(ctx, name, lc, 58, CREAM, fitScale(name, lw - 24, 1.5), "center");
    st.order.recipe.forEach((ing, i) => {
      const bx = lc + (i % 2 === 0 ? -30 : 30);
      const by = 108 + Math.floor(i / 2) * 76;
      const got = g.got.includes(ing);
      ctx.globalAlpha = got ? 0.4 : 1;
      bottle(ctx, s, ing, bx, by, 42);
      ctx.globalAlpha = 1;
      if (got) check(ctx, s, bx, by, 0.9);
    });
    const tf = g.timeLeft / g.timeMax;
    brassMeter(ctx, x0 + 22, K.H - 32, lw - 56, 8, tf, tf < 0.3 ? (blink(t, 6) ? RED : "#A02010") : "#E89A20");
    if (blink(t, 1.5)) drawText(ctx, "< LEFT THUMB", lc, K.H - 16, CREAM, 1, "center");
  }

  // The slash
  ctx.strokeStyle = INK;
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.moveTo(mid + 22, 24);
  ctx.lineTo(mid - 22, K.H);
  ctx.stroke();
  ctx.strokeStyle = GOLD;
  ctx.lineWidth = 4;
  ctx.stroke();

  // Right: the drink being finished, then the guest getting it
  const rc = mid + lw / 2 + 6;
  if (!f.result) {
    const word = shakeWord(st);
    say(ctx, "KEEP", rc, 36, LIME, 2);
    say(ctx, `${word}!`, rc, 56, LIME, fitScale(`${word}!`, lw - 20, 2));
    const pose = f.cocktail.finish === "stir" ? "stir" : f.strokes % 2 ? "shake-up" : "shake-down";
    if (!drawImgCentred(ctx, s, ART.bartender(pose), rc, 190, 150)) {
      circle(ctx, rc, 160, 30, "#F0B890");
    }
    barCounter(ctx, mid - 10, x1 - mid + 10, K.H - 58);
    if (blink(t, 1.5)) drawText(ctx, "RIGHT THUMB >", rc, K.H - 16, CREAM, 1, "center");
  } else {
    const ok = f.result === "served";
    const pop = 1 + Math.max(0, 0.25 - f.resultT) * 2;
    say(ctx, ok ? "GOOD JOB!" : "OH NO!", rc, 36, ok ? LIME : RED, fitScale("GOOD JOB!", lw - 16, 2) * pop);
    const bob = Math.sin(t * (ok ? 6 : 14)) * (ok ? 3 : 1.5);
    // A happy guest with the drink, or one storming out the door
    const walked = ok ? 0 : Math.min(1, f.resultT / 1.6) * (lw * 0.4);
    const drew = ok
      ? drawImgCentred(ctx, s, ART.guest("happy"), rc, 176 + bob, 140)
      : spr(ctx, s, "walkout", rc + walked, 172 + Math.abs(Math.sin(t * 10)) * -3, 130);
    if (!drew && !drawImgCentred(ctx, s, ART.guest(ok ? "happy" : "angry"), rc, 176 + bob, 140)) {
      circle(ctx, rc, 170, 34, ok ? "#F0B890" : "#E07060");
    }
    drawText(ctx, ok ? "ONE HAPPY GUEST" : "SENT IT BACK", rc, K.H - 30, ok ? CREAM : RED, 1, "center");
  }
}

function drawFinishStage(ctx: Ctx, s: number, st: State, t: number) {
  const l = st.layout;
  const f = st.finish;
  const g = st.grab;
  if (!f) return;
  drawCentreBack(ctx, s, st, t);
  if (g.pending || g.done || g.cardT > 0) drawLeftIdle(ctx, s, st, t);
  else drawGrabPanel(ctx, s, st, 0, t);
  drawFinishPanel(ctx, s, st, t);

  const { x, w } = centreBox(st);
  const word = shakeWord(st);
  if (f.cardT > 0) {
    const shake = f.cocktail.finish === "shake";
    drawCard(
      ctx,
      x,
      36,
      w,
      270,
      [
        { text: shake ? "SHAKE IT!" : "STIR IT!", color: GOLD, scale: 4 },
        { text: f.cocktail.name.toUpperCase(), color: LIME, scale: 2 },
        {
          text: shake ? "DRAG YOUR RIGHT THUMB UP AND DOWN!" : "MOVE YOUR RIGHT THUMB IN CIRCLES!",
          color: CREAM,
          scale: 1.5,
        },
      ],
      t,
      f.cardT,
      K.FINISH_CARD,
      GOLD,
      { name: shake ? "w-shake-it" : "w-stir-it", w: 260, s }
    );
  } else if (g.pending) {
    // The right thumb alone: the bartender working the drink, big.
    say(ctx, `KEEP ${word}!`, l.w / 2, 40, LIME, fitScale(`KEEP ${word}!`, w, 3));
    const pose = f.cocktail.finish === "stir" ? "stir" : f.strokes % 2 ? "shake-up" : "shake-down";
    if (!f.result) {
      drawImgCentred(ctx, s, ART.bartender(pose), l.w / 2, 196, 200);
      barCounter(ctx, l.side, l.rightX - l.side, K.H - 40);
    } else drawSplit(ctx, s, st, t);
  } else if (g.cardT > 0 && !g.done) {
    const lines: Line[] =
      g.card === "turn"
        ? [
            { text: "YOUR TURN!", color: GOLD, scale: 3 },
            ...(f.result ? [] : [{ text: `KEEP ${word}!`, color: LIME, scale: 2 }]),
            { text: "GRAB THE COLOR BOTTLES WITH YOUR LEFT THUMB!", color: CREAM, scale: 1.5 },
          ]
        : g.card === "retry"
          ? [
              { text: "NEW ORDER!", color: RED, scale: 2.5 },
              { text: "GRAB THE COLOR BOTTLES WITH YOUR LEFT THUMB!", color: CREAM, scale: 1.5 },
            ]
          : [
              { text: "ORDER UP FOR A NEW COCKTAIL!", color: GOLD, scale: 2 },
              ...(f.result ? [] : [{ text: `KEEP ${word}!`, color: LIME, scale: 2.5 }]),
              { text: "START GRABBING BOTTLES WITH YOUR LEFT THUMB!", color: CREAM, scale: 1.5 },
            ];
    const total = g.card === "left" ? K.GRAB_CARD_LEFT : K.GRAB_CARD_SHORT;
    // The painted headline, where there is one for this card's first line.
    const head: V2Name | null =
      g.card === "turn" ? "w-your-turn" : g.card === "left" ? "w-order-up" : null;
    drawCard(ctx, x, 36, w, 270, lines, t, g.cardT, total, LIME, head ? { name: head, w: 250, s } : undefined);
  } else {
    drawSplit(ctx, s, st, t);
  }
  drawHud(ctx, st, s);
}

// ─── Micro games ─────────────────────────────────────────────────────────────

const MICRO_WORD: Record<string, V2Name> = {
  beer: "w-gimme-a-beer",
  shots: "w-lets-do-shots",
  pop: "w-pop-it",
};

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
    if (!wordArt(ctx, s, MICRO_WORD[m.kind], w / 2 + wob, K.H / 2 - 50, Math.min(w - 60, 460) * (0.6 + 0.4 * pop))) {
      say(ctx, title, w / 2 + wob, K.H / 2 - 50, CREAM, sc);
    }
    const hint = MICRO_HINT[m.kind];
    say(ctx, hint, w / 2, K.H / 2 + 30, "#FFFFFF", fitScale(hint, w - 40, 2));
    meterBar(ctx, w / 2 - 80, K.H - 40, 160, 8, 1 - m.t / K.MICRO_INTRO, CREAM);
    return;
  }

  if (m.phase === "result") {
    burst(ctx, w, m.won ? "#7AD81A" : "#E8352A", m.won ? "#3A8A10" : "#7A1010", t);
    const pop = 1 + Math.max(0, 0.4 - m.t) * 1.5;
    if (!wordArt(ctx, s, m.won ? "w-success" : "w-fail", w / 2, K.H / 2 - 40, 380 * pop)) {
      say(ctx, m.won ? "SUCCESS!" : "FAIL!", w / 2, K.H / 2 - 40, m.won ? GOLD : CREAM, 6 * pop);
    }
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

function barScene(
  ctx: Ctx,
  w: number,
  top: string,
  counterY: number,
  art?: { s: number; name: V2Name; edge: number }
) {
  // The painted scenes all have their bar top's front edge at `edge` of the image height.
  if (art && drawBackdrop(ctx, art.s, ART.v2(art.name), 0, 0, w, K.H, art.edge, counterY)) return;
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
  const counter = BEER_COUNTER_Y;
  barScene(ctx, w, "#3A2410", counter, { s, name: "bg-beer", edge: 0.675 });

  // Everything that missed, pooling on the bar
  if (sim.spill > 0) {
    const k = Math.min(1, sim.spill / BEER_SPILL_MAX);
    if (!spr(ctx, s, "splat", w / 2, counter + 10, 20 + k * 60)) {
      ctx.fillStyle = "rgba(232,154,16,0.55)";
      ctx.beginPath();
      ctx.ellipse(w / 2, counter + 14, 30 + sim.spill * 480, 6 + sim.spill * 14, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // The glass: on the bar, or lifted a touch while it's in a thumb
  const held = sim.pointer !== null;
  const gx = sim.glassX;
  const gBottom = counter - (held ? 8 : 0);
  const gTop = gBottom - BEER_GLASS_H;
  const pint = ART.v2("pint");
  const pa = aspectOf(pint);
  const gw = pa !== null ? BEER_GLASS_H * pa : (BEER_MOUTH + 6) * 2;
  const topHalf = gw / 2 - (pa !== null ? gw * 0.08 : 0);
  const botHalf = topHalf * 0.72;
  // The inside of the glass, for the beer to fill
  const glassPath = () => {
    ctx.beginPath();
    ctx.moveTo(gx - topHalf, gTop + 3);
    ctx.lineTo(gx + topHalf, gTop + 3);
    ctx.lineTo(gx + botHalf, gBottom - 8);
    ctx.lineTo(gx - botHalf, gBottom - 8);
    ctx.closePath();
  };
  if (held) {
    ctx.fillStyle = "rgba(0,0,0,0.35)";
    ctx.beginPath();
    ctx.ellipse(gx, counter + 3, botHalf + 6, 4, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // The stream: from the spout to the beer in the glass, or all the way to the bar
  const spoutY = BEER_BOTTLE_Y + 40;
  if (sim.grabbed) {
    const beerTop = gBottom - 8 - sim.fill * (BEER_GLASS_H - 14);
    const end = sim.catching ? beerTop : counter;
    const wob = Math.sin(t * 40) * 0.6;
    if (!drawImg(ctx, s, ART.v2("beer-stream"), sim.bottleX - 7 + wob, spoutY, 14, end - spoutY)) {
      fill(ctx, sim.bottleX - 2 + wob, spoutY, 4, end - spoutY, "#F0A820");
    }
    if (!sim.catching) {
      for (let i = 0; i < 5; i++) {
        const a = t * 9 + i * 1.3;
        circle(ctx, sim.bottleX + Math.cos(a) * 14, counter - 4 - Math.abs(Math.sin(a)) * 12, 2.5, "#F0B840");
      }
    }
  }

  ctx.save();
  glassPath();
  ctx.clip();
  const inner = BEER_GLASS_H - 14;
  const beerH = sim.fill * inner;
  fill(ctx, gx - gw, gBottom - 8 - beerH, gw * 2, beerH, "#E89A10");
  for (let i = 0; i < 5 && beerH > 6; i++) {
    const by = gBottom - 8 - ((t * 30 + i * 17) % beerH);
    fill(ctx, gx - 12 + ((i * 11) % 24), by, 2, 2, "rgba(255,240,180,0.7)");
  }
  if (beerH > 2) fill(ctx, gx - gw, gBottom - 8 - beerH - 7, gw * 2, 8, "#FFF8E8");
  ctx.restore();
  if (!drawImg(ctx, s, pint, gx - gw / 2, gTop, gw, BEER_GLASS_H)) {
    glassPath();
    ctx.strokeStyle = "#E8F4FF";
    ctx.lineWidth = 3;
    ctx.stroke();
  }
  if (sim.catching) {
    const glow = ctx.createRadialGradient(gx, gTop, 2, gx, gTop, 34);
    glow.addColorStop(0, "rgba(156,232,0,0.5)");
    glow.addColorStop(1, "rgba(156,232,0,0)");
    ctx.fillStyle = glow;
    ctx.fillRect(gx - 34, gTop - 34, 68, 68);
  }

  // The bottle, upside down over the bar
  ctx.save();
  ctx.translate(sim.bottleX, BEER_BOTTLE_Y);
  ctx.rotate(Math.PI + Math.sin(t * 5) * (sim.grabbed ? 0.06 : 0.02));
  if (!spr(ctx, s, "beer-bottle", 0, 0, 84)) {
    roundRect(ctx, -15, -40, 30, 62, 7);
    ctx.fillStyle = INK;
    ctx.fill();
    roundRect(ctx, -12, -37, 24, 56, 6);
    ctx.fillStyle = "#6A3A10";
    ctx.fill();
    fill(ctx, -10, -22, 20, 18, CREAM);
    fill(ctx, -7, -56, 14, 18, INK);
    fill(ctx, -5, -54, 10, 16, "#6A3A10");
  }
  ctx.restore();

  // Prompts and the meters
  if (!held) {
    const bounce = Math.abs(Math.sin(t * 6)) * 8;
    const label = sim.grabbed ? "GRAB IT!" : "GRAB THE GLASS!";
    const half = textWidth(label, 2) / 2 + 10;
    say(ctx, label, Math.max(half, Math.min(w - half, gx)), gTop - 42 - bounce, GOLD, 2);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(gx - 10, gTop - 20 - bounce);
    ctx.lineTo(gx + 10, gTop - 20 - bounce);
    ctx.lineTo(gx, gTop - 6 - bounce);
    ctx.closePath();
    ctx.fill();
  } else if (!sim.catching && blink(t, 4)) {
    say(ctx, "CATCH IT!", w / 2, 150, RED, 2);
  }
  drawText(ctx, "SPILL", 16, 22, CREAM, 1, "left");
  brassMeter(ctx, 58, 21, 80, 7, sim.spill / BEER_SPILL_MAX, RED);
  drawText(ctx, "FULL", w - 150, 22, CREAM, 1, "left");
  brassMeter(ctx, w - 110, 21, 80, 7, sim.fill, LIME);
}

function drawShots(ctx: Ctx, s: number, sim: ShotsSim, w: number, t: number) {
  const counter = K.H - 60;
  if (!drawBackdrop(ctx, s, ART.v2("bg-shots"), 0, 0, w, K.H, 0.67, counter)) {
    barScene(ctx, w, "#2A1040", counter);
    for (let i = 0; i < 20; i++) {
      const c = ["#FF4AB0", "#4AE0FF", "#FFD500"][i % 3];
      circle(ctx, ((i * 97) % w), 30 + ((i * 53) % 120), 3 + Math.sin(t * 3 + i) * 1.5, c);
    }
  }
  spr(ctx, s, "lime", w - 84, counter + 18, 30);
  spr(ctx, s, "salt", w - 36, counter + 4, 44);
  // Spill puddle
  if (sim.spill > 0) {
    const k = Math.min(1, sim.spill / SHOT_SPILL_MAX);
    if (!spr(ctx, s, k < 0.5 ? "spill-1" : "spill-2", w / 2, counter + 16, 30 + k * 50)) {
      ctx.fillStyle = "rgba(232,154,16,0.55)";
      ctx.beginPath();
      ctx.ellipse(w / 2, counter + 18, 40 + sim.spill * 220, 8 + sim.spill * 10, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  for (let i = 0; i < sim.glasses.length; i++) {
    const g = sim.glasses[i];
    const gh = 46;
    const art = ART.v2("shot-glass");
    const ga = aspectOf(art);
    const gw = ga !== null ? gh * ga : 36;
    const glass = () => {
      ctx.beginPath();
      ctx.moveTo(g.x - gw * 0.38, counter - gh + 3);
      ctx.lineTo(g.x + gw * 0.38, counter - gh + 3);
      ctx.lineTo(g.x + gw * 0.3, counter - 12);
      ctx.lineTo(g.x - gw * 0.3, counter - 12);
      ctx.closePath();
    };
    ctx.save();
    glass();
    ctx.clip();
    const inner = gh - 15;
    fill(ctx, g.x - gw, counter - 12 - g.fill * inner, gw * 2, g.fill * inner, "#E89A10");
    ctx.restore();
    if (!drawImg(ctx, s, art, g.x - gw / 2, counter - gh, gw, gh)) {
      glass();
      ctx.strokeStyle = "#EAF6FF";
      ctx.lineWidth = 2.5;
      ctx.stroke();
    }
    if (g.fill >= 0.85 && !spr(ctx, s, "check", g.x, counter + 16, 22)) {
      ctx.strokeStyle = LIME;
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(g.x - 8, counter + 14);
      ctx.lineTo(g.x - 2, counter + 20);
      ctx.lineTo(g.x + 9, counter + 8);
      ctx.stroke();
    }
  }
  // The bottle: standing on the bar until grabbed, upside down and pouring in the hand
  const bx = sim.bottleX;
  const held = sim.pointer !== null;
  const by = held ? 70 : SHOT_REST_Y;
  ctx.save();
  ctx.translate(bx, by);
  // The painted bottle is already upside down with its pourer; stood on the
  // bar it's turned the right way up. The code one is the other way round.
  const painted = aspectOf(ART.v2("shot-bottle")) !== null;
  if (held !== painted) ctx.rotate(Math.PI);
  if (!spr(ctx, s, "shot-bottle", 0, painted ? 0 : 0, 104) && !drawImgCentred(ctx, s, ART.shotsBottle, 0, 0, 90)) {
    roundRect(ctx, -16, -40, 32, 60, 6);
    ctx.fillStyle = INK;
    ctx.fill();
    roundRect(ctx, -13, -37, 26, 54, 5);
    ctx.fillStyle = "#D89A30";
    ctx.fill();
    fill(ctx, -6, -54, 12, 16, INK);
  }
  ctx.restore();
  if (held) {
    if (!painted) fill(ctx, bx - 2, by + 44, 4, 12, "#C8C8D0");
    const land = sim.landing >= 0 ? counter - 40 : counter;
    const from = by + 52;
    if (!drawImg(ctx, s, ART.v2("shot-stream"), bx - 5, from, 10, land - from)) {
      fill(ctx, bx - 1.5, from, 3, land - from, "#F0B040");
    }
  } else {
    if (!painted) fill(ctx, bx - 2, by - 56, 4, 12, "#C8C8D0");
    // Point at it until it's in a hand
    const bounce = Math.abs(Math.sin(t * 6)) * 8;
    const label = sim.grabbed ? "GRAB IT!" : "GRAB THE BOTTLE!";
    const half = textWidth(label, 2) / 2 + 10;
    say(ctx, label, Math.max(half, Math.min(w - half, bx)), by - 110 - bounce, GOLD, 2);
    ctx.fillStyle = GOLD;
    ctx.beginPath();
    ctx.moveTo(bx - 10, by - 86 - bounce);
    ctx.lineTo(bx + 10, by - 86 - bounce);
    ctx.lineTo(bx, by - 72 - bounce);
    ctx.closePath();
    ctx.fill();
  }
  drawText(ctx, "SPILL", 16, 22, CREAM, 1, "left");
  brassMeter(ctx, 58, 21, 80, 7, sim.spill / SHOT_SPILL_MAX, RED);
}

/** A party guest from the chest up — the stand-in until the guest sheet lands. */
function partyGuest(ctx: Ctx, s: number, x: number, y: number, i: number, bonked: boolean, t: number) {
  const n = (i % 4) + 1;
  if (spr(ctx, s, `guest-${n}${bonked ? "-bonk" : ""}` as V2Name, x, y + 2, 84)) return;
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
  if (!drawBackdrop(ctx, s, ART.v2("bg-champagne"), 0, 0, w, K.H, 0.67, counter)) {
    barScene(ctx, w, "#301830", counter);
  }
  // Disco sparkle
  for (let i = 0; i < 14; i++) {
    const on = Math.floor(t * 6 + i) % 3 === 0;
    if (on) fill(ctx, (i * 131) % w, 20 + ((i * 41) % 40), 3, 3, "#FFFFFF");
  }
  // Guests along the far line
  sim.guests.forEach((gx, i) => {
    const bonked = sim.bonked === i;
    const bob = Math.sin(t * 5 + i) * 3;
    partyGuest(ctx, s, gx, POP_TARGET_Y + bob, i, bonked, t);
    if (bonked) say(ctx, "OW!", gx, POP_TARGET_Y - 56, RED, 2);
  });
  // Ice bucket
  const bx = sim.bucketX;
  const by = POP_TARGET_Y + 6;
  if (spr(ctx, s, "bucket", bx, by + 2, 62)) {
    if (blink(t, 3)) say(ctx, "AIM HERE", bx, by + 38, GOLD, 1);
  } else {
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
  }

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
  // Both painted bottles share a box whose top ~45% is spray room, so drawn
  // 190 tall the neck lands about 104 up — where the cork flies from.
  const champ: V2Name = sim.cork && sim.cork.t < 0.5 ? "champ-pop" : "champ-bottle";
  const ca = aspectOf(ART.v2(champ));
  if (ca !== null) {
    drawImg(ctx, s, ART.v2(champ), (-190 * ca) / 2, -190, 190 * ca, 190);
    ctx.restore();
  } else {
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
  }

  if (sim.cork) {
    const k = Math.min(1, sim.cork.t / POP_FLIGHT);
    const tipX = px + Math.sin(sim.cork.angle) * 104;
    const tipY = py - Math.cos(sim.cork.angle) * 104;
    const cx = tipX + (popLandX(w, sim.cork.angle) - tipX) * k;
    const cy = tipY + (POP_TARGET_Y - tipY) * k;
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(sim.cork.t * 18);
    if (!spr(ctx, s, "cork", 0, 0, 26)) circle(ctx, 0, 0, 6, "#C8A070");
    ctx.restore();
    if (k < 0.6) {
      ctx.globalAlpha = 1 - k / 0.6;
      if (!spr(ctx, s, "pop-burst", tipX, tipY, 50 + k * 60)) {
        for (let i = 0; i < 6; i++) circle(ctx, tipX + (Math.random() - 0.5) * 20, tipY + (Math.random() - 0.5) * 20, 5, CREAM);
      }
      ctx.globalAlpha = 1;
    }
    // Then the bubbly keeps coming
    if (sim.cork.t > 0.15) {
      ctx.save();
      ctx.translate(tipX, tipY);
      ctx.rotate(sim.cork.angle);
      spr(ctx, s, sim.cork.t < 0.6 ? "spray-1" : "spray-2", 0, -34, 70);
      ctx.restore();
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

function drawHandoff(ctx: Ctx, s: number, st: State, t: number) {
  const h = st.handoff;
  if (!h) return;
  const w = st.layout.w;
  const out = h.reason === "out";
  burst(ctx, w, out ? "#5A1010" : "#2A1A5A", out ? "#3A0808" : "#1A0E3A", t * 0.5);

  const from = h.from !== null ? st.players[h.from] : null;
  const pop = 1 + Math.max(0, 0.3 - h.t) * 1.2;
  if (out && from) {
    const n = from.name.toUpperCase();
    if (wordArt(ctx, s, "w-youre-out", w / 2, 24, 190 * pop)) {
      drawText(ctx, n, w / 2, 50, CREAM, fitScale(n, w - 80, 1), "center");
    } else {
      say(ctx, `${n} IS OUT!`, w / 2, 22, RED, fitScale(`${n} IS OUT!`, w - 40, 3));
    }
  } else if (h.reason === "served" && from) {
    if (!wordArt(ctx, s, "w-pass-phone", w / 2, 36, 230 * pop)) {
      say(ctx, "DRINK UP! PASS THE PHONE!", w / 2, 22, LIME, fitScale("DRINK UP! PASS THE PHONE!", w - 40, 3));
    }
  } else if (!wordArt(ctx, s, "w-party-mode", w / 2, 34, 240 * pop)) {
    say(ctx, "PARTY MODE", w / 2, 22, GOLD, 3);
  }

  // Either side: who just went down (or the phone changing hands), and the
  // wheel that picked who's next.
  const side = Math.min(110, w * 0.17);
  if (out) {
    spr(ctx, s, "knocked-out", side, 176 + Math.sin(t * 3) * 3, 120);
  } else {
    spr(ctx, s, Math.floor(t * 3) % 2 ? "pass-2" : "pass-1", side, 170, 90);
  }
  ctx.save();
  ctx.translate(w - side, 170);
  const spin = h.t < 1 ? (1 - h.t) * (1 - h.t) * 40 : 0;
  ctx.rotate(Math.sin(spin) * 0.2);
  spr(ctx, s, "spinner", 0, 0, 104);
  ctx.restore();

  if (!wordArt(ctx, s, "w-up-next", w / 2, 88, 130)) drawText(ctx, "UP NEXT", w / 2, 78, "#C8B89A", 2, "center");
  const name = st.players[h.to].name.toUpperCase();
  const wob = Math.sin(t * 6) * 0.2;
  const nameScale = fitScale(name, w * 0.46, 5) + wob;
  const plateW = Math.max(160, textWidth(name, nameScale) + 50);
  drawImg(ctx, s, ART.v2("nameplate"), w / 2 - plateW / 2, 108, plateW, 58);
  say(ctx, name, w / 2, 137 - (7 * nameScale) / 2, GOLD, nameScale);

  const left = Math.max(0, Math.ceil(K.HANDOFF_SECONDS - h.t));
  say(ctx, String(left), w / 2, 184, CREAM, 5);
  if (h.t >= K.HANDOFF_TAP_GUARD && blink(t, 2)) {
    drawText(ctx, "TAP WHEN READY", w / 2, 230, CREAM, 1.5, "center");
  }
  roster(ctx, st, 262, h.to);
}

function drawOver(ctx: Ctx, s: number, st: State, t: number) {
  const w = st.layout.w;
  burst(ctx, w, "#5A1010", "#2A0606", t * 0.3);
  const title = st.mode === "party" ? "EVERYBODY'S OUT!" : "86'D!";
  const pop = 1 + Math.max(0, 0.35 - st.stageT) * 1.5;
  if (!wordArt(ctx, s, st.mode === "party" ? "w-everybodys-out" : "w-86d", w / 2, 46, (st.mode === "party" ? 290 : 200) * pop)) {
    say(ctx, title, w / 2, 30, RED, fitScale(title, w - 40, 5));
  }
  drawText(ctx, st.mode === "party" ? "TEAM SCORE" : "SCORE", w / 2, 100, "#C8B89A", 2, "center");
  say(ctx, String(st.score).padStart(6, "0"), w / 2, 122, GOLD, 5);
  drawText(ctx, `${st.served} DRINKS SERVED`, w / 2, 172, CREAM, 1.5, "center");
  if (st.mode === "party") {
    const top = [...st.players].sort((a, b) => b.points - a.points).slice(0, 5);
    spr(ctx, s, "trophy", w / 2 - 140, 208, 34);
    top.forEach((p, i) => {
      drawText(ctx, `${i + 1}. ${p.name.toUpperCase()}`, w / 2 - 110, 200 + i * 20, i === 0 ? GOLD : CREAM, 1.5, "left");
      drawText(ctx, String(p.points), w / 2 + 110, 200 + i * 20, i === 0 ? GOLD : CREAM, 1.5, "right");
    });
  }
}

// ─── Effects ─────────────────────────────────────────────────────────────────

function drawFx(ctx: Ctx, s: number, f: Fx) {
  const bottleArt = (c: Ctx, ing: string, h: number) => bottle(c, s, ing, 0, 0, h);
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
      if (spr(ctx, s, k < 0.33 ? "grab-1" : k < 0.66 ? "grab-2" : "grab-3", f.x, f.y, 70 + k * 30)) break;
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
      if (spr(ctx, s, (["boom-1", "boom-2", "boom-3", "boom-4"] as const)[Math.min(3, Math.floor(k * 4))], f.x, f.y - k * 10, 90 + k * 40)) break;
      circle(ctx, f.x, f.y, 10 + k * 70, `rgba(255,${Math.round(200 - k * 150)},0,${1 - k})`);
      circle(ctx, f.x, f.y, 6 + k * 40, `rgba(255,255,200,${1 - k})`);
      for (let i = 0; i < 6; i++) {
        const a = i * 1.1;
        circle(ctx, f.x + Math.cos(a) * k * 60, f.y + Math.sin(a) * k * 60 - k * 20, 14 * (1 - k) + 4, `rgba(80,70,60,${0.8 - k * 0.8})`);
      }
      break;
    case "shatter":
    case "splash":
      if (f.kind === "shatter" && spr(ctx, s, k < 0.5 ? "shatter-1" : "shatter-2", f.x, f.y + k * 20, 64 + k * 20)) break;
      if (f.kind === "splash" && !f.ing) {
        ctx.globalAlpha = 1 - k;
        const drew = spr(ctx, s, "splat", f.x, f.y, 40 + k * 26);
        ctx.globalAlpha = 1;
        if (drew) break;
      }
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
    case "toss": {
      // The bottle arcs from its tap zone into the tin, spinning
      const tx = f.tx ?? f.x;
      const ty = f.ty ?? f.y;
      const x = f.x + (tx - f.x) * k;
      const y = f.y + (ty - f.y) * k - Math.sin(k * Math.PI) * 70;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(k * Math.PI * 2);
      ctx.globalAlpha = k > 0.85 ? (1 - k) / 0.15 : 1;
      bottleArt(ctx, f.ing ?? "ice", 30);
      ctx.restore();
      break;
    }
    case "stink":
      ctx.globalAlpha = 1 - k;
      spr(ctx, s, k < 0.3 ? "stink-1" : "stink-2", f.x, f.y - k * 30, 60 + k * 20);
      ctx.globalAlpha = 1;
      break;
    case "flame":
      ctx.globalAlpha = 1 - Math.max(0, k - 0.5) * 2;
      spr(ctx, s, k < 0.5 ? "flame-1" : "flame-2", f.x, f.y - 34, 76);
      ctx.globalAlpha = 1;
      break;
    default:
      break;
  }
}

const BANNER_ART: Record<string, V2Name> = {
  "BOOM!": "w-boom",
  "LAST ONE STANDING!": "w-last-one-standing",
};

function drawBanner(ctx: Ctx, s: number, st: State) {
  const b = st.banner;
  if (!b) return;
  const w = st.layout.w;
  const pop = b.t < 0.15 ? 0.5 + (b.t / 0.15) * 0.7 : b.t < 0.25 ? 1.2 - ((b.t - 0.15) / 0.1) * 0.2 : 1;
  const fade = b.t > b.dur - 0.25 ? (b.dur - b.t) / 0.25 : 1;
  ctx.globalAlpha = Math.max(0, fade);
  const sc = fitScale(b.text, w * 0.7, 5) * pop;
  const y = st.stage === "build" ? 110 : K.H / 2 - 20;
  const art = BANNER_ART[b.text];
  if (!art || !wordArt(ctx, s, art, w / 2, y + 16, (art === "w-boom" ? 260 : 360) * pop)) {
    say(ctx, b.text, w / 2, y, b.color, sc);
  }
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
      drawGrabStage(ctx, s, st, t);
      break;
    case "finish":
      drawFinishStage(ctx, s, st, t);
      break;
    case "build":
      drawBuild(ctx, s, st, t, false);
      drawHud(ctx, st, s);
      break;
    case "micro":
      drawMicro(ctx, s, st, t);
      break;
    case "handoff":
      drawHandoff(ctx, s, st, t);
      break;
    case "over":
      drawOver(ctx, s, st, t);
      break;
  }

  if (st.stage !== "micro" && st.stage !== "handoff") {
    for (const f of st.fx) drawFx(ctx, s, f);
    drawBanner(ctx, s, st);
  }
  if (st.flash) {
    ctx.fillStyle = `rgba(228,43,32,${0.35 * (1 - st.flash.t / 0.35)})`;
    ctx.fillRect(0, 0, l.w, K.H);
  }
  ctx.restore();
}
