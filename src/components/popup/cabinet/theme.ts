// ─── Cabinet theme ───────────────────────────────────────────────────────────
//
// The look is airbrushed cabinet art, not web UI.
//
// Two rules everything here follows:
//
//   1. NO HARD EDGES. Every panel, button and badge is rounded. A right angle
//      on this page should be deliberate and rare.
//
//   2. NO TWO-STOP LINEAR GRADIENTS. A `linear-gradient(#A, #B)` reads as 2010
//      web chrome — you can see exactly where it starts and stops. Real cabinet
//      art was sprayed: overlapping clouds of colour with soft edges and no
//      visible seam. `airbrush()` below layers translucent radial gradients to
//      get that, which is why it returns four or five layers rather than one.
//
// The palette is the warm end of the late-70s arcade: sunset orange, hot pink,
// gold, teal, deep grape. Brighter and warmer than the blue-heavy 80s palette
// in games/arcade.ts, which stays as-is — that one is constrained to what the
// pixel art can use, this one is free.

export const C = {
  grape: "#2B0F47", // deep purple ground
  grapeDeep: "#160722",
  plum: "#5A1B6E",
  magenta: "#FF2D6F",
  sunset: "#FF6B1A",
  gold: "#FFC61A",
  cream: "#FFE9C4",
  teal: "#00C2B8",
  sky: "#57C7FF",
  ink: "#12060F",
} as const;

/**
 * Sprayed colour: overlapping translucent clouds over a deep ground.
 *
 * Each layer is a radial gradient that fades to transparent well before its
 * own edge, so no layer ever shows a boundary. Order is top-most first, the
 * way CSS stacks backgrounds.
 */
export function airbrush({
  ground = C.grapeDeep,
  clouds = [C.magenta, C.sunset, C.plum],
  intensity = 0.55,
}: {
  ground?: string;
  clouds?: string[];
  intensity?: number;
} = {}): string {
  const spots = [
    "62% 80% at 22% 18%",
    "58% 76% at 78% 26%",
    "80% 70% at 50% 96%",
    "50% 60% at 88% 78%",
  ];
  const layers = clouds.map(
    (c, i) => `radial-gradient(${spots[i % spots.length]}, ${withAlpha(c, intensity)} 0%, ${withAlpha(c, intensity * 0.5)} 38%, transparent 72%)`
  );
  // A soft warm lift across the top, then the ground underneath.
  layers.push(
    `radial-gradient(120% 90% at 50% -10%, ${withAlpha(C.cream, 0.16)} 0%, transparent 65%)`
  );
  layers.push(`linear-gradient(180deg, ${ground} 0%, ${C.ink} 100%)`);
  return layers.join(", ");
}

/** Convex plastic: the highlight sits up and left, the shade falls bottom-right. */
export function domed(color: string): string {
  return [
    `radial-gradient(58% 58% at 34% 26%, ${withAlpha("#FFFFFF", 0.85)} 0%, ${withAlpha("#FFFFFF", 0.28)} 34%, transparent 62%)`,
    `radial-gradient(90% 90% at 62% 92%, ${withAlpha("#000000", 0.42)} 0%, transparent 68%)`,
    `radial-gradient(100% 100% at 50% 50%, ${color} 0%, ${shade(color, 0.22)} 100%)`,
  ].join(", ");
}

/** A lamp behind glass — used for badges and the marquee highlight. */
export function lamp(color: string): string {
  return [
    `radial-gradient(70% 70% at 50% 30%, ${withAlpha("#FFFFFF", 0.5)} 0%, transparent 60%)`,
    `radial-gradient(100% 100% at 50% 45%, ${color} 0%, ${shade(color, 0.35)} 100%)`,
  ].join(", ");
}

// ─── Colour maths ────────────────────────────────────────────────────────────

function parse(hex: string): [number, number, number] {
  const h = hex.replace("#", "");
  const full = h.length === 3 ? h.split("").map((c) => c + c).join("") : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

export function withAlpha(hex: string, a: number): string {
  const [r, g, b] = parse(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

/** Darken toward black by `amount` (0-1). */
export function shade(hex: string, amount: number): string {
  const [r, g, b] = parse(hex);
  const f = (v: number) => Math.round(v * (1 - amount));
  return `rgb(${f(r)}, ${f(g)}, ${f(b)})`;
}

// ─── Rounding ────────────────────────────────────────────────────────────────
// One scale, so nothing on the page invents its own corner.

export const R = {
  chip: "999px",
  button: "999px",
  panel: "22px",
  screen: "28px",
  cabinet: "34px",
} as const;
