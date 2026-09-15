"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { H, widthFor } from "./constants";

export interface StickPointer {
  down: (id: number, x: number, y: number) => void;
  move: (id: number, x: number, y: number) => void;
  up: (id: number) => void;
}

/**
 * The Behind the Stick screen: sideways, two thumbs at once.
 *
 * Its own canvas for three reasons the shared ones don't cover:
 *
 *   * MULTI-TOUCH. Every pointer is tracked by id. The whole game is two
 *     thumbs doing different things at the same time, so a surface that only
 *     listens to the first finger down is a different game.
 *   * LANDSCAPE. The height is a fixed H logical units and the width follows
 *     the device (see widthFor), letterboxed outside that range.
 *   * ROTATION FALLBACK. iPhones can't be locked to landscape from a web page,
 *     and a phone with rotation lock on never turns the page at all. With
 *     `rotate` set, the stage is drawn turned 90° clockwise inside a portrait
 *     viewport, so holding the phone sideways still plays the right way up —
 *     and touches are mapped back through the same turn.
 */
export default function StickCanvas({
  onFrame,
  running,
  rotate,
  pointer,
  children,
}: {
  onFrame: (ctx: CanvasRenderingContext2D, dt: number, w: number, s: number) => void;
  running: boolean;
  /** Draw turned a quarter clockwise. Only meaningful in a portrait box. */
  rotate: boolean;
  pointer: StickPointer;
  /** Overlays that should turn with the game. */
  children?: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const frameRef = useRef(onFrame);
  frameRef.current = onFrame;
  const pointerRef = useRef(pointer);
  pointerRef.current = pointer;

  const [box, setBox] = useState({ w: 0, h: 0 });
  const logical = useRef({ w: 640, s: 1 });
  const active = useRef(new Set<number>());

  const measure = useCallback(() => {
    const el = outerRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    setBox((b) => (b.w === r.width && b.h === r.height ? b : { w: r.width, h: r.height }));
  }, []);

  useEffect(() => {
    measure();
    const el = outerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    window.addEventListener("orientationchange", measure);
    return () => {
      ro.disconnect();
      window.removeEventListener("orientationchange", measure);
    };
  }, [measure]);

  // The box the game gets once any rotation is taken into account.
  const turned = rotate && box.h > box.w;
  const effW = turned ? box.h : box.w;
  const effH = turned ? box.w : box.h;
  const w = widthFor(effW, effH);
  const cssH = Math.max(1, Math.min(effH, (effW * H) / w));
  const cssW = (cssH * w) / H;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || cssH <= 1) return;
    const dpr = Math.min(2.5, typeof window === "undefined" ? 1 : window.devicePixelRatio || 1);
    const bw = Math.round(cssW * dpr);
    const bh = Math.round(cssH * dpr);
    if (canvas.width !== bw || canvas.height !== bh) {
      canvas.width = bw;
      canvas.height = bh;
    }
    logical.current = { w, s: bh / H };
  }, [cssW, cssH, w]);

  // A pause lets go of every finger: the release lands on the overlay, not here.
  useEffect(() => {
    if (running) return;
    active.current.forEach((id) => pointerRef.current.up(id));
    active.current.clear();
  }, [running]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas || !running) return;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      // Clamped so a backgrounded tab doesn't resolve a whole grab in one frame.
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;
      const { w: lw, s } = logical.current;
      ctx.setTransform(s, 0, 0, s, 0, 0);
      ctx.imageSmoothingEnabled = true;
      frameRef.current(ctx, dt, lw, s);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [running]);

  /** Client coordinates to logical ones, back through the rotation. */
  const toLogical = useCallback(
    (clientX: number, clientY: number) => {
      const r = canvasRef.current?.getBoundingClientRect();
      if (!r || r.width <= 0 || r.height <= 0) return null;
      const lw = logical.current.w;
      if (turned) {
        return {
          x: ((clientY - r.top) / r.height) * lw,
          y: (1 - (clientX - r.left) / r.width) * H,
        };
      }
      return { x: ((clientX - r.left) / r.width) * lw, y: ((clientY - r.top) / r.height) * H };
    },
    [turned]
  );

  function down(e: React.PointerEvent) {
    if (!running) return;
    (e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId);
    const p = toLogical(e.clientX, e.clientY);
    if (!p) return;
    active.current.add(e.pointerId);
    pointerRef.current.down(e.pointerId, p.x, p.y);
  }
  function move(e: React.PointerEvent) {
    if (!active.current.has(e.pointerId)) return;
    const p = toLogical(e.clientX, e.clientY);
    if (p) pointerRef.current.move(e.pointerId, p.x, p.y);
  }
  function up(e: React.PointerEvent) {
    if (!active.current.delete(e.pointerId)) return;
    pointerRef.current.up(e.pointerId);
  }

  return (
    <div
      ref={outerRef}
      className="relative w-full h-full overflow-hidden bg-black"
      onPointerDown={down}
      onPointerMove={move}
      onPointerUp={up}
      onPointerCancel={up}
      onContextMenu={(e) => e.preventDefault()}
      style={{
        // A game surface must never behave like a document: no selection, no
        // callout, no scroll, no pull-to-refresh under a thumb.
        touchAction: "none",
        userSelect: "none",
        WebkitUserSelect: "none",
        WebkitTouchCallout: "none",
        WebkitTapHighlightColor: "transparent",
        overscrollBehavior: "none",
      }}
    >
      <div
        className="absolute left-1/2 top-1/2"
        style={{
          width: cssW,
          height: cssH,
          transform: `translate(-50%, -50%)${turned ? " rotate(90deg)" : ""}`,
        }}
      >
        <canvas ref={canvasRef} className="block w-full h-full" style={{ touchAction: "none" }} />
        {children}
      </div>
    </div>
  );
}
