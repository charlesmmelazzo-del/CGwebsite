// ─── Notched frame and marquee lettering ─────────────────────────────────────
//
// The two structural pieces of the reference artwork.
//
// NotchedFrame is the layered outline that runs around every panel: parallel
// yellow / red / blue strokes with the corners cut off at 45°. Built from
// stacked clip-path octagons rather than an SVG border, because a stroked SVG
// rect distorts its corner geometry when the box is stretched to a responsive
// width — the notch would go lopsided at one breakpoint and not another.
//
// MarqueeWord is the two-tone block lettering: a colour fill with a contrasting
// keyline and a hard drop, printed one word per line.

import type { ReactNode } from "react";
import { INK } from "./props";

/** Corner cut, in px. Bigger reads more 1981, smaller more 1987. */
const NOTCH = 18;

function octagon(inset: number): string {
  const n = NOTCH;
  return `polygon(
    ${n}px ${inset}px,
    calc(100% - ${n}px) ${inset}px,
    calc(100% - ${inset}px) ${n}px,
    calc(100% - ${inset}px) calc(100% - ${n}px),
    calc(100% - ${n}px) calc(100% - ${inset}px),
    ${n}px calc(100% - ${inset}px),
    ${inset}px calc(100% - ${n}px),
    ${inset}px ${n}px
  )`;
}

/**
 * Parallel strokes around a notched panel.
 *
 * Each ring is one absolutely-positioned layer clipped to its own octagon, so
 * the rings stay exactly parallel at any width. `rings` is drawn outermost
 * first — pass the colours in the order they should appear from the edge in.
 */
export default function NotchedFrame({
  children,
  rings = [INK.yellow, INK.red, INK.blue],
  ground = INK.black,
  className = "",
  style,
}: {
  children?: ReactNode;
  rings?: string[];
  ground?: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  // 3px of colour, 3px of black gap, repeating inward.
  const STEP = 3;
  const layers: { color: string; inset: number }[] = [];
  rings.forEach((color, i) => {
    layers.push({ color, inset: i * STEP * 2 });
    layers.push({ color: ground, inset: i * STEP * 2 + STEP });
  });
  const contentInset = rings.length * STEP * 2;

  return (
    <div className={`relative ${className}`} style={style}>
      {layers.map((l, i) => (
        <div
          key={i}
          aria-hidden
          className="absolute inset-0 pointer-events-none"
          style={{ background: l.color, clipPath: octagon(l.inset) }}
        />
      ))}
      {/* The panel face, and everything on it. */}
      <div
        className="absolute inset-0"
        style={{ background: ground, clipPath: octagon(contentInset) }}
      />
      <div className="relative" style={{ padding: contentInset + 6 }}>
        {children}
      </div>
    </div>
  );
}

/**
 * Rainbow speed stripes, as on the reference marquee: a stack of flat bars
 * running off both edges behind the figures.
 */
export function SpeedStripes({
  className = "",
  colors = [INK.red, INK.orange, INK.yellow, INK.green, INK.blue],
  height = 7,
}: {
  className?: string;
  colors?: string[];
  height?: number;
}) {
  return (
    <div aria-hidden className={`flex flex-col ${className}`}>
      {colors.map((c) => (
        <div key={c} style={{ height, background: c }} />
      ))}
    </div>
  );
}

/**
 * One word of the logo, in two-tone block lettering.
 *
 * `fill` is the face, `keyline` the outline it is printed against, and the
 * drop is the same keyline colour offset down-right — which is what gives the
 * lettering its weight without any bevel or gradient.
 */
export function MarqueeWord({
  children,
  fill,
  keyline,
  className = "",
}: {
  children: ReactNode;
  fill: string;
  keyline: string;
  className?: string;
}) {
  return (
    <span
      className={`block font-black uppercase leading-[0.8] tracking-[0.02em] ${className}`}
      style={{
        fontFamily: "var(--font-display, system-ui)",
        color: fill,
        WebkitTextStroke: `3px ${keyline}`,
        paintOrder: "stroke fill",
        textShadow: `5px 6px 0 ${keyline}, 7px 9px 0 ${INK.black}`,
      }}
    >
      {children}
    </span>
  );
}
