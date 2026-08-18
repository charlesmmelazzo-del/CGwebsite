// ─── Illustrated bartenders ──────────────────────────────────────────────────
//
// The marquee figures. Flat screen-print vector — solid shapes, one heavy black
// keyline, no gradients — deliberately a different medium from the pixel
// bartender in games/sprites.ts.
//
// Both are drawn facing right on a 120x140 viewBox and mirrored by the caller,
// so the pair reads as two people working the same bar rather than one drawing
// used twice.

import { INK } from "./props";

const K = INK.black;

/** Motion arcs. What sells a shake on a printed marquee is the streaks, not the pose. */
function Streaks({ x, y, flip = false }: { x: number; y: number; flip?: boolean }) {
  return (
    <g transform={`translate(${x} ${y}) ${flip ? "scale(-1 1)" : ""}`} aria-hidden>
      <path d="M0 0 q10 -8 20 -2" stroke={K} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M2 9 q12 -9 24 -3" stroke={K} strokeWidth={3} fill="none" strokeLinecap="round" />
      <path d="M6 18 q9 -6 17 -2" stroke={K} strokeWidth={2.5} fill="none" strokeLinecap="round" />
    </g>
  );
}

/**
 * The shaker: arms up, tin overhead, motion streaks either side.
 *
 * Illustration solves what the pixel sprite could not — a drawn figure can put
 * its forearms wherever the pose needs them, so "holding the tin overhead"
 * reads immediately here where the 20px sprite had nowhere to put the arms.
 */
export function BartenderShaking({ size = 150 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 120 140" width={size * (120 / 140)} height={size}>
      {/* ── Tin, overhead, mid-shake ── */}
      <g transform="rotate(-14 62 26)">
        <path d="M50 6 h24 v7 h-24 z" fill={INK.silver} stroke={K} strokeWidth={3} />
        <path d="M47 13 h30 v8 h-30 z" fill={INK.steel} stroke={K} strokeWidth={3} />
        <path d="M48 21 h28 l-5 34 h-18 z" fill={INK.silver} stroke={K} strokeWidth={3} strokeLinejoin="round" />
        <path d="M55 26 l-3 26" stroke={INK.cream} strokeWidth={3} strokeLinecap="round" />
      </g>
      <Streaks x={26} y={14} />
      <Streaks x={100} y={16} flip />

      {/* ── Arms up to the tin ── */}
      <path
        d="M40 84 c-2 -22 6 -34 16 -40"
        stroke={K}
        strokeWidth={13}
        fill="none"
        strokeLinecap="round"
      />
      <path
        d="M40 84 c-2 -22 6 -34 16 -40"
        stroke={INK.yellow}
        strokeWidth={8}
        fill="none"
        strokeLinecap="round"
      />
      <path d="M78 84 c4 -22 -2 -34 -10 -40" stroke={K} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M78 84 c4 -22 -2 -34 -10 -40" stroke={INK.yellow} strokeWidth={8} fill="none" strokeLinecap="round" />

      {/* ── Head, in profile ── */}
      {/* Pompadour — the silhouette that dates the drawing */}
      <path
        d="M40 60 c-3 -20 6 -32 22 -32 c8 0 14 3 17 8 c4 -6 10 -6 12 -2 c-4 0 -6 3 -6 6 c0 14 -4 22 -12 26 z"
        fill={INK.yellow}
        stroke={K}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path
        d="M44 52 c0 -12 8 -20 19 -20 c11 0 18 8 18 19 c0 12 -8 20 -19 20 c-11 0 -18 -8 -18 -19 z"
        fill={INK.cream}
        stroke={K}
        strokeWidth={3.5}
      />
      <circle cx="70" cy="48" r="3" fill={K} />
      <path d="M74 60 c-4 3 -9 3 -12 1" stroke={K} strokeWidth={2.5} fill="none" strokeLinecap="round" />

      {/* ── Bow tie and torso ── */}
      <path d="M50 78 l10 6 l-10 6 z M70 78 l-10 6 l10 6 z" fill={INK.red} stroke={K} strokeWidth={2.5} />
      <path
        d="M38 138 v-34 c0 -12 8 -20 22 -20 c14 0 22 8 22 20 v34 z"
        fill={INK.yellow}
        stroke={K}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      {/* Shirt front, so the vest reads as a vest */}
      <path d="M53 90 h14 v48 h-14 z" fill={INK.cream} stroke={K} strokeWidth={3} />
    </svg>
  );
}

