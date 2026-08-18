// ─── Illustrated bar props ───────────────────────────────────────────────────
//
// Flat-vector illustration in the screen-printed style of an early-80s cabinet:
// solid fills, a heavy black keyline, one highlight tone at most, and no
// gradients anywhere. This is deliberately NOT the pixel art in games/sprites.ts
// — the printed art on a cabinet always embellished the game's graphics rather
// than reproducing them, and doing the same here is what stops the page looking
// like screenshots pasted around a border.
//
// Everything is drawn on a 100x100 viewBox and scaled by the caller, so props
// can be mixed at any size without re-tuning stroke weights.

import type { ReactNode } from "react";

/** Screen-print palette. Flat inks, no blends. */
export const INK = {
  black: "#0A0A0A",
  cream: "#F4E7C8",
  yellow: "#FFD11A",
  orange: "#FF7A18",
  red: "#E82C20",
  magenta: "#E5195E",
  green: "#1FA84A",
  greenDeep: "#0C6B2E",
  blue: "#1D5FD4",
  teal: "#22B8C4",
  brown: "#8A4B1E",
  amber: "#E39A2B",
  silver: "#D8D8DE",
  steel: "#9096A6",
} as const;

const K = INK.black;

function Art({
  children,
  size,
  className = "",
  flip = false,
}: {
  children: ReactNode;
  size: number;
  className?: string;
  flip?: boolean;
}) {
  return (
    <svg
      aria-hidden
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      style={{ transform: flip ? "scaleX(-1)" : undefined, overflow: "visible" }}
    >
      {children}
    </svg>
  );
}

// ─── Bottles ─────────────────────────────────────────────────────────────────

/**
 * A labelled spirit bottle. The label is a plain block with a device on it
 * rather than lettering — type this small on a printed bezel was always a
 * shape, not something you could actually read.
 */
export function Bottle({
  size = 60,
  body = INK.green,
  label = INK.cream,
  device = INK.red,
  className = "",
}: {
  size?: number;
  body?: string;
  label?: string;
  device?: string;
  className?: string;
}) {
  return (
    <Art size={size} className={className}>
      {/* Neck and cap */}
      <path d="M42 8 h16 v10 h-16 z" fill={INK.amber} stroke={K} strokeWidth={3} />
      <path d="M43 18 h14 v16 h-14 z" fill={body} stroke={K} strokeWidth={3} />
      {/* Shoulder into the body */}
      <path
        d="M43 34 c0 6 -13 8 -13 20 v34 c0 4 3 6 7 6 h26 c4 0 7 -2 7 -6 v-34 c0 -12 -13 -14 -13 -20 z"
        fill={body}
        stroke={K}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* Label */}
      <rect x="32" y="60" width="36" height="24" fill={label} stroke={K} strokeWidth={3} />
      <circle cx="50" cy="72" r="6" fill={device} stroke={K} strokeWidth={2.5} />
      {/* Single highlight down the shoulder — one tone, as a print would carry */}
      <path d="M37 44 v38" stroke={INK.cream} strokeWidth={3} strokeLinecap="round" opacity={0.5} />
    </Art>
  );
}

// ─── Fruit ───────────────────────────────────────────────────────────────────

/** A citrus wheel, cut face on. Lime, lemon and orange are one shape recoloured. */
export function CitrusWheel({
  size = 40,
  peel = INK.green,
  flesh = "#BFE86A",
  className = "",
}: {
  size?: number;
  peel?: string;
  flesh?: string;
  className?: string;
}) {
  return (
    <Art size={size} className={className}>
      <circle cx="50" cy="50" r="40" fill={peel} stroke={K} strokeWidth={4} />
      <circle cx="50" cy="50" r="31" fill={flesh} stroke={K} strokeWidth={3} />
      {/* Segment dividers */}
      {[0, 45, 90, 135, 180, 225, 270, 315].map((a) => (
        <path
          key={a}
          d="M50 50 L50 21"
          stroke={K}
          strokeWidth={2.5}
          transform={`rotate(${a} 50 50)`}
        />
      ))}
    </Art>
  );
}

/** A whole lemon, for the corners where a wheel would read as a ball. */
export function Lemon({ size = 40, className = "" }: { size?: number; className?: string }) {
  return (
    <Art size={size} className={className}>
      <path
        d="M18 50 c0 -18 14 -30 32 -30 c18 0 32 12 32 30 c0 18 -14 30 -32 30 c-18 0 -32 -12 -32 -30 z"
        fill={INK.yellow}
        stroke={K}
        strokeWidth={4}
      />
      {/* The nibs at each end that make a lemon a lemon */}
      <path d="M14 50 h6 M80 50 h6" stroke={K} strokeWidth={4} strokeLinecap="round" />
      <path d="M34 38 c6 -5 14 -7 22 -6" stroke={INK.cream} strokeWidth={3} strokeLinecap="round" />
    </Art>
  );
}

