"use client";

import { useCallback, useEffect, useRef } from "react";
import { heightFor, PIXEL_SCALE, W } from "./constants";

export type SwipeDir = "up" | "down" | "left" | "right";

export interface ShotsInput {
  /** A flick from a cell toward one of its neighbours. The main move. */
  onSwipe: (x: number, y: number, dir: SwipeDir, h: number) => void;
  /** A tap that never became a flick. Selects, confirms, and advances panels. */
  onTap: (x: number, y: number, h: number) => void;
}

/**
 * The Let's Do Shots! screen.
 *
 * Its own canvas rather than ArcadeCanvas for the same reason Tiki Wars has
 * one: the board is a fixed 270 wide so a cell means the same thing on every
 * phone, while the height flexes to fill the device.
 *
 * The move is committed ON THE WAY, not on release.
 *
 * As soon as a drag passes the threshold the swap fires and the pointer is
 * spent — nothing else happens until it lifts. Waiting for release instead felt
 * consistently late, because in a game whose whole verb is "flick a bottle
 * sideways" the player has already moved on to looking at the result by the
 * time their thumb comes off the glass. It also removes a whole class of
 * mistake: a drag that wanders back over its own start cell can no longer
 * cancel the move the player already saw themselves make.
 */
export default function ShotsCanvas({
  onFrame,
  running,
  onSwipe,
  onTap,
}: {
  onFrame: (ctx: CanvasRenderingContext2D, dt: number, t: number, h: number) => void;
  running: boolean;
} & ShotsInput) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const swipeRef = useRef(onSwipe);
  swipeRef.current = onSwipe;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const logicalH = useRef(560);
  const pointer = useRef<{ id: number; x: number; y: number; spent: boolean } | null>(null);

  // ── Size to the container ────────────────────────────────────────────────
  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const r = wrap.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const h = heightFor(r.width, r.height);
    logicalH.current = h;
    const bw = W * PIXEL_SCALE;
    const bh = h * PIXEL_SCALE;
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
  }, []);

  useEffect(() => {
    resize();
    const wrap = wrapRef.current;
    if (!wrap) return;
    const ro = new ResizeObserver(resize);
    ro.observe(wrap);
    window.addEventListener("orientationchange", resize);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", resize);
    };
  }, [resize]);

  // ── Frame loop ───────────────────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    if (!running) return;

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      // Clamped: a backgrounded tab must not resolve a whole cascade in one
      // frame, which would skip the animation the player is meant to read.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
      ctx.imageSmoothingEnabled = false;
      frameRef.current(ctx, dt, elapsed, logicalH.current);

      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /** Client coordinates to logical ones. */
  const toLogical = useCallback((clientX: number, clientY: number) => {
    const r = wrapRef.current?.getBoundingClientRect();
    if (!r) return null;
    return {
      x: ((clientX - r.left) / r.width) * W,
      y: ((clientY - r.top) / r.height) * logicalH.current,
    };
  }, []);

  /**
   * How far a thumb has to travel before it counts as a flick.
   *
   * A little under half a cell. Shorter and a tap with any wobble in it throws
   * a bottle the player never meant to move; longer and the flick has to leave
   * the cell entirely, which on the outer columns means dragging off the board.
   */
  const THRESHOLD = 12;

  function down(e: React.PointerEvent) {
    if (pointer.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toLogical(e.clientX, e.clientY);
    if (!p) return;
    pointer.current = { id: e.pointerId, x: p.x, y: p.y, spent: false };
  }

  function move(e: React.PointerEvent) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId || p.spent) return;
    const now = toLogical(e.clientX, e.clientY);
    if (!now) return;
    const dx = now.x - p.x, dy = now.y - p.y;
    if (Math.abs(dx) < THRESHOLD && Math.abs(dy) < THRESHOLD) return;
    p.spent = true;
    const dir: SwipeDir =
      Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? "right" : "left") : dy > 0 ? "down" : "up";
    swipeRef.current(p.x, p.y, dir, logicalH.current);
  }

  function up(e: React.PointerEvent) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    pointer.current = null;
    if (!p.spent) tapRef.current(p.x, p.y, logicalH.current);
  }

  return (
    <div
      ref={wrapRef}
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full bg-black"
      style={{
        // A game surface must never behave like a document. Without every one
        // of these a flick starts a text selection, raises the iOS copy/paste
        // callout, scrolls the page out from under the player, or fires
        // pull-to-refresh in the middle of a stage.
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        overscrollBehavior: "none",
      }}
    >
      <canvas
        ref={canvasRef}
        className="block w-full h-full"
        style={{ imageRendering: "pixelated", touchAction: "none", display: "block" }}
      />
    </div>
  );
}
