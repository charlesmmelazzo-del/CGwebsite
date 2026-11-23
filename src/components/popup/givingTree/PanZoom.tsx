"use client";

// ─── Pinch to zoom, drag to pan ──────────────────────────────────────────────
//
// A viewport around a fixed-size content box. One finger (or the mouse)
// drags; two fingers pinch; the mouse wheel zooms. Parents can glide the view
// to any rectangle (a zone, an ornament) through the ref. A tap that turned
// into a drag never clicks what's underneath.

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState, type ReactNode } from "react";
import { COPY } from "@/lib/givingTree/copy";
import { useReducedMotion, zoomTransition, ZOOM_MS } from "./motion";

export interface PanZoomHandle {
  /** Glide so this rectangle (in content pixels) fills the view. */
  zoomTo: (r: { x: number; y: number; w: number; h: number }, opts?: { maxScale?: number; visible?: number }) => void;
  fit: () => void;
  zoomBy: (factor: number) => void;
}

type View = { scale: number; tx: number; ty: number };

export default forwardRef<PanZoomHandle, {
  width: number;
  height: number;
  maxScale?: number;
  /** Largest scale the "fit" view may use (keeps a near-empty sky from ballooning). */
  maxFitScale?: number;
  className?: string;
  label: string;
  children: (scale: number) => ReactNode;
  /** Extra controls drawn over the viewport, under the zoom buttons. */
  overlay?: ReactNode;
  /** Something (a list sheet) covers part of the view: allow panning past the edges even at the full view. */
  loose?: boolean;
}>(function PanZoom({ width, height, maxScale = 6, maxFitScale = 2, className = "", label, children, overlay, loose: sheetOpen = false }, ref) {
  const box = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState({ w: 0, h: 0 });
  const [view, setView] = useState<View>({ scale: 1, tx: 0, ty: 0 });
  const [animate, setAnimate] = useState(false);
  const reduced = useReducedMotion();
  const pointers = useRef(new Map<number, { x: number; y: number }>());
  const gesture = useRef<{ moved: boolean; startDist?: number; startScale?: number; last?: { x: number; y: number } }>({ moved: false });
  const fitted = useRef(false);

  const fitScale = size.w && size.h ? Math.min(size.w / width, size.h / height, maxFitScale) : 1;
  // Zooming out stops at the whole thing in view: it never shrinks smaller.
  const minScale = fitScale;

  const clamp = useCallback(
    (v: View, loose = false): View => {
      const scale = Math.min(maxScale, Math.max(minScale, v.scale));
      // At the full view it stays centered. Zoomed in at all, it can be
      // panned past its edges by some slack, so a zone low on the tree can
      // still be lifted above the list sheet that covers the bottom half.
      const axis = (t: number, content: number, view: number, slack: number) => {
        const centered = (view - content) / 2;
        const lo = Math.min(centered, view - content) - slack;
        const hi = Math.max(centered, 0) + slack;
        return Math.min(hi, Math.max(lo, t));
      };
      const cw = width * scale, ch = height * scale;
      const zoomed = loose || sheetOpen || scale > minScale * 1.01;
      return { scale, tx: axis(v.tx, cw, size.w, zoomed ? size.w * 0.25 : 0), ty: axis(v.ty, ch, size.h, zoomed ? size.h * 0.55 : 0) };
    },
    [height, maxScale, minScale, sheetOpen, size.h, size.w, width]
  );

  const glide = useCallback((v: View) => {
    setAnimate(true);
    setView(v);
    window.setTimeout(() => setAnimate(false), ZOOM_MS + 30);
  }, []);

  const fit = useCallback(() => {
    if (!size.w) return;
    const s = fitScale;
    glide({ scale: s, tx: (size.w - width * s) / 2, ty: (size.h - height * s) / 2 });
  }, [fitScale, glide, height, size.h, size.w, width]);

  useImperativeHandle(ref, () => ({
    zoomTo(r, opts) {
      if (!size.w) return;
      // `visible`: the share of the viewport (from the top) not covered by a
      // sheet; the rectangle is fitted into that part.
      const vh = size.h * (opts?.visible ?? 1);
      const s = Math.min(opts?.maxScale ?? maxScale, (size.w / r.w) * 0.9, (vh / r.h) * 0.9);
      // With a sheet covering part of the screen, allow the slack even at
      // the full view, or a wide zone low on the tree would stay hidden.
      glide(clamp({ scale: s, tx: size.w / 2 - (r.x + r.w / 2) * s, ty: vh / 2 - (r.y + r.h / 2) * s }, vh < size.h));
    },
    fit,
    zoomBy(f) {
      setView((v) => {
        const s = v.scale * f;
        const cx = size.w / 2, cy = size.h / 2;
        return clamp({ scale: s, tx: cx - ((cx - v.tx) / v.scale) * s, ty: cy - ((cy - v.ty) / v.scale) * s });
      });
    },
  }), [clamp, fit, glide, maxScale, size.h, size.w]);

  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // First fit once the viewport has a size; refit when the content changes size.
  useEffect(() => {
    if (!size.w) return;
    const s = fitScale;
    setView({ scale: s, tx: (size.w - width * s) / 2, ty: (size.h - height * s) / 2 });
    fitted.current = true;
  }, [size.w, size.h, width, height, fitScale]);

  // Wheel zoom (non-passive so the page doesn't scroll).
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      const px = e.clientX - rect.left, py = e.clientY - rect.top;
      const f = Math.exp(-e.deltaY * 0.0015);
      setView((v) => clamp({ scale: v.scale * f, tx: px - ((px - v.tx) / v.scale) * v.scale * f, ty: py - ((py - v.ty) / v.scale) * v.scale * f }));
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [clamp]);

  function onPointerDown(e: React.PointerEvent) {
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.current.size === 1) gesture.current = { moved: false, last: { x: e.clientX, y: e.clientY } };
    if (pointers.current.size === 2) {
      const [a, b] = Array.from(pointers.current.values());
      gesture.current.startDist = Math.hypot(a.x - b.x, a.y - b.y);
      gesture.current.startScale = view.scale;
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (!pointers.current.has(e.pointerId)) return;
    const prev = pointers.current.get(e.pointerId)!;
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const rect = box.current!.getBoundingClientRect();

    if (pointers.current.size === 2 && gesture.current.startDist) {
      const [a, b] = Array.from(pointers.current.values());
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const mx = (a.x + b.x) / 2 - rect.left, my = (a.y + b.y) / 2 - rect.top;
      gesture.current.moved = true;
      setView((v) => {
        const s = (gesture.current.startScale ?? v.scale) * (dist / gesture.current.startDist!);
        const dx = (e.clientX - prev.x) / 2, dy = (e.clientY - prev.y) / 2;
        return clamp({ scale: s, tx: mx - ((mx - v.tx) / v.scale) * s + dx, ty: my - ((my - v.ty) / v.scale) * s + dy });
      });
      return;
    }
    const last = gesture.current.last;
    if (!last) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y;
    if (!gesture.current.moved && Math.hypot(dx, dy) < 6) return;
    gesture.current.moved = true;
    gesture.current.last = { x: e.clientX, y: e.clientY };
    setView((v) => clamp({ ...v, tx: v.tx + dx, ty: v.ty + dy }));
  }

  function onPointerUp(e: React.PointerEvent) {
    pointers.current.delete(e.pointerId);
    if (pointers.current.size < 2) gesture.current.startDist = undefined;
    if (pointers.current.size === 1) {
      const [p] = Array.from(pointers.current.values());
      gesture.current.last = p;
    }
  }

  /** Swallow the click that ends a drag, so dragging never opens an ornament. */
  function onClickCapture(e: React.MouseEvent) {
    if (gesture.current.moved) {
      e.stopPropagation();
      e.preventDefault();
      gesture.current.moved = false;
    }
  }

  return (
    <div
      ref={box}
      className={`relative overflow-hidden select-none ${className}`}
      style={{ touchAction: "none" }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onClickCapture={onClickCapture}
      aria-label={label}
      role="region"
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width,
          height,
          transformOrigin: "0 0",
          transform: `translate(${view.tx}px, ${view.ty}px) scale(${view.scale})`,
          transition: animate ? zoomTransition(reduced) : "none",
          visibility: fitted.current ? "visible" : "hidden",
        }}
      >
        {children(view.scale)}
      </div>
      <div className="absolute right-2 bottom-2 z-10 flex flex-col gap-1.5">
        <button type="button" className="gt-btn gt-btn-small bg-black/50" onClick={() => glide(clamp({ ...view, scale: view.scale * 1.5, tx: size.w / 2 - ((size.w / 2 - view.tx) / view.scale) * view.scale * 1.5, ty: size.h / 2 - ((size.h / 2 - view.ty) / view.scale) * view.scale * 1.5 }))} aria-label={COPY.zoomIn}>
          +
        </button>
        <button type="button" className="gt-btn gt-btn-small bg-black/50" onClick={() => glide(clamp({ ...view, scale: view.scale / 1.5, tx: size.w / 2 - ((size.w / 2 - view.tx) / view.scale) * (view.scale / 1.5), ty: size.h / 2 - ((size.h / 2 - view.ty) / view.scale) * (view.scale / 1.5) }))} aria-label={COPY.zoomOut}>
          −
        </button>
        <button type="button" className="gt-btn gt-btn-small bg-black/50" onClick={fit}>
          {COPY.resetView}
        </button>
      </div>
      {overlay}
    </div>
  );
});
