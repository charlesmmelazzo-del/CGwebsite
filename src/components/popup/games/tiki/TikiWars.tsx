"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawText, pad, textWidth } from "../arcade";
import type { ArcadeGameProps } from "../registry";
import TikiCanvas from "./TikiCanvas";
import { QuipBag } from "./quips";
import {
  drawSprite, getImage, loadTikiArt, BLOCKER_H, BOSS_H, HELPER_H, PLAYER_H,
  SOLDIER_H, type GunArt, type SpriteKey,
} from "./sprites";
import {
  C, horizonY, PIXEL_SCALE, playerY, projectScale, projectX, projectY,
  roadHalf, W,
} from "./constants";
import {
  armorCost, bombCost, canBuyArmor, canBuyBomb, canBuyClover, cloverCost,
  freshState, GUNS, LUCK_STEP, MAX_ARMOR, MAX_LUCK,
  MAX_BOMBS, MAX_HEALTH, MAX_SCORE, runDetail, update, detonateBomb, worldSpeed,
  DRAG_RANGE, GATE_REACH, GATE_CURE_HITS, HELPER_SPACING, HELPER_NX_LIMIT,
  rungOf, isGoodOption,
  isMaxedOption, type Enemy, type GunKind, type State,
} from "./tikiCore";

// ─── Progress (the save file) ────────────────────────────────────────────────

interface Progress {
  money: number;
  armor: number;
  luck: number;
  bestStage: number;
  totalScore: number;
  runs: number;
}

const BLANK: Progress = { money: 0, armor: 0, luck: 0, bestStage: 1, totalScore: 0, runs: 0 };

/**
 * Where a new run starts.
 *
 * Not stage 1: with money, armor and luck surviving a game over, restarting at
 * the bottom would let a maxed guest farm trivial early waves for free points
 * forever. Half your deepest stage is still a ramp, but never a free lunch.
 */
function startStage(p: Progress): number {
  return Math.max(1, Math.floor(p.bestStage / 2));
}

// ─── Screen phases the component owns (the run's own phases live in core) ────

type Screen = "play" | "shop";

