"use client";

import { useCallback, useEffect, useRef } from "react";
import { PIXEL_SCALE, VIEW_W, heightFor } from "./constants";

/**
 * The Tater Tales screen.
 *
 * Its own canvas rather than ArcadeCanvas for the same reason Let's Do Shots!
 * and Tiki Wars have one: the screen is a fixed VIEW_W wide so a blast means
 * the same thing on every phone, while the height flexes to fill the device.
 *
 * Outside the range the height can flex over — a desktop window, a tablet on
 * its side — the picture is LETTERBOXED rather than stretched: pixel art
 * squashed to fit is the one thing it cannot survive.
 *
 * ONE INPUT, and it fires on POINTER DOWN.
 *
 * The whole game is "stop the sweeping thing at the right moment", so the lag
 * between the thumb touching the glass and the value being read is the game's
 * accuracy. Waiting for the release adds however long the player holds their
 * finger down — which is not a constant, and is longer when they are
 * concentrating. Firing on down also means a tap cannot be dragged into a
 * cancel, which at a bar, one-handed, is a real input.
 */
export default function TaterCanvas({
  onFrame,
  onTap,
  running,
}: {
  onFrame: (ctx: CanvasRenderingContext2D, dt: number, t: number, h: number) => void;
  onTap: (x: number, y: number, h: number) => void;
  running: boolean;
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const logicalH = useRef(600);

  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const r = wrap.getBoundingClientRect();
    if (r.width <= 0 || r.height <= 0) return;
    const h = heightFor(r.width, r.height);
    logicalH.current = h;
    const bw = VIEW_W * PIXEL_SCALE;
    const bh = h * PIXEL_SCALE;
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    // Fit the canvas inside the wrapper at its true aspect.
    const aspect = VIEW_W / h;
    let cw = r.width, ch = r.width / aspect;
    if (ch > r.height) { ch = r.height; cw = r.height * aspect; }
    canvas.style.width = `${Math.floor(cw)}px`;
    canvas.style.height = `${Math.floor(ch)}px`;
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
      // Clamped for the same reason the core clamps: a tab that comes back
      // after four seconds must not resolve a whole flight in one frame.
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

  function down(e: React.PointerEvent) {
    if (!running) return;
    const r = canvasRef.current?.getBoundingClientRect();
    if (!r || r.width <= 0) return;
    tapRef.current(
      ((e.clientX - r.left) / r.width) * VIEW_W,
      ((e.clientY - r.top) / r.height) * logicalH.current,
      logicalH.current
    );
  }

  return (
    <div
      ref={wrapRef}
      onPointerDown={down}
      onContextMenu={(e) => e.preventDefault()}
      className="relative w-full h-full bg-black flex items-center justify-center"
      style={{
        // A game surface must never behave like a document. Without every one
        // of these a tap starts a text selection, raises the iOS copy/paste
        // callout, scrolls the page out from under the player, or fires
        // pull-to-refresh in the middle of a climb.
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
        className="block"
        style={{ imageRendering: "pixelated", touchAction: "none", display: "block" }}
      />
    </div>
  );
}
