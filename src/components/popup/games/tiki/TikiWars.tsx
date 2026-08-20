"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { drawText, textWidth } from "../arcade";
import type { ArcadeGameProps } from "../registry";
import TikiCanvas from "./TikiCanvas";
import { QuipBag } from "./quips";
import { drawSprite, loadTikiArt, type SpriteKey } from "./sprites";
import {
  C, horizonY, PIXEL_SCALE, playerY, projectScale, projectX, projectY,
  roadHalf, W,
} from "./constants";
import {
  armorCost, bombCost, canBuyArmor, canBuyBomb, freshState, GUNS, MAX_ARMOR,
  MAX_BOMBS, MAX_HEALTH, runDetail, update, detonateBomb, worldSpeed,
  DRAG_RANGE, GATE_REACH, GATE_CURE_HITS, rungOf, isGoodOption,
  isMaxedOption, type Enemy, type State,
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
          };
          s.barkCooldown = 8;
        }
      }
      if (wasPhase !== "bosskill" && s.phase === "bosskill") {
        s.bark = { text: bag.current.draw("boss"), life: 3, kind: "boss" };
      }
      if (s.phase === "cleared") {
        shopQuip.current = "";
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

/**
 * Whether the walk cycle art has NO arms drawn into it.
 *
 * The weapon overlays are wired up and working, but they cannot be switched on
 * against the current body: it already holds two pistols, so overlaying a
 * shotgun leaves the hero visibly carrying both. Verified on screen — it is
 * four arms of hardware, not a weapon swap.
 *
 * Flip this to true when an armless walk sheet lands, and the shotgun and uzi
 * appear with no other change. Until then the hero keeps his painted-on
 * pistols and a gun upgrade still changes how the weapon FIRES, just not how
 * it looks.
 */
const ARMLESS_BODY = false;

// Hand-tuned placement for the weapon overlays. See the note where they're drawn.
const GUN_SCALE = 1.0;
const GUN_DX = 0;
const GUN_DY = 0;

/** Scenery is fixed to the field, so it streams past at the same rate as enemies. */
const PALMS = [
  { nx: -1.55, phase: 0.0 }, { nx: 1.62, phase: 0.28 },
  { nx: -1.8, phase: 0.55 }, { nx: 1.45, phase: 0.81 },
];

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
  // The whole reason the logical height flexes: a taller phone gets more sky,
  // never a stretched picture or a letterbox.
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, C.skyHigh);
  sky.addColorStop(1, C.skyLow);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, hy + 1);

  ctx.fillStyle = C.sun;
  ctx.beginPath();
  ctx.arc(W * 0.5, hy - 34, 26, 0, Math.PI * 2);
  ctx.fill();

  // Clouds drift slowly and wrap — parallax, so they read as far away.
  ctx.fillStyle = "rgba(255,255,255,0.72)";
  for (let i = 0; i < 5; i++) {
    const cw = 34 + (i % 3) * 13;
    const cx = ((i * 79 + t * 5) % (W + 90)) - 45;
    const cy = 18 + ((i * 31) % Math.max(20, hy - 70));
    ctx.beginPath();
    ctx.ellipse(cx, cy, cw * 0.5, 6.5, 0, 0, Math.PI * 2);
    ctx.ellipse(cx + cw * 0.2, cy - 4, cw * 0.3, 5.5, 0, 0, Math.PI * 2);
    ctx.fill();
  }

  // ── Sea ────────────────────────────────────────────────────────────────
  ctx.fillStyle = C.sea;
  ctx.fillRect(0, hy - 7, W, 8);
  ctx.fillStyle = C.seaFoam;
  for (let i = 0; i < 9; i++) {
    const x = ((i * 41 + Math.sin(t * 0.7 + i) * 6) % (W + 20)) - 10;
    ctx.fillRect(x, hy - 2, 7, 1);
  }

  // ── Ground ─────────────────────────────────────────────────────────────
  ctx.fillStyle = C.sand;
  ctx.fillRect(0, hy, W, h - hy);

  // Perspective rungs: the cheapest strong motion cue there is, and the thing
  // that tells the guest how fast they are travelling — which is exactly why it
  // has to be the SAME speed the world actually moves at. This used to scroll
  // at a made-up 0.42 while enemies closed at 0.155, so the sand tore past
  // nearly three times faster than the things walking on it.
  const world = worldSpeed(s.stage);
  const scroll = (t * world) % 0.08;
  ctx.fillStyle = C.sandDark;
  for (let z = scroll; z < 1; z += 0.08) {
    const y = projectY(z, h);
    const hw = roadHalf(z);
    const th = Math.max(0.6, 2.4 * (1 - z));
    ctx.fillRect(W / 2 - hw, y, hw * 2, th);
  }

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
  for (const p of PALMS) {
    // Palms are scenery: they approach at exactly the world's speed, like the
    // ground they are standing in.
    const z = 1 - ((t * world + p.phase) % 1);
    if (z <= 0.02 || z >= 0.99) continue;
    const sc = projectScale(z);
    drawSprite(ctx, "prop-palm", 0, projectX(p.nx, z), projectY(z, h), {
      h: 150 * sc, pixelScale: PIXEL_SCALE,
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
    const base = e.tier === "boss" ? 170 : e.tier === "blocker" ? 104 : 60;
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
    const nx = Math.max(-1.1, Math.min(1.1, s.playerNx + side * rank * 0.2));
    drawSprite(ctx, "helper-walk", walk + i, projectX(nx, 0.03), projectY(0.03, h), {
      h: 62, pixelScale: PIXEL_SCALE,
    });
  }

  const px = projectX(s.playerNx, 0);
  const turning = !!s.bark;
  const shades = s.bark?.kind === "boss";
  const hurt = s.invuln > 0 && Math.floor(t * 20) % 2 === 0;
  drawSprite(
    ctx,
    turning ? (shades ? "player-turn-shades" : "player-turn") : "player-walk",
    walk,
    px,
    py,
    { h: 84, pixelScale: PIXEL_SCALE, flash: hurt ? 0.6 : 0 }
  );

  // ── Equipped weapon ────────────────────────────────────────────────────
  // Drawn OVER the walk cycle, so the body animates once for every gun rather
  // than needing a whole walk sheet per weapon.
  //
  // The offsets below are hand-tuned rather than derived. The body and the arms
  // were authored on different canvases (768 vs 1024 wide), so there is no
  // shared framing to compute an exact alignment from. If the body is ever
  // redrawn WITHOUT arms on the same canvas as the weapons, these constants go
  // away and the overlay simply lands where it was drawn.
  const overlay: SpriteKey | null =
    !ARMLESS_BODY || turning ? null
      : s.gun === "shotgun" ? "gun-shotgun"
        : s.gun === "uzi" ? "gun-uzi"
          : null;
  if (overlay) {
    drawSprite(ctx, overlay, 0, px + GUN_DX, py + GUN_DY, {
      h: 84 * GUN_SCALE, pixelScale: PIXEL_SCALE, flash: hurt ? 0.6 : 0,
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
    const fy = py - 48;
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
  if (s.bark) drawBubble(ctx, s.bark.text, px, py - 92, h, s.bark.kind === "boss");

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
) {
  ctx.fillStyle = "#160E1E";
  ctx.fillRect(0, 0, W, h);

  // ── Booth ──────────────────────────────────────────────────────────────
  const boothTop = TOP_INSET + 34;
  const boothH = Math.round(Math.min(190, Math.max(148, h * 0.30)));
  const boothBottom = boothTop + boothH;

  ctx.fillStyle = "#7A5A28";
  ctx.beginPath();
  ctx.moveTo(12, boothTop);
  ctx.lineTo(W / 2, boothTop - 30);
  ctx.lineTo(W - 12, boothTop);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#3A2A1A";
  ctx.fillRect(24, boothTop, W - 48, boothH);
  ctx.fillStyle = "#4E3722";
  ctx.fillRect(24, boothTop, W - 48, 16);
  drawText(ctx, "SHOP", W / 2, boothTop - 18, "#FFE24A", 2, "center");

  ctx.fillStyle = "#1A1208";
  ctx.fillRect(44, boothTop + 24, W - 88, boothH - 48);
  drawSprite(ctx, "shopkeeper-scotch", 0, W / 2, boothBottom - 12, {
    h: 106, pixelScale: PIXEL_SCALE,
  });

  if (quip) drawBubble(ctx, quip, W / 2, boothTop + 22, h, false);

  // Money and luck are shown HERE and nowhere else — the run's own HUD stays
  // down to health and armor, because that is all it can act on.
  drawText(ctx, `$${s.money}`, 10, TOP_INSET, C.money, 2, "left");
  drawText(ctx, `LUCK ${s.luck}%`, W - 10, TOP_INSET + 2, "#C9B6FF", 1, "right");
  drawText(ctx, `STAGE ${s.stage} CLEAR`, W / 2, boothBottom + 12, "rgba(255,255,255,0.55)", 1, "center");

  // ── Purchases ──────────────────────────────────────────────────────────
  // Anchored to the BOTTOM, not centred. The logical height flexes from 480 to
  // 620, so fixed offsets leave a tall phone with a pool of dead space — and
  // bottom-anchoring puts the buttons under the thumb that is already holding
  // the phone, instead of stranding them in the middle of the screen.
  const rowH = 34;
  const btnH = 40;
  const blockH = rowH * 2 + 10 + 22 + btnH;
  const top = Math.max(boothBottom + 26, h - BOTTOM_INSET - 16 - blockH);

  const bw = W - 40;
  let y = top;

  hits.armor = [20, y, bw, rowH];
  shopRow(ctx, 20, y, bw, `ARMOR ${s.armor}/${MAX_ARMOR}`, `$${armorCost(s.armor)}`,
    s.armor >= MAX_ARMOR ? "FULL" : null, canBuyArmor(s), C.armor);
  y += rowH + 10;

  hits.bomb = [20, y, bw, rowH];
  shopRow(ctx, 20, y, bw, `BOMB ${s.bombs}/${MAX_BOMBS}`, `$${bombCost(s.bombs)}`,
    s.bombs >= MAX_BOMBS ? "FULL" : null, canBuyBomb(s), C.flame);
  y += rowH + 22;

  hits.next = [20, y, bw, btnH];
  ctx.globalAlpha = Math.sin(t * 4) * 0.15 + 0.85;
  ctx.fillStyle = "#FFD500";
  ctx.fillRect(20, y, bw, btnH);
  ctx.globalAlpha = 1;
  drawText(ctx, `START STAGE ${s.stage + 1}`, W / 2, y + btnH / 2 - 7, "#1A1206", 2, "center");
}

function shopRow(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number,
  label: string, cost: string, note: string | null,
  affordable: boolean, accent: string
) {
  ctx.fillStyle = affordable ? "rgba(255,255,255,0.10)" : "rgba(255,255,255,0.04)";
  ctx.fillRect(x, y, w, 34);
  ctx.strokeStyle = affordable ? accent : "rgba(255,255,255,0.16)";
  ctx.lineWidth = 1.4;
  ctx.strokeRect(x + 0.7, y + 0.7, w - 1.4, 34 - 1.4);
  drawText(ctx, label, x + 8, y + 7, affordable ? "#FFFFFF" : "rgba(255,255,255,0.4)", 2, "left");
  drawText(ctx, note ?? cost, x + w - 8, y + 11,
    note ? "rgba(255,255,255,0.35)" : affordable ? C.money : "rgba(255,255,255,0.3)", 1, "right");
}