export default function TikiWars({ onGameOver, demo, menuId, viewerId }: ArcadeGameProps) {
  const [screen, setScreen] = useState<Screen>("play");
  const [, forceRender] = useState(0);

  const progress = useRef<Progress>({ ...BLANK });
  const st = useRef<State>(freshState());
  const bag = useRef(new QuipBag());
  const reported = useRef(false);
  const shopQuip = useRef<string>("");
  const bombPulse = useRef(0);

  // Hit rectangles, written by the renderer each frame and read by the tap
  // handler. Buttons live in the canvas — the game is full-bleed and a DOM
  // control panel below it would eat the screen the art is drawn for.
  const hits = useRef<Record<string, [number, number, number, number]>>({});

  // ── Load the save file ───────────────────────────────────────────────────
  useEffect(() => {
    loadTikiArt();
    let alive = true;
    async function load() {
      if (demo || !menuId || !viewerId) {
        st.current = freshState();
        return;
      }
      try {
        const res = await fetch(`/api/popup/tiki?menuId=${encodeURIComponent(menuId)}`);
        if (!res.ok || !alive) return;
        const data = await res.json();
        const p: Progress = { ...BLANK, ...(data.progress ?? {}) };
        progress.current = p;
        st.current = freshState({
          stage: startStage(p),
          money: p.money,
          armor: p.armor,
          luck: p.luck,
          score: p.totalScore,
        });
      } catch {
        /* a save file that won't load must never stop someone playing */
      }
    }
    void load();
    return () => {
      alive = false;
    };
  }, [demo, menuId, viewerId]);

  // ── Saving ───────────────────────────────────────────────────────────────
  const save = useCallback(async (s: State) => {
    const p = progress.current;
    const next: Progress = {
      money: s.money,
      armor: s.armor,
      luck: s.luck,
      bestStage: Math.max(p.bestStage, s.stage),
      totalScore: s.score,
      runs: p.runs + 1,
    };
    progress.current = next;
    if (demo || !menuId || !viewerId) return;
    try {
      await fetch("/api/popup/tiki", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ menuId, ...next }),
      });
    } catch {
      /* the score post is the one that matters; this is progression only */
    }
  }, [demo, menuId, viewerId]);

  // ── Demo bot ─────────────────────────────────────────────────────────────
  //
  // Lives here, next to the rules it plays against. A central bot would have to
  // know every game's internals and would rot the moment a game changed.
  const botDrag = useCallback((s: State): number => {
    // A gate is the only thing worth crossing the road for.
    if (s.gate && s.gate.z < 0.75 && !s.gate.taken) {
      const rightGood = isGoodOption(s.gate.right);
      const leftGood = isGoodOption(s.gate.left);
      const wantRight = rightGood && !leftGood;
      const wantLeft = leftGood && !rightGood;
      if (wantRight) return s.playerNx < 0.45 ? 1 : 0;
      if (wantLeft) return s.playerNx > -0.45 ? -1 : 0;
      // Both bad: run for the open edge rather than eat one.
      if (!leftGood && !rightGood) return s.playerNx > 0 ? 1 : -1;
    }
    // Otherwise: get off the line of anything close, then line up on the
    // nearest thing worth shooting.
    let threat: Enemy | null = null;
    let target: Enemy | null = null;
    for (const e of s.enemies) {
      if (e.dying > 0) continue;
      if (e.z < 0.3 && Math.abs(e.nx - s.playerNx) < 0.35) {
        if (!threat || e.z < threat.z) threat = e;
      }
      if (!target || e.z < target.z) target = e;
    }
    if (threat) return threat.nx > s.playerNx ? -1 : 1;
    if (target) {
      const d = target.nx - s.playerNx;
      return Math.abs(d) < 0.05 ? 0 : d > 0 ? 1 : -1;
    }
    return 0;
  }, []);

  // ── Input ────────────────────────────────────────────────────────────────
  // Where the character was when the thumb went down. Everything is measured
  // from here, so lifting and re-planting a thumb never moves the character.
  const anchorNx = useRef(0);

  const onDragStart = useCallback(() => {
    if (demo) return;
    anchorNx.current = st.current.playerNx;
    st.current.targetNx = st.current.playerNx;
  }, [demo]);

  const onDrag = useCallback((delta: number) => {
    if (demo) return;
    // Positional: the thumb PLACES the character. See TikiCanvas for why this
    // is not a velocity.
    const t = anchorNx.current + delta * DRAG_RANGE;
    st.current.targetNx = Math.max(-1, Math.min(1, t));
  }, [demo]);

  const onDragEnd = useCallback(() => {
    if (demo) return;
    // Released: the character holds its ground rather than coasting.
    st.current.targetNx = null;
    st.current.drag = 0;
  }, [demo]);

  const inside = (x: number, y: number, r?: [number, number, number, number]) =>
    !!r && x >= r[0] && x <= r[0] + r[2] && y >= r[1] && y <= r[1] + r[3];

  const onTap = useCallback((x: number, y: number) => {
    if (demo) return;
    const s = st.current;
    if (screen === "shop") {
      if (inside(x, y, hits.current.armor) && canBuyArmor(s)) {
        s.money -= armorCost(s.armor);
        s.armor += 1;
        shopQuip.current = bag.current.draw("shop");
      } else if (inside(x, y, hits.current.bomb) && canBuyBomb(s)) {
        s.money -= bombCost(s.bombs);
        s.bombs += 1;
        shopQuip.current = bag.current.draw("shop");
      } else if (inside(x, y, hits.current.clover) && canBuyClover(s)) {
        s.money -= cloverCost(s.luck);
        s.luck = Math.min(MAX_LUCK, s.luck + LUCK_STEP);
        // One per stop: luck compounds into every future gate, so a rich guest
        // buying the whole track at once would end the gate decision for good.
        s.cloverBought = true;
        shopQuip.current = bag.current.draw("shop");
      } else if (inside(x, y, hits.current.next)) {
        s.stage += 1;
        progress.current.bestStage = Math.max(progress.current.bestStage, s.stage);
        // Health, guns and helpers reset every stage; money, armor, luck and
        // score do not. See the table in docs/tiki-wars.md.
        const carried = freshState({
          stage: s.stage, money: s.money, armor: s.armor, luck: s.luck, score: s.score,
        });
        carried.bombs = s.bombs;
        carried.kills = s.kills;
        carried.moneyEarned = s.moneyEarned;
        carried.gatesTaken = s.gatesTaken;
        st.current = carried;
        setScreen("play");
      }
      forceRender((n) => n + 1);
      return;
    }
    if (inside(x, y, hits.current.bombBtn)) {
      if (detonateBomb(s)) bombPulse.current = 0.4;
    }
  }, [demo, screen]);

  // ── Frame ────────────────────────────────────────────────────────────────
  const onFrame = useCallback((ctx: CanvasRenderingContext2D, dt: number, t: number, h: number) => {
    const s = st.current;
    if (bombPulse.current > 0) bombPulse.current -= dt;

    if (screen === "play") {
      if (demo) {
        // The bot steers positionally too, so demo mode moves exactly the way
        // a guest's thumb does.
        s.targetNx = Math.max(-1, Math.min(1, s.playerNx + botDrag(s) * 0.35));
      }

      const wasPhase = s.phase;
      update(s, dt);

      // A pickup bark: the hero turns to camera, says one line, turns back —
      // and the game does NOT pause. Rate-limited, and suppressed whenever
      // something is close enough to kill, because being interrupted is worse
      // than missing a joke.
      // A gate bark: the hero turns to camera, says one line, turns back — and
      // the game does NOT pause. The pool depends on what the gate actually
      // did, so a POISON gets a groan rather than a cheer. A neutral rung says
      // nothing at all, because nothing happened.
      if (s.lastGate) {
        const tone = s.lastGate;
        s.lastGate = null;
        const danger = s.enemies.some((e) => e.dying <= 0 && e.z < 0.3);
        if (tone !== "neutral" && !s.bark && s.barkCooldown <= 0 && !danger) {
          s.bark = {
            text: bag.current.draw(tone === "good" ? "pickup" : "downgrade"),
            life: 1.2,
            kind: "pickup",
            tone,
          };
          s.barkCooldown = 8;
        }
      }
      if (wasPhase !== "bosskill" && s.phase === "bosskill") {
        s.bark = { text: bag.current.draw("boss"), life: 3, kind: "boss" };
      }
      if (s.phase === "cleared") {
        shopQuip.current = "";
        s.cloverBought = false;          // a fresh clover each stop
        setScreen("shop");
      }
      if (s.phase === "over" && !reported.current) {
        reported.current = true;
        // Demo mode must never land on a leaderboard: restart instead.
        if (demo) {
          st.current = freshState();
          reported.current = false;
        } else {
          void save(s).then(() => onGameOver(s.score, runDetail(s, progress.current.runs)));
        }
      }
    }

    if (screen === "shop") drawShop(ctx, s, h, hits.current, shopQuip.current, t);
    else drawField(ctx, s, h, t, hits.current, demo ?? false, bombPulse.current);
  }, [screen, demo, botDrag, onGameOver, save]);

  return (
    <div className="absolute inset-0 bg-black">
      <TikiCanvas
        onFrame={onFrame}
        running
        onDragStart={onDragStart}
        onDrag={onDrag}
        onDragEnd={onDragEnd}
        onTap={onTap}
      />
    </div>
  );
}

