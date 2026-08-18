// ─── Cabinet artwork ─────────────────────────────────────────────────────────
//
// The same pixel art the mini games are drawn from, rendered as page chrome
// instead of onto a canvas.
//
// Why SVG rather than the canvas the games use: this art is decoration on a
// scrolling page, not a frame in a running loop. SVG stays crisp at any size,
// costs nothing per frame, needs no requestAnimationFrame (which a background
// tab throttles to nothing anyway), and scales with the layout. The pixels are
// identical — both readers walk the same string-art sprites from sprites.ts.
//
// TO ADD ART: use an existing sprite from sprites.ts, palette-swapped. Do not
// author art here; sprites.test.ts only guards that file, and art that lives
// outside it escapes the row-length and colour-key checks.

import type { Sprite } from "./games/arcade";
import { P } from "./games/arcade";
import {
  ARM,
  BARTENDER_COLORS,
  BARTENDER_HEADS,
  BARTENDER_TORSO,
  GUEST,
  guestColors,
  ROLLING_BOTTLE,
  BOTTLE_COLORS,
  SHELF_BOTTLE,
  shelfBottleColors,
  TIN,
  TIN_COLORS,
} from "./games/sprites";

/**
 * Guests wear their own palette — GUEST declares f/F for the shirt, which the
 * bartender's map has no entry for, so borrowing his leaves them shirtless.
 */
export const GUEST_SWAPS = [
  guestColors(P.cyan, "#0A5A6A"),
  guestColors(P.amber, "#8A5000"),
  guestColors(P.magenta, "#8A2070"),
];

/**
 * One sprite's worth of <rect>s, in sprite pixel coordinates.
 *
 * Runs of the same colour along a row collapse into a single rect — a 20x26
 * bartender is a few dozen nodes instead of five hundred, which matters when
 * a dozen of these sit in the page at once.
 */
function spriteRects(sprite: Sprite, colors: Record<string, string>, keyPrefix: string) {
  const out: React.ReactElement[] = [];
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    let col = 0;
    while (col < line.length) {
      const key = line[col];
      const color = colors[key];
      if (key === "." || key === " " || !color) {
        col++;
        continue;
      }
      let run = 1;
      while (col + run < line.length && line[col + run] === key) run++;
      out.push(
        <rect
          key={`${keyPrefix}-${row}-${col}`}
          x={col}
          y={row}
          width={run}
          height={1}
          fill={color}
        />
      );
      col += run;
    }
  }
  return out;
}

function spriteSize(sprite: Sprite) {
  return { w: Math.max(...sprite.map((r) => r.length)), h: sprite.length };
}

/** A single sprite as a standalone image. `px` is the size of one sprite pixel. */
export function SpriteArt({
  sprite,
  colors,
  px = 3,
  className = "",
  style,
}: {
  sprite: Sprite;
  colors: Record<string, string>;
  px?: number;
  className?: string;
  style?: React.CSSProperties;
}) {
  const { w, h } = spriteSize(sprite);
  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${w} ${h}`}
      width={w * px}
      height={h * px}
      shapeRendering="crispEdges"
      className={className}
      style={style}
    >
      {spriteRects(sprite, colors, "s")}
    </svg>
  );
}

/**
 * The bartender, assembled from the same parts the game poses him from —
 * head, torso and two arms — so he stays one character across the whole
 * pop-up rather than a separate drawing for the page chrome.
 */
export function BartenderArt({
  px = 3,
  mood = "happy",
  holdingTin = true,
  className = "",
}: {
  px?: number;
  mood?: keyof typeof BARTENDER_HEADS | string;
  holdingTin?: boolean;
  className?: string;
}) {
  const head = BARTENDER_HEADS[mood] ?? BARTENDER_HEADS.ok;
  // Head 20x14 over torso 20x12, arms 4x9 off each shoulder, tin overhead.
  // Laid out on a 22-wide grid so the arms have somewhere to go.
  //
  // Getting "holding" to read took two corrections. ARM puts the hand at its
  // BOTTOM (rows 4-7 are skin, 1-3 are sleeve), so simply raising the arms
  // leaves the hands by his ears with the tin stranded overhead. The hands
  // have to land on the tin's lower edge: tin y0-15, arms y8-16, hands y12-15.
  // They also have to come inward — at x0/x18 they flank a tin spanning x5-16
  // and touch nothing, so they sit at x2/x16 to grip its sides.
  const W = 22;
  const H = holdingTin ? 44 : 26;
  const top = holdingTin ? 18 : 0;
  const armY = holdingTin ? 8 : top + 16;
  const armL = holdingTin ? 2 : 0;
  const armR = holdingTin ? 16 : 18;

  return (
    <svg
      aria-hidden
      viewBox={`0 0 ${W} ${H}`}
      width={W * px}
      height={H * px}
      shapeRendering="crispEdges"
      className={className}
    >
      {/* Head and torso first, then arms and tin over them — the same paint
          order the game uses, so the arms read as in front of the body. */}
      <g transform={`translate(1,${top})`}>{spriteRects(head, BARTENDER_COLORS, "head")}</g>
      <g transform={`translate(1,${top + 14})`}>
        {spriteRects(BARTENDER_TORSO, BARTENDER_COLORS, "torso")}
      </g>
      <g transform={`translate(${armL},${armY})`}>{spriteRects(ARM, BARTENDER_COLORS, "armL")}</g>
      <g transform={`translate(${armR},${armY})`}>{spriteRects(ARM, BARTENDER_COLORS, "armR")}</g>
      {holdingTin && <g transform="translate(5,0)">{spriteRects(TIN, TIN_COLORS, "tin")}</g>}
    </svg>
  );
}

// ─── Bottle palette swaps ────────────────────────────────────────────────────
// Same twelve rows of pixels, six liquids. Exactly how a 1981 ROM got a shelf
// of bottles out of one sprite.

export const BOTTLE_SWAPS = [
  shelfBottleColors(P.amber, "#8A5000"),
  shelfBottleColors(P.red, "#7A0F0A"),
  shelfBottleColors(P.cyan, "#0A5A6A"),
  shelfBottleColors(P.lime, "#4A7000"),
  shelfBottleColors(P.purple, "#3A0A5A"),
  shelfBottleColors(P.orange, "#8A3F00"),
];

/** A row of shelf bottles, cycling the palette. */
export function BottleRow({
  count = 6,
  px = 3,
  className = "",
}: {
  count?: number;
  px?: number;
  className?: string;
}) {
  return (
    <div className={`flex items-end gap-[3px] ${className}`}>
      {Array.from({ length: count }, (_, i) => (
        <SpriteArt
          key={i}
          sprite={SHELF_BOTTLE}
          colors={BOTTLE_SWAPS[i % BOTTLE_SWAPS.length]}
          px={px}
          // A shelf of bottles is never perfectly level.
          style={{ marginBottom: i % 3 === 1 ? px : 0 }}
        />
      ))}
    </div>
  );
}

export { GUEST, ROLLING_BOTTLE, BOTTLE_COLORS, SHELF_BOTTLE, TIN, TIN_COLORS };
