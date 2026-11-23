// ─── The Giving Tree — animations, isolated so they can be swapped (12) ──────
//
// Zoom, flip and rise-to-star all read their timing from here. With the
// system's reduced-motion setting on, each becomes a simple fade.

"use client";

import { useEffect, useState } from "react";
import type { Transition, Variants } from "framer-motion";

export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const q = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(q.matches);
    const on = () => setReduced(q.matches);
    q.addEventListener("change", on);
    return () => q.removeEventListener("change", on);
  }, []);
  return reduced;
}

/** The pan/zoom glide when the view jumps to a zone or an ornament. */
export const ZOOM_MS = 450;
export function zoomTransition(reduced: boolean): string {
  return reduced ? "none" : `transform ${ZOOM_MS}ms cubic-bezier(0.2, 0.7, 0.2, 1)`;
}

/** The ornament card turning over to show its back. */
export function flipVariants(reduced: boolean): Variants {
  if (reduced) return { front: { opacity: 1 }, back: { opacity: 1 }, enter: { opacity: 0 } };
  return {
    enter: { rotateY: 0, scale: 0.6, opacity: 0 },
    front: { rotateY: 0, scale: 1, opacity: 1 },
    back: { rotateY: 180, scale: 1, opacity: 1 },
  };
}
export const flipTransition: Transition = { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] };

/** An ornament leaving the tree and becoming a star. */
export function riseVariants(reduced: boolean): Variants {
  if (reduced) return { start: { opacity: 1 }, end: { opacity: 0 } };
  return {
    start: { y: 0, scale: 1, opacity: 1, borderRadius: "50%" },
    end: { y: "-60vh", scale: 0.12, opacity: 0.9, borderRadius: "50%" },
  };
}
export const riseTransition = (reduced: boolean): Transition => (reduced ? { duration: 0.4 } : { duration: 1.4, ease: [0.4, 0, 0.2, 1] });