// ─── Rendering ───────────────────────────────────────────────────────────────

type Hits = Record<string, [number, number, number, number]>;

/**
 * Keep-out margins.
 *
 * The game is full-bleed, so its corners are the device's corners — rounded
 * screens, notches and the home indicator all land on the canvas. Nothing the
 * guest has to read or press goes inside these.
 */
const TOP_INSET = 12;
const BOTTOM_INSET = 26;

/** Which art sheet each gun uses. */
const GUN_SHEET: Record<GunKind, GunArt> = {
  pistol: "pistols",
  shotgun: "shotgun",
  uzi: "uzi",
  flame: "flame",
  laser: "laser",
};

/** Roadside dressing, fixed to the field so it streams past with the ground. */
const SCENERY: { key: SpriteKey; nx: number; phase: number; h: number }[] = [
  { key: "prop-palm", nx: -1.55, phase: 0.0, h: 150 },
  { key: "prop-beachgoer-1", nx: 1.72, phase: 0.17, h: 96 },
  { key: "prop-palm", nx: 1.62, phase: 0.34, h: 150 },
  { key: "prop-beachgoer-2", nx: -1.85, phase: 0.5, h: 96 },
  { key: "prop-palm", nx: -1.8, phase: 0.66, h: 150 },
  { key: "prop-palm", nx: 1.45, phase: 0.83, h: 150 },
];

/**
 * Draw a full-bleed image if its art has loaded. Returns false if it has not,
 * so the caller can fall back to the code-drawn version.
 */
function drawImageSprite(
  ctx: CanvasRenderingContext2D,
  key: SpriteKey,
  x: number, y: number, w: number, hh: number
): boolean {
  const img = getImage(key);
  if (!img) return false;
  ctx.drawImage(img, x, y, w, hh);
  return true;
}

