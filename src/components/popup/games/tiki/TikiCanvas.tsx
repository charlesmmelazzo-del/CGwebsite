"use client";

import { useCallback, useEffect, useRef } from "react";
import { heightFor, PIXEL_SCALE, W } from "./constants";

export interface DragHandlers {
  /** -1..1, how hard the thumb is pulling. 0 when nothing is held. */
  onDrag: (dir: number) => void;
  /** A tap that wasn't a drag, in logical coordinates. */
  onTap: (x: number, y: number, h: number) => void;
}

/**
 * The Tiki Wars screen.
 *
 * Its own canvas rather than ArcadeCanvas because this game does not share the
 * other two games' fixed 224x288 shape: the width is fixed at 270 so every
 * hitbox means the same thing everywhere, and the HEIGHT flexes with the device
 * so the game fills a phone edge to edge instead of letterboxing. Bending
 * ArcadeCanvas into doing both would put the other two games at risk for no
 * gain.
 *
 * Drag is tracked RELATIVELY — how far the thumb has moved since it went down,
 * not where it is on screen. Absolute tracking would teleport the character to
 * wherever a thumb happened to land, which on a phone happens constantly as the
 * guest re-plants their grip.
 */
export default function TikiCanvas({
  onFrame,
  running,
  onDrag,
  onTap,
}: {
  onFrame: (ctx: CanvasRenderingContext2D, dt: number, t: number, h: number) => void;
  running: boolean;
  onDrag: DragHandlers["onDrag"];
  onTap: DragHandlers["onTap"];
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const dragRef = useRef(onDrag);
  dragRef.current = onDrag;
  const tapRef = useRef(onTap);
  tapRef.current = onTap;

  const logicalH = useRef(540);
  const pointer = useRef<{ id: number; x: number; startX: number; startY: number; moved: boolean } | null>(null);

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
      // Clamp dt: a backgrounded tab or a slow frame must never teleport an
      // enemy through the contact band and take health the guest never saw.
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

  // ── Drag ─────────────────────────────────────────────────────────────────
  // Full drag travel across ~40% of the screen width gives full deflection:
  // enough that a small thumb movement is precise, short enough that a guest
  // can cross the road without re-planting.
  const travel = useCallback(() => {
    const r = wrapRef.current?.getBoundingClientRect();
    return Math.max(60, (r?.width ?? 320) * 0.4);
  }, []);

  function down(e: React.PointerEvent) {
    e.preventDefault();
    if (pointer.current) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    pointer.current = { id: e.pointerId, x: e.clientX, startX: e.clientX, startY: e.clientY, moved: false };
  }

  function move(e: React.PointerEvent) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    e.preventDefault();
    p.x = e.clientX;
    const d = (p.x - p.startX) / travel();
    if (Math.abs(p.x - p.startX) > 6) p.moved = true;
    dragRef.current(Math.max(-1, Math.min(1, d)));
  }

  function up(e: React.PointerEvent) {
    const p = pointer.current;
    if (!p || p.id !== e.pointerId) return;
    e.preventDefault();
    pointer.current = null;
    dragRef.current(0);

    if (!p.moved) {
      const r = wrapRef.current?.getBoundingClientRect();
      if (r) {
        const lx = ((p.startX - r.left) / r.width) * W;
        const ly = ((p.startY - r.top) / r.height) * logicalH.current;
        tapRef.current(lx, ly, logicalH.current);
      }
    }
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
        // of these, a drag across the screen starts a text selection, raises
        // the iOS copy/paste callout, scrolls the page out from under the
        // player, or triggers pull-to-refresh mid-run.
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        overscrollBehavior: "none",
        cursor: "none",
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