/** A pair of cherries on the stem. */
export function Cherries({ size = 44, className = "" }: { size?: number; className?: string }) {
  return (
    <Art size={size} className={className}>
      <path
        d="M50 14 c-10 14 -22 22 -28 40 M50 14 c8 16 16 24 20 40"
        stroke={INK.greenDeep}
        strokeWidth={4}
        fill="none"
        strokeLinecap="round"
      />
      <path d="M42 12 h18 l-9 8 z" fill={INK.green} stroke={K} strokeWidth={2.5} />
      <circle cx="26" cy="66" r="17" fill={INK.red} stroke={K} strokeWidth={4} />
      <circle cx="68" cy="70" r="15" fill={INK.magenta} stroke={K} strokeWidth={4} />
      <circle cx="21" cy="60" r="4" fill={INK.cream} opacity={0.75} />
      <circle cx="63" cy="65" r="3.5" fill={INK.cream} opacity={0.75} />
    </Art>
  );
}

// ─── Tools ───────────────────────────────────────────────────────────────────

/** The shaker tin. The one prop that appears at every size on this page. */
export function Shaker({
  size = 60,
  className = "",
  tilt = 0,
}: {
  size?: number;
  className?: string;
  tilt?: number;
}) {
  return (
    <Art size={size} className={className}>
      <g transform={`rotate(${tilt} 50 50)`}>
        {/* Cap */}
        <path d="M36 8 h28 v9 h-28 z" fill={INK.silver} stroke={K} strokeWidth={3} />
        {/* Collar */}
        <path d="M32 17 h36 v10 h-36 z" fill={INK.steel} stroke={K} strokeWidth={3} />
        {/* Body, tapering to the base */}
        <path
          d="M33 27 h34 l-6 62 h-22 z"
          fill={INK.silver}
          stroke={K}
          strokeWidth={3}
          strokeLinejoin="round"
        />
        {/* One printed highlight */}
        <path d="M41 32 l-4 52" stroke={INK.cream} strokeWidth={4} strokeLinecap="round" />
        <path d="M60 32 l-3 52" stroke={INK.steel} strokeWidth={3} strokeLinecap="round" />
      </g>
    </Art>
  );
}

/** The double-cone jigger. */
export function Jigger({ size = 46, className = "" }: { size?: number; className?: string }) {
  return (
    <Art size={size} className={className}>
      <path d="M22 10 h56 l-24 34 h-8 z" fill={INK.silver} stroke={K} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M46 44 h8 l18 46 h-44 z" fill={INK.steel} stroke={K} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M30 16 l16 24" stroke={INK.cream} strokeWidth={3} strokeLinecap="round" opacity={0.8} />
    </Art>
  );
}

/** The twisted bar spoon. */
export function BarSpoon({ size = 60, className = "" }: { size?: number; className?: string }) {
  return (
    <Art size={size} className={className}>
      {/* Shaft */}
      <path d="M60 6 L34 80" stroke={K} strokeWidth={7} strokeLinecap="round" />
      <path d="M60 6 L34 80" stroke={INK.silver} strokeWidth={4} strokeLinecap="round" />
      {/* The twist, as rungs across the shaft */}
      {[18, 28, 38, 48, 58].map((y, i) => (
        <path
          key={y}
          d={`M${54 - i * 3.4} ${y} l8 3`}
          stroke={K}
          strokeWidth={2.5}
          strokeLinecap="round"
        />
      ))}
      {/* Bowl */}
      <ellipse
        cx="30"
        cy="86"
        rx="13"
        ry="9"
        fill={INK.silver}
        stroke={K}
        strokeWidth={3.5}
        transform="rotate(-20 30 86)"
      />
    </Art>
  );
}

/** A martini, garnished. */
export function Martini({ size = 56, className = "" }: { size?: number; className?: string }) {
  return (
    <Art size={size} className={className}>
      {/* Bowl */}
      <path d="M14 20 h72 L50 60 z" fill={INK.magenta} stroke={K} strokeWidth={4} strokeLinejoin="round" />
      {/* Surface line, so it reads as liquid rather than a solid triangle */}
      <path d="M22 27 h56" stroke={INK.cream} strokeWidth={3} opacity={0.55} />
      {/* Stem and foot */}
      <path d="M50 60 v22" stroke={K} strokeWidth={6} strokeLinecap="round" />
      <path d="M32 90 h36" stroke={K} strokeWidth={6} strokeLinecap="round" />
      {/* Olive on a pick */}
      <path d="M64 8 L52 34" stroke={K} strokeWidth={3} strokeLinecap="round" />
      <circle cx="60" cy="18" r="7" fill={INK.green} stroke={K} strokeWidth={3} />
      <circle cx="60" cy="18" r="2.5" fill={INK.red} />
    </Art>
  );
}