/**
 * The stirrer: mixing glass on the bar, bar spoon turning in it.
 *
 * Deliberately a different person from the shaker — ponytail, shirtsleeves,
 * different posture — because two mirrored copies of one figure is exactly
 * what makes cabinet art look cheap.
 */
export function BartenderStirring({ size = 150 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 120 140" width={size * (120 / 140)} height={size}>
      {/* ── Head, ponytail, in profile ── */}
      <path
        d="M42 58 c-4 -22 6 -34 22 -34 c15 0 22 10 22 24 c0 6 -1 11 -3 15 z"
        fill={K}
        stroke={K}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      {/* The tail, swung back */}
      <path
        d="M42 40 c-12 -2 -20 6 -22 18 c-1 8 2 14 7 17 c-2 -10 1 -20 8 -25 z"
        fill={K}
        stroke={K}
        strokeWidth={3}
        strokeLinejoin="round"
      />
      <path d="M20 56 h12" stroke={INK.red} strokeWidth={5} strokeLinecap="round" />
      <path
        d="M47 50 c0 -12 8 -19 18 -19 c11 0 18 8 18 19 c0 11 -8 19 -18 19 c-11 0 -18 -8 -18 -19 z"
        fill={INK.cream}
        stroke={K}
        strokeWidth={3.5}
      />
      <circle cx="72" cy="47" r="3" fill={K} />
      <path d="M76 58 c-4 3 -9 3 -12 1" stroke={K} strokeWidth={2.5} fill="none" strokeLinecap="round" />

      {/* ── Bow tie, waistcoat over shirtsleeves ── */}
      <path d="M52 76 l10 6 l-10 6 z M72 76 l-10 6 l10 6 z" fill={INK.red} stroke={K} strokeWidth={2.5} />
      <path
        d="M40 138 v-34 c0 -12 9 -20 22 -20 c13 0 22 8 22 20 v34 z"
        fill={INK.cream}
        stroke={K}
        strokeWidth={3.5}
        strokeLinejoin="round"
      />
      <path d="M50 88 v50 M74 88 v50" stroke={K} strokeWidth={3} />
      <path d="M50 88 c6 6 18 6 24 0 v50 h-24 z" fill={K} opacity={0.92} />

      {/* ── The arm out to the spoon ── */}
      <path d="M78 96 c14 -4 20 -14 22 -26" stroke={K} strokeWidth={13} fill="none" strokeLinecap="round" />
      <path d="M78 96 c14 -4 20 -14 22 -26" stroke={INK.cream} strokeWidth={8} fill="none" strokeLinecap="round" />

      {/* ── Mixing glass and spoon ── */}
      <path d="M88 74 h26 l-4 60 h-18 z" fill={INK.silver} stroke={K} strokeWidth={3.5} strokeLinejoin="round" />
      <path d="M90 96 h22 l-2 38 h-18 z" fill={INK.teal} stroke={K} strokeWidth={2.5} />
      <path d="M101 48 l-3 44" stroke={K} strokeWidth={6} strokeLinecap="round" />
      <path d="M101 48 l-3 44" stroke={INK.silver} strokeWidth={3} strokeLinecap="round" />
      <circle cx="102" cy="45" r="6" fill={INK.silver} stroke={K} strokeWidth={3} />
    </svg>
  );
}