/** Bands of sand, each tiled at the scale its depth calls for. */
function drawSandBands(
  ctx: CanvasRenderingContext2D,
  h: number,
  hy: number,
  scroll: number
): void {
  const img = getImage("tex-sand");
  if (!img) return;
  const BANDS = 7;
  for (let i = 0; i < BANDS; i++) {
    const z0 = 1 - i / BANDS, z1 = 1 - (i + 1) / BANDS;
    const y0 = projectY(z0, h);
    // The last band runs to the bottom of the screen. z=0 is the player's feet,
    // and there is still ground below that — without this the texture stopped
    // at his heels and left a flat strip along the bottom.
    const y1 = i === BANDS - 1 ? h : projectY(z1, h);
    const bandH = y1 - y0;
    if (bandH <= 0.5) continue;
    // Nearer bands show the grain bigger, which is what sells the depth — but
    // capped: the nearest band runs to the bottom of the screen, and scaling
    // the tile to its height put shells on the sand bigger than the hero's
    // boot.
    const tile = Math.max(12, Math.min(bandH * 2.4, 132));
    const off = (scroll * tile * 6) % tile;
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, y0, W, bandH + 1);
    ctx.clip();
    ctx.globalAlpha = 0.85;
    for (let x = -tile; x < W + tile; x += tile) {
      for (let y = y0 - tile + off; y < y0 + bandH + tile; y += tile) {
        ctx.drawImage(img, x, y, tile, tile);
      }
    }
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function drawField(
  ctx: CanvasRenderingContext2D,
  s: State,
  h: number,
  t: number,
  hits: Hits,
  demo: boolean,
  bombPulse: number
) {
  const hy = horizonY(h);
  const py = playerY(h);

  // ── Sky ────────────────────────────────────────────────────────────────
  // The painted sky, stretched across the full width and pinned to the
  // horizon. The whole reason the logical height flexes: a taller phone gets
  // MORE SKY, never a stretched picture or a letterbox — so this is drawn from
  // the horizon upward and simply runs off the top of a tall screen.
  const skyH = Math.max(hy, W * 0.62);
  if (!drawImageSprite(ctx, "bg-beach-sky", 0, hy - skyH, W, skyH)) {
    const sky = ctx.createLinearGradient(0, 0, 0, hy);
    sky.addColorStop(0, C.skyHigh);
    sky.addColorStop(1, C.skyLow);
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, W, hy + 1);
  }
  // Anything above the artwork is the sky's own top colour, so a very tall
  // phone gets more of the same rather than a hard edge.
  if (hy - skyH > 0) {
    ctx.fillStyle = C.skyHigh;
    ctx.fillRect(0, 0, W, hy - skyH + 1);
  }

  // ── Horizon ────────────────────────────────────────────────────────────
  const horizonH = W * 0.34;
  if (!drawImageSprite(ctx, "bg-beach-horizon", 0, hy - horizonH * 0.82, W, horizonH)) {
    ctx.fillStyle = C.sea;
    ctx.fillRect(0, hy - 7, W, 8);
  }

  // ── Ground ─────────────────────────────────────────────────────────────
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, hy, W, h - hy);

  // Sand, laid in bands that grow toward the camera.
  //
  // A single tiled fill would read as a flat wall, and a true per-row
  // perspective map is hundreds of draw calls a frame on a phone. Bands are the
  // middle: each is tiled at the scale its depth calls for, so the grain opens
  // out as it approaches, and the scroll makes it move.
  const world = worldSpeed(s.stage);
  drawSandBands(ctx, h, hy, t * world);

  // Perspective rungs on top: the cheapest strong motion cue there is, and the
  // thing that tells the guest how fast they are travelling — which is why it
  // has to be the SAME speed the world actually moves at.
  const scroll = (t * world) % 0.08;
  ctx.globalAlpha = 0.35;
  ctx.fillStyle = C.sandDark;
  for (let z = scroll; z < 1; z += 0.08) {
    const y = projectY(z, h);
    const hw = roadHalf(z);
    const th = Math.max(0.6, 2.4 * (1 - z));
    ctx.fillRect(W / 2 - hw, y, hw * 2, th);
  }
  ctx.globalAlpha = 1;

  // Road edges.
  ctx.strokeStyle = C.sandDark;
  ctx.lineWidth = 1.2;
  for (const side of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(projectX(side, 1), projectY(1, h));
    ctx.lineTo(projectX(side, 0), projectY(0, h));
    ctx.stroke();
  }

  // ── Scenery ────────────────────────────────────────────────────────────
  // Roadside dressing: palms and the odd sunbather, none of it interactive.
  // All of it approaches at exactly the world's speed, like the ground it is
  // standing in — see the note on worldSpeed.
  for (const p of SCENERY) {
    const z = 1 - ((t * world + p.phase) % 1);
    if (z <= 0.02 || z >= 0.99) continue;
    const sc = projectScale(z);
    drawSprite(ctx, p.key, 0, projectX(p.nx, z), projectY(z, h), {
      h: p.h * sc, pixelScale: PIXEL_SCALE,
    });
  }

  // ── Gate ───────────────────────────────────────────────────────────────
  if (s.gate && s.gate.z > 0) {
    const g = s.gate;
    const y = projectY(g.z, h);
    const hw = roadHalf(g.z);
    const gh = 66 * projectScale(g.z);
    // Panels stop short of the road edge. The gap is the escape route when
    // both sides are negative — see GATE_REACH.
    const reach = hw * GATE_REACH;

    for (const [side, o] of [[-1, g.left] as const, [1, g.right] as const]) {
      const rung = rungOf(o);
      const x0 = side < 0 ? W / 2 - reach : W / 2;
      const tone =
        rung.tone === "good" ? { fill: "rgba(60,220,120,0.34)", line: "#5CE08A" }
          : rung.tone === "neutral" ? { fill: "rgba(230,200,90,0.30)", line: "#F0D264" }
            : { fill: "rgba(230,50,50,0.34)", line: "#FF6A5E" };

      ctx.fillStyle = tone.fill;
      ctx.fillRect(x0, y - gh, reach, gh);

      // Progress toward the next rung, filling from the bottom. This is the
      // whole feedback loop for shooting a gate — without it the guest has no
      // idea whether their rounds are doing anything.
      if (o.cure > 0 && !isMaxedOption(o)) {
        const frac = o.cure / GATE_CURE_HITS;
        ctx.fillStyle = "rgba(255,255,255,0.30)";
        ctx.fillRect(x0, y - gh * frac, reach, gh * frac);
      }

      ctx.strokeStyle = tone.line;
      ctx.lineWidth = g.flipped > 0 ? 2.6 : 1.4;
      ctx.strokeRect(x0, y - gh, reach, gh);

      // Largest size that fits, and CLIPPED to its own panel either way.
      //
      // Fixed sizing drew "NOTHING" and "POISON" straight through each other
      // into one unreadable smear at distance. Refusing to draw anything that
      // didn't fit was worse — a gate with no label is a gate you cannot make
      // a decision about, and "POISON" misses fitting by a single pixel at the
      // range where you most need to read it. Clipping means the label is
      // always there and can never bleed into its neighbour.
      const sc = textWidth(rung.label, 2) <= reach - 6 ? 2 : 1;
      ctx.save();
      ctx.beginPath();
      ctx.rect(x0, y - gh, reach, gh);
      ctx.clip();
      drawText(ctx, rung.label, x0 + reach / 2, y - gh / 2 - 3 * sc, "#FFFFFF", sc, "center");
      ctx.restore();
    }

    // A step up flashes the whole gate, so it reads even mid-firefight.
    if (g.flipped > 0) {
      ctx.globalAlpha = Math.min(0.5, g.flipped);
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(W / 2 - reach, y - gh, reach * 2, gh);
      ctx.globalAlpha = 1;
    }
  }

  // ── Enemies, far to near ───────────────────────────────────────────────
  const sorted = [...s.enemies].sort((a, b) => b.z - a.z);
  for (const e of sorted) {
    if (e.z > 1.02) continue;
    const sc = projectScale(e.z);
    // Which sheet, and which animation on it.
    //
    // Blockers and bosses carry a HIT frame, so a staggered or dying one snaps
    // to it — that is what makes a landed round read as a landed round rather
    // than a number going down. Grunts have no hit frame and keep their walk;
    // the white flash carries it for them.
    const hurt = e.dying > 0 || e.stagger > 0;
    const key: SpriteKey =
      e.tier === "boss"
        ? (hurt ? `boss-${e.kind}-hit`
          : e.attacking > 0 ? `boss-${e.kind}-attack`
            : `boss-${e.kind}-walk`) as SpriteKey
        : e.tier === "blocker"
          ? (hurt ? `blk-${e.kind}-hit` : `blk-${e.kind}-walk`) as SpriteKey
          : (`${e.kind}-walk` as SpriteKey);
    const base = e.tier === "boss" ? BOSS_H : e.tier === "blocker" ? BLOCKER_H : SOLDIER_H;
    const x = projectX(e.nx, e.z);
    const y = projectY(e.z, h);
    // The attack frames are a one-shot swing, not a loop, so they run off their
    // own countdown rather than wall-clock time.
    const frame =
      e.tier === "boss" && e.attacking > 0 && !hurt
        ? (e.attacking > 0.45 ? 0 : 1)
        : Math.floor(t * 7 + e.id);

    ctx.save();
    if (e.dying > 0) {
      ctx.globalAlpha = Math.max(0, e.dying / 0.35);
      ctx.translate(0, (1 - e.dying / 0.35) * 5);
    }
    // Flash fades over its own lifetime rather than being a binary 0.85: a flat
    // near-white wipes the silhouette out completely, so a hit reads as the
    // character briefly vanishing instead of being struck.
    drawSprite(ctx, key, frame, x, y, {
      h: base * sc, pixelScale: PIXEL_SCALE,
      flash: e.flash > 0 ? Math.min(0.6, (e.flash / 0.12) * 0.6) : 0,
      burn: e.burn > 0 ? 1 : 0,
    });
    ctx.restore();

    // Health bars on BLOCKERS AND BOSSES ONLY. Grunts take a few hits now, so
    // bar-per-enemy would put one over everything on a crowded screen and read
    // as noise. A grunt's state is carried by its hit flash and stagger, which
    // is enough at that size.
    if (e.tier !== "grunt" && e.dying <= 0 && e.hp > 0) {
      const bw = Math.max(10, 26 * sc);
      const by = y - base * sc - 4;
      ctx.fillStyle = "rgba(0,0,0,0.55)";
      ctx.fillRect(x - bw / 2, by, bw, 2.6);
      ctx.fillStyle = e.tier === "boss" ? C.danger : C.flameHot;
      ctx.fillRect(x - bw / 2, by, bw * Math.max(0, e.hp / e.maxHp), 2.6);
    }
  }

  // ── Flame cone ─────────────────────────────────────────────────────────
  if (s.gun === "flame" && s.phase !== "over") {
    const range = GUNS.flame.range;
    const tipY = projectY(range, h);
    const px = projectX(s.playerNx, 0);
    const tipX = projectX(s.playerNx, range);
    const spread = GUNS.flame.spread * roadHalf(range);
    ctx.globalAlpha = 0.75;
    for (const [col, k] of [[C.flame, 1], [C.flameHot, 0.55]] as const) {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.moveTo(px - 4, py - 30);
      ctx.lineTo(tipX - spread * k + Math.sin(t * 22) * 2, tipY);
      ctx.lineTo(tipX + spread * k + Math.cos(t * 19) * 2, tipY);
      ctx.closePath();
      ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  // ── Floating score text ────────────────────────────────────────────────
  // The HUD carries health and armor and nothing else, so this is the ONLY
  // place the guest is told that dodging cost them. It has to be legible in
  // the half-second it exists.
  for (const p of s.pops) {
    const sc = projectScale(p.z);
    const rise = (1 - p.life / 0.9) * 26;
    const x = projectX(p.nx, p.z);
    const y = projectY(p.z, h) - 30 * sc - rise;
    ctx.globalAlpha = Math.min(1, p.life / 0.35);
    const size = p.good ? 1 : 2;
    // Black keyline first: these land on bright sand and would otherwise be
    // unreadable exactly when they matter.
    drawText(ctx, p.text, x + 1, y + 1, "rgba(0,0,0,0.75)", size, "center");
    drawText(ctx, p.text, x, y, p.good ? C.money : C.danger, size, "center");
    ctx.globalAlpha = 1;
  }

  // ── Helpers and the hero ───────────────────────────────────────────────
  const walk = Math.floor(t * 8);
  for (let i = 0; i < s.helpers; i++) {
    const side = i % 2 === 0 ? -1 : 1;
    const rank = Math.floor(i / 2) + 1;
    // Clamped to the screen, not to the road. A helper flanking the hero at
    // full lock sits further out than he does, and on the wider road that put
    // the outside one clean off the edge.
    const nx = Math.max(-HELPER_NX_LIMIT,
      Math.min(HELPER_NX_LIMIT, s.playerNx + side * rank * HELPER_SPACING));
    drawSprite(ctx, "helper-walk", walk + i, projectX(nx, 0.03), projectY(0.03, h), {
      h: HELPER_H, pixelScale: PIXEL_SCALE,
    });
  }

  const px = projectX(s.playerNx, 0);

  // ── The hero ───────────────────────────────────────────────────────────
  // One sheet per weapon, each carrying its own walk, hit, celebration and sad
  // poses — so which gun he holds and what he is doing are the same lookup.
  const art = GUN_SHEET[s.gun];
  const bossBeat = s.bark?.kind === "boss";
  const struck = s.invuln > 0;
  const pose: SpriteKey =
    struck ? `player-${art}-hit`
      : s.bark?.tone === "good" ? `player-${art}-cheer`
        : s.bark?.tone === "bad" ? `player-${art}-sad`
          : `player-${art}-walk`;

  if (bossBeat) {
    // The boss kill keeps its own turn-to-camera pose with the sunglasses.
    drawSprite(ctx, "player-turn-shades", 0, px, py, { h: PLAYER_H, pixelScale: PIXEL_SCALE });
  } else {
    drawSprite(ctx, pose, struck ? Math.floor(t * 12) : walk, px, py, {
      h: PLAYER_H, pixelScale: PIXEL_SCALE,
    });
  }

  // ── Bullets ────────────────────────────────────────────────────────────
  // Drawn AFTER the hero, not before. A bullet spawns at z=0.02, which projects
  // to a point INSIDE his 84px sprite — drawing them first meant every shot was
  // hidden behind him until it was well up the field, so the gun looked like it
  // was firing from somewhere near the horizon.
  for (const b of s.bullets) {
    const sc = projectScale(b.z);
    // Start at the muzzle and converge to true aim over the first stretch. The
    // offset is visual only — b.nx is what the rules hit-test against, so the
    // gun still shoots exactly where it points.
    const muzzleFade = Math.max(0, 1 - b.z / 0.22);
    const x = projectX(b.nx, b.z) + b.side * 12 * sc * muzzleFade;
    const y = projectY(b.z, h) - (26 + 24 * muzzleFade) * sc;
    // Drawn as a TRACER, not a dot. A round travelling this fast covers more
    // ground between frames than a dot is wide, so a dot strobes; a streak
    // reads as a continuous line of fire.
    const w = Math.max(1.4, 3 * sc);
    const len = Math.max(5, 14 * sc);
    // Cyan with a hard black keyline. The old warm yellow was almost exactly
    // the value and hue of the sand it flew over and simply disappeared; a cold
    // colour is the one thing this palette has that sand, sky and fruit do not.
    ctx.fillStyle = C.outline;
    ctx.fillRect(x - w / 2 - 0.9, y - len - 0.9, w + 1.8, len + 1.8);
    ctx.fillStyle = C.bulletCore;
    ctx.fillRect(x - w / 2, y - len, w, len);
    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(x - w / 2, y - len, w, len * 0.45);
  }

  // Muzzle flash. This is what actually anchors the shooting to the character —
  // without it the hero looks like a bystander while bullets appear in the
  // middle distance on their own.
  if (s.firing > 0 && s.gun !== "flame") {
    const fx = projectX(s.playerNx, 0);
    const fy = py - PLAYER_H * 0.55;
    const k = Math.min(1, s.firing / 0.06);
    for (const side of [-1, 1] as const) {
      const mx = fx + side * 12;
      ctx.globalAlpha = 0.9 * k;
      ctx.fillStyle = C.flameHot;
      ctx.beginPath();
      ctx.moveTo(mx, fy - 11 * k);
      ctx.lineTo(mx + 5 * k, fy);
      ctx.lineTo(mx, fy + 4 * k);
      ctx.lineTo(mx - 5 * k, fy);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#FFFFFF";
      ctx.beginPath();
      ctx.arc(mx, fy, 2.6 * k, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }
  }

  // ── Bark bubble ────────────────────────────────────────────────────────
  if (s.bark) drawBubble(ctx, s.bark.text, px, py - PLAYER_H - 12, h, s.bark.kind === "boss");

  // ── Damage flash ───────────────────────────────────────────────────────
  if (s.hitFlash > 0) {
    ctx.fillStyle = `rgba(255,40,30,${Math.min(0.42, s.hitFlash)})`;
    ctx.fillRect(0, 0, W, h);
  }
  if (bombPulse > 0) {
    ctx.fillStyle = `rgba(255,255,255,${Math.min(0.6, bombPulse)})`;
    ctx.fillRect(0, 0, W, h);
  }

  drawHud(ctx, s);
  drawBombButton(ctx, s, h, hits);

  if (demo) {
    drawText(ctx, "DEMO", W / 2, h - 16, "rgba(255,255,255,0.5)", 1, "center");
  }
}

/**
 * The HUD is health and armor. Nothing else.
 *
 * No stage number, no money, no luck, no score — money and luck are shown in
 * the shop, where they are actually actionable. During a run the guest should
 * be watching the road, not reading statistics.
 */
function drawHud(ctx: CanvasRenderingContext2D, s: State) {
  const x = 8;
  const w = 92;
  const y = TOP_INSET;

  ctx.fillStyle = C.hpBack;
  ctx.fillRect(x, y, w, 7);
  ctx.fillStyle = C.hp;
  ctx.fillRect(x, y, w * Math.max(0, s.health / MAX_HEALTH), 7);
  ctx.strokeStyle = "rgba(0,0,0,0.65)";
  ctx.lineWidth = 1;
  ctx.strokeRect(x + 0.5, y + 0.5, w - 1, 6);

  // Armor as discrete pips, not a bar: at a glance the guest can count how many
  // more mistakes they have left, which a part-drained bar never tells them.
  const pip = 7;
  for (let i = 0; i < MAX_ARMOR; i++) {
    const bx = x + i * (pip + 1.6);
    ctx.fillStyle = i < s.armor ? C.armor : C.armorBack;
    ctx.fillRect(bx, y + 11, pip, 4);
  }

  // Score, top right.
  //
  // Keylined rather than plain: it sits over bright sky at the start of a stage
  // and over dark sea by the horizon, and a single flat colour is unreadable
  // against one or the other. It is the run's TOTAL, which carries across Go
  // Again, so it can be a large number — hence right-aligned, growing leftward
  // into empty sky instead of pushing anything else around.
  // Zero-padded, matching the score screen and every cabinet ever built.
  const score = pad(Math.min(MAX_SCORE, Math.floor(s.score)));
  drawText(ctx, score, W - 7, y + 1, "rgba(0,0,0,0.75)", 2, "right");
  drawText(ctx, score, W - 8, y, "#FFFFFF", 2, "right");
}

function drawBombButton(ctx: CanvasRenderingContext2D, s: State, h: number, hits: Hits) {
  const size = 40;
  // Bottom-left: most guests drag with their right thumb, so the button lives
  // where the other hand already is. BOTTOM_INSET keeps it clear of the home
  // indicator on a modern phone, which sits exactly where a corner button
  // wants to be.
  const x = 10;
  const y = h - size - BOTTOM_INSET;
  hits.bombBtn = [x, y, size, size];

  ctx.globalAlpha = s.bombs > 0 ? 0.92 : 0.3;
  ctx.fillStyle = "rgba(0,0,0,0.55)";
  ctx.fillRect(x, y, size, size);
  ctx.strokeStyle = C.flameHot;
  ctx.lineWidth = 1.6;
  ctx.strokeRect(x + 0.8, y + 0.8, size - 1.6, size - 1.6);
  ctx.fillStyle = "#22222A";
  ctx.beginPath();
  ctx.arc(x + size / 2, y + size / 2 + 2, 10, 0, Math.PI * 2);
  ctx.fill();
  ctx.strokeStyle = C.flame;
  ctx.beginPath();
  ctx.moveTo(x + size / 2 + 6, y + size / 2 - 7);
  ctx.lineTo(x + size / 2 + 11, y + size / 2 - 13);
  ctx.stroke();
  drawText(ctx, `X${s.bombs}`, x + size - 4, y + size - 9, "#FFFFFF", 1, "right");
  ctx.globalAlpha = 1;
}

/** Comic speech balloon, drawn from source — which is why quips cost no art. */
function drawBubble(
  ctx: CanvasRenderingContext2D,
  text: string,
  cx: number,
  cy: number,
  h: number,
  big: boolean
) {
  const scale = big ? 2 : 1;
  const maxW = big ? 210 : 130;
  const words = text.toUpperCase().split(" ");
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (textWidth(next, scale) > maxW && line) {
      lines.push(line);
      line = word;
    } else line = next;
  }
  if (line) lines.push(line);

  const lh = 9 * scale;
  const bw = Math.max(...lines.map((l) => textWidth(l, scale))) + 12;
  const bh = lines.length * lh + 10;
  // Keep the balloon on screen and off the centre lane, so it can never hide
  // what is walking at you.
  let bx = cx - bw / 2;
  bx = Math.max(4, Math.min(W - bw - 4, bx));
  const by = Math.max(30, cy - bh);

  ctx.fillStyle = "#FFFFFF";
  ctx.strokeStyle = C.outline;
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(bx + 4, by);
  ctx.lineTo(bx + bw - 4, by);
  ctx.quadraticCurveTo(bx + bw, by, bx + bw, by + 4);
  ctx.lineTo(bx + bw, by + bh - 4);
  ctx.quadraticCurveTo(bx + bw, by + bh, bx + bw - 4, by + bh);
  ctx.lineTo(cx + 6, by + bh);
  ctx.lineTo(cx, by + bh + 7);
  ctx.lineTo(cx - 6, by + bh);
  ctx.lineTo(bx + 4, by + bh);
  ctx.quadraticCurveTo(bx, by + bh, bx, by + bh - 4);
  ctx.lineTo(bx, by + 4);
  ctx.quadraticCurveTo(bx, by, bx + 4, by);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  lines.forEach((l, i) => {
    drawText(ctx, l, bx + bw / 2, by + 5 + i * lh, C.outline, scale, "center");
  });
}

// ─── Shop ────────────────────────────────────────────────────────────────────

function drawShop(
  ctx: CanvasRenderingContext2D,
  s: State,
  h: number,
  hits: Hits,
  quip: string,
  t: number
): void {
  ctx.fillStyle = "#160E1E";
  ctx.fillRect(0, 0, W, h);

  // ── The booth ──────────────────────────────────────────────────────────
  const boothImg = getImage("shop-booth");
  // Sized to fill the space above the purchase rows rather than leaving a
  // pool of empty panel between the two.
  const boothW = Math.min(W - 26, 232);
  const boothH = boothImg ? boothW * (boothImg.height / boothImg.width) : 150;
  const boothX = (W - boothW) / 2;
  const boothY = TOP_INSET + 14;

  if (boothImg) {
    ctx.drawImage(boothImg, boothX, boothY, boothW, boothH);
  } else {
    ctx.fillStyle = "#3A2A1A";
    ctx.fillRect(boothX, boothY, boothW, boothH);
    drawText(ctx, "SHOP", W / 2, boothY + 10, "#FFE24A", 2, "center");
  }

  drawSprite(ctx, quip ? "shopkeeper-scotch-happy" : "shopkeeper-scotch", 0,
    W / 2, boothY + boothH * 0.92, { h: boothH * 0.62, pixelScale: PIXEL_SCALE });

  if (quip) drawBubble(ctx, quip, W / 2, boothY + boothH * 0.3, h, false);

  // Money is the only number that matters here, so it gets the size.
  drawText(ctx, `$${s.money}`, 10, TOP_INSET, C.money, 2, "left");
  drawText(ctx, `STAGE ${s.stage} CLEAR`, W - 10, TOP_INSET + 2,
    "rgba(255,255,255,0.5)", 1, "right");

  // ── Purchases ──────────────────────────────────────────────────────────
  // Anchored to the BOTTOM, under the thumb already holding the phone. The
  // logical height flexes 480..620, so fixed offsets strand the buttons in the
  // middle of a tall screen.
  const rows: ShopRow[] = [
    {
      key: "armor", icon: "icon-armor", label: "ARMOR",
      have: s.armor, max: MAX_ARMOR, colour: C.armor,
      cost: armorCost(s.armor), can: canBuyArmor(s),
    },
    {
      key: "bomb", icon: "icon-bomb", label: "BOMBS",
      have: s.bombs, max: MAX_BOMBS, colour: C.flame,
      cost: bombCost(s.bombs), can: canBuyBomb(s),
    },
    {
      // Luck sits beside armor because they are the two that PERSIST — what a
      // guest is really buying here is a better next run, not a better stage.
      key: "clover", icon: "icon-clover", label: "LUCK",
      have: s.luck / LUCK_STEP, max: MAX_LUCK / LUCK_STEP, colour: "#7BE38B",
      cost: cloverCost(s.luck), can: canBuyClover(s),
      note: s.cloverBought ? "ONE PER STOP" : null,
    },
  ];

  const rowH = 42;
  const gap = 6;
  const btnH = 42;
  const blockH = rows.length * (rowH + gap) + 12 + btnH;
  let y = Math.max(boothY + boothH + 12, h - BOTTOM_INSET - 12 - blockH);

  for (const row of rows) {
    hits[row.key] = [12, y, W - 24, rowH];
    drawShopRow(ctx, row, y, rowH);
    y += rowH + gap;
  }

  y += 12;
  hits.next = [12, y, W - 24, btnH];
  const pulse = Math.sin(t * 4) * 0.12 + 0.88;
  ctx.globalAlpha = pulse;
  ctx.fillStyle = "#FFD500";
  ctx.fillRect(12, y, W - 24, btnH);
  ctx.globalAlpha = 1;
  drawText(ctx, `START STAGE ${s.stage + 1}`, W / 2, y + btnH / 2 - 7, "#1A1206", 2, "center");
}

interface ShopRow {
  key: string;
  icon: SpriteKey;
  label: string;
  /** Filled segments. */
  have: number;
  max: number;
  colour: string;
  cost: number;
  can: boolean;
  note?: string | null;
}

/**
 * One shop line: what it is, how full it is, and a button to add one.
 *
 * The bar is SEGMENTED rather than continuous. Every one of these is a small
 * countable stock — ten armour plates, three bombs, ten steps of luck — and a
 * guest deciding whether to spend needs to see "three more" at a glance, which
 * a smooth bar never tells them.
 */
function drawShopRow(
  ctx: CanvasRenderingContext2D,
  row: ShopRow,
  y: number,
  rowH: number
): void {
  const full = row.have >= row.max;
  const dim = !row.can;

  ctx.fillStyle = "rgba(255,255,255,0.06)";
  ctx.fillRect(12, y, W - 24, rowH);
  ctx.strokeStyle = dim ? "rgba(255,255,255,0.13)" : row.colour;
  ctx.lineWidth = 1.3;
  ctx.strokeRect(12.6, y + 0.6, W - 25.2, rowH - 1.2);

  // Icon
  const iconH = 26;
  ctx.globalAlpha = dim ? 0.45 : 1;
  drawSprite(ctx, row.icon, 0, 32, y + rowH / 2 + iconH / 2, {
    h: iconH, pixelScale: PIXEL_SCALE,
  });
  ctx.globalAlpha = 1;

  const barX = 52;
  const barW = 126;
  drawText(ctx, row.label, barX, y + 7, dim ? "rgba(255,255,255,0.5)" : "#FFFFFF", 1, "left");
  drawText(ctx, `${row.have}/${row.max}`, barX + barW, y + 7,
    "rgba(255,255,255,0.45)", 1, "right");

  // Segmented fill
  const segY = y + 20;
  const segH = 10;
  const segGap = 1.6;
  const segW = (barW - segGap * (row.max - 1)) / row.max;
  for (let i = 0; i < row.max; i++) {
    const sx = barX + i * (segW + segGap);
    ctx.fillStyle = i < row.have ? row.colour : "rgba(255,255,255,0.10)";
    ctx.fillRect(sx, segY, segW, segH);
  }

  // Buy button
  const bw = 62;
  const bx = W - 12 - bw - 6;
  const by = y + 6;
  const bh = rowH - 12;
  if (full || row.note) {
    drawText(ctx, row.note ?? "FULL", bx + bw / 2, by + bh / 2 - 3,
      "rgba(255,255,255,0.35)", 1, "center");
  } else {
    ctx.fillStyle = row.can ? row.colour : "rgba(255,255,255,0.08)";
    ctx.fillRect(bx, by, bw, bh);
    const label = `$${row.cost}`;
    drawText(ctx, label, bx + bw / 2, by + bh / 2 - 7,
      row.can ? "#151018" : "rgba(255,255,255,0.35)", 2, "center");
  }
}

