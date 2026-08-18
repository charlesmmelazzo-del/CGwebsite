"use client";

import { useEffect, useRef } from "react";
import { GAME_H, GAME_W, PIXEL_SCALE } from "./arcade";

/**
 * The screen. A fixed 224x288 coordinate grid, on a buffer PIXEL_SCALE times
 * denser, scaled up with smoothing off so the pixels stay hard-edged.
 *
 * The transform is re-applied every frame rather than once on setup: anything
 * that calls ctx.setTransform or ctx.resetTransform mid-frame — and the
 * character compositor does, to mirror a sprite — would otherwise leave the
 * next frame drawing at 1:1 in the corner of a double-sized buffer.
 *
 * The frame callback is held in a ref rather than being a loop dependency, so
 * a game can close over fresh React state without tearing down and restarting
 * the animation loop on every render. Games keep their mutable state in refs
 * and never re-render per frame — at 60fps on a phone that matters.
 */
export default function ArcadeCanvas({
  onFrame,
  running,
  className,
  fit = "width",
}: {
  /** Called once per animation frame. dt is seconds since the last frame. */
  onFrame: (ctx: CanvasRenderingContext2D, dt: number, t: number) => void;
  running: boolean;
  className?: string;
  /**
   * "width" fills the container and takes whatever height the aspect needs.
   *
   * "contain" fills the container in BOTH directions and expects the parent to
   * already be the right shape. The parent owns the aspect ratio in that mode —
   * a canvas cannot letterbox itself the way an <img> can, so something above it
   * has to be 224:288 or the picture stretches.
   */
  fit?: "width" | "contain";
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;

    if (!running) return;

    let raf = 0;
    let last = performance.now();
    let elapsed = 0;

    const loop = (now: number) => {
      // Clamp dt: switching tabs or a slow frame must not teleport a player
      // through a floor or skip a whole rhythm note.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      elapsed += dt;

      ctx.setTransform(PIXEL_SCALE, 0, 0, PIXEL_SCALE, 0, 0);
      ctx.imageSmoothingEnabled = false;
      frameRef.current(ctx, dt, elapsed);

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  return (
    <canvas
      ref={canvasRef}
      width={GAME_W * PIXEL_SCALE}
      height={GAME_H * PIXEL_SCALE}
      className={className}
      style={{
        imageRendering: "pixelated",
        width: "100%",
        height: fit === "width" ? "auto" : "100%",
        // Only in width mode: in contain mode the PARENT holds the shape, and
        // an aspect-ratio here would fight the height it is being given.
        aspectRatio: fit === "width" ? `${GAME_W} / ${GAME_H}` : undefined,
        display: "block",
        background: "#000",
        // A game surface must never behave like a document. Without these, a
        // press-and-hold on a phone starts a text selection or raises the
        // copy/paste callout, and the gesture that was meant to be a tap ends
        // up dragging a selection across the game instead.
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
      }}
      onContextMenu={(e) => e.preventDefault()}
    />
  );
}
