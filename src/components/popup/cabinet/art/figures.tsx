// ─── Illustrated bartenders ──────────────────────────────────────────────────
//
// The marquee figures. Flat screen-print vector — solid shapes, one heavy black
// keyline, no gradients — deliberately a different medium from the pixel
// bartender in games/sprites.ts.
//
// Drawn BOLD on purpose. The first attempt at these carried a detailed profile,
// separate arm strokes and a rotated tin, and at the size the marquee actually
// renders them it all collapsed into a smiley face under a stack of grey bars.
// Screen-printed cabinet art survives being small because it is built from a
// few large silhouettes with a heavy keyline, so that is what these are: one
// body shape, one head shape, one prop, nothing thinner than 4 units.
//
// Both face right on a 120x150 viewBox; the caller mirrors for the pair.

import { INK } from "./props";

const K = INK.black;

/**
 * The shaker: tin held high in both hands, motion streaks either side.
 *
 * Illustration solves what the 20px sprite could not — a drawn figure puts its
 * arms wherever the pose needs them, so the overhead shake finally reads.
 */
export function BartenderShaking({ size = 150 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 120 150" width={size * (120 / 150)} height={size}>
      {/* ── Motion streaks, clear of the tin so they read as movement ── */}
      <g stroke={INK.cream} strokeWidth={4} strokeLinecap="round" fill="none">
        <path d="M22 20 h14 M18 31 h18 M24 42 h12" />
        <path d="M98 20 h-14 M102 31 h-18 M96 42 h-12" />
      </g>

      {/* ── The tin: one solid tapered shape ── */}
      <path
        d="M46 8 h28 v10 h-28 z"
        fill={INK.silver}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M43 18 h34 l-6 38 h-22 z"
        fill={INK.silver}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M52 24 l-3 27" stroke={INK.steel} strokeWidth={5} strokeLinecap="round" />

      {/* ── Body: torso and both raised arms as ONE silhouette ── */}
      <path
        d="M60 60
           c-9 0 -15 4 -15 11
           l-11 -6 c-4 -2 -8 0 -9 4 c-1 4 1 7 5 9 l15 8
           v56 h30
           v-56 l15 -8 c4 -2 6 -5 5 -9 c-1 -4 -5 -6 -9 -4 l-11 6
           c0 -7 -6 -11 -15 -11 z"
        fill={INK.yellow}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />

      {/* ── Head: one mass, with the pompadour built into the silhouette ── */}
      <path
        d="M60 22 c-16 0 -26 10 -26 24 c0 14 10 24 26 24 c16 0 26 -10 26 -24 c0 -14 -10 -24 -26 -24 z"
        fill={INK.cream}
        stroke={K}
        strokeWidth={4}
      />
      <path
        d="M34 44 c-2 -18 8 -30 26 -30 c10 0 17 4 21 10 c-8 -2 -14 0 -18 5 c-6 -4 -18 -3 -24 4 c-3 3 -5 7 -5 11 z"
        fill={INK.yellow}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <circle cx="70" cy="44" r="4" fill={K} />
      <path d="M76 56 c-5 4 -12 4 -16 1" stroke={K} strokeWidth={3.5} fill="none" strokeLinecap="round" />

      {/* ── Bow tie, sat on the collar ── */}
      <path d="M48 76 l12 7 l-12 7 z M72 76 l-12 7 l12 7 z" fill={INK.red} stroke={K} strokeWidth={3} />
      <circle cx="60" cy="83" r="3.5" fill={INK.red} stroke={K} strokeWidth={2.5} />

      {/* ── Shirt front, so the yellow reads as a waistcoat ── */}
      <path d="M52 92 h16 v56 h-16 z" fill={INK.cream} stroke={K} strokeWidth={3.5} />
    </svg>
  );
}

/**
 * The stirrer: mixing glass on the bar, bar spoon turning in it.
 *
 * A different person from the shaker — ponytail, shirtsleeves, one arm out
 * rather than two up. Two mirrored copies of one figure is exactly what makes
 * cabinet art look cheap.
 */
export function BartenderStirring({ size = 150 }: { size?: number }) {
  return (
    <svg aria-hidden viewBox="0 0 120 150" width={size * (120 / 150)} height={size}>
      {/* ── Mixing glass, and the spoon standing in it ── */}
      <path
        d="M84 74 h30 l-5 62 h-20 z"
        fill={INK.silver}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M87 98 h24 l-3 36 h-18 z" fill={INK.teal} stroke={K} strokeWidth={3} />
      <path d="M99 40 v50" stroke={K} strokeWidth={8} strokeLinecap="round" />
      <path d="M99 40 v50" stroke={INK.silver} strokeWidth={4} strokeLinecap="round" />
      <circle cx="99" cy="36" r="7" fill={INK.silver} stroke={K} strokeWidth={4} />

      {/* ── Body: torso with one arm reaching to the spoon ── */}
      <path
        d="M56 62
           c-10 0 -16 5 -16 12
           v74 h32
           v-46 l18 -14 c4 -3 5 -7 2 -10 c-3 -4 -7 -4 -11 -1 l-9 7
           v-10 c0 -7 -6 -12 -16 -12 z"
        fill={INK.cream}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      {/* Waistcoat over the shirt */}
      <path d="M46 78 c6 7 18 7 24 0 v70 h-24 z" fill={K} />

      {/* ── Head, and the ponytail swung out behind ── */}
      <path
        d="M26 52 c-8 4 -12 14 -9 24 c2 7 7 11 12 12 c-5 -8 -5 -18 -1 -26 z"
        fill={K}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path
        d="M56 22 c-16 0 -26 10 -26 24 c0 14 10 24 26 24 c16 0 26 -10 26 -24 c0 -14 -10 -24 -26 -24 z"
        fill={INK.cream}
        stroke={K}
        strokeWidth={4}
      />
      <path
        d="M30 46 c0 -16 11 -26 26 -26 c15 0 25 9 26 22 c-6 -8 -14 -12 -26 -12 c-12 0 -20 5 -26 16 z"
        fill={K}
        stroke={K}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <path d="M30 44 h10" stroke={INK.red} strokeWidth={6} strokeLinecap="round" />
      <circle cx="66" cy="44" r="4" fill={K} />
      <path d="M72 56 c-5 4 -12 4 -16 1" stroke={K} strokeWidth={3.5} fill="none" strokeLinecap="round" />

      {/* ── Bow tie ── */}
      <path d="M44 76 l12 7 l-12 7 z M68 76 l-12 7 l12 7 z" fill={INK.red} stroke={K} strokeWidth={3} />
      <circle cx="56" cy="83" r="3.5" fill={INK.red} stroke={K} strokeWidth={2.5} />
    </svg>
  );
}
