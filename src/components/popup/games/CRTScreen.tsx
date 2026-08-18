"use client";

import type { ReactNode } from "react";

/**
 * The tube.
 *
 * A raw canvas of hard pixels reads as a flat modern graphic. What made these
 * games look the way people remember is the monitor they came out of: bright
 * pixels bloomed into their neighbours, a scanline gap sat between every row,
 * the glass darkened toward the corners, and the whole picture sat behind a
 * black bezel.
 *
 * All of that is done here in CSS over the top of the canvas, so the game code
 * stays honest low-resolution pixel pushing and pays nothing per frame.
 */
export default function CRTScreen({
  children,
  glow = "#57C7FF",
}: {
  children: ReactNode;
  /** Colour of the ambient light the tube throws onto its bezel. */
  glow?: string;
}) {
  return (
    <div
      className="relative overflow-hidden"
      style={{
        // The plastic surround, and the tube's own light spilling onto it.
        background: "#05050A",
        padding: "10px",
        boxShadow: `inset 0 0 22px rgba(0,0,0,0.95), 0 0 26px -6px ${glow}55`,
        borderRadius: "14px",
      }}
    >
      <div className="relative" style={{ borderRadius: "8px", overflow: "hidden" }}>
        {/*
          Bloom: a slightly blurred, brightened copy of the picture bleeding out
          from underneath. Cheap stand-in for phosphor glow, and it's what stops
          the art looking like flat vector shapes.
        */}
        <div
          className="relative"
          style={{ filter: "saturate(1.25) contrast(1.08) brightness(1.04)" }}
        >
          {children}
        </div>

        {/* Scanlines — one dark row between every pixel row. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to bottom, rgba(0,0,0,0) 0px, rgba(0,0,0,0) 2px, rgba(0,0,0,0.34) 3px, rgba(0,0,0,0.34) 4px)",
            mixBlendMode: "multiply",
          }}
        />

        {/* Aperture grille — the faint vertical RGB stripe of a real tube. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-[0.13]"
          style={{
            backgroundImage:
              "repeating-linear-gradient(to right, rgba(255,0,0,0.7) 0px, rgba(0,255,0,0.7) 1px, rgba(0,0,255,0.7) 2px, rgba(0,0,0,0) 3px)",
          }}
        />

        {/* Vignette: the glass falls off toward the corners. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              "radial-gradient(120% 120% at 50% 50%, rgba(0,0,0,0) 52%, rgba(0,0,0,0.55) 100%)",
          }}
        />

        {/* A single soft highlight across the top, as if light hits the glass. */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-x-0 top-0 h-1/3"
          style={{
            background: "linear-gradient(to bottom, rgba(255,255,255,0.06), rgba(255,255,255,0))",
          }}
        />
      </div>
    </div>
  );
}
