// ─── Where things go on the tree (12) ─────────────────────────────────────────
//
// Positions come from data, never hand-placed markup. The tree is a tall box,
// 100 wide by 170 high, so it fills a phone screen, shaped as three stacked
// tiers. Zones are horizontal bands sized so each holds a similar number of
// ornaments. An opportunity with its own tree_x / tree_y (stored as percent of
// the tree's width and height) keeps it; everything else is auto-placed
// inside its zone. Pure, so it is stable: the same opportunities always land
// in the same spots.

import type { OppType } from "./types";

/** The tree box, in tree units. */
export const TREE = { width: 100, height: 170, centerX: 50, trunkTop: 162 } as const;

/** The three tiers, top to bottom: where each starts and ends, and its half-width there. */
export const TIERS: { top: number; bottom: number; topHalf: number; bottomHalf: number }[] = [
  { top: 4, bottom: 76, topHalf: 0, bottomHalf: 38 },
  { top: 60, bottom: 122, topHalf: 12, bottomHalf: 42 },
  { top: 108, bottom: 162, topHalf: 16, bottomHalf: 47 },
];

/** Zones top to bottom, as bands of the tree's height (one per tier). */
export const ZONES: { key: OppType; y0: number; y1: number }[] = [
  { key: "volunteer", y0: 12, y1: 76 },
  { key: "gift", y0: 76, y1: 122 },
  { key: "cash", y0: 122, y1: 160 },
];

/** Room left clear at the top of each zone for its label. */
export const LABEL_ROOM = 5;

export function zoneOf(key: OppType) {
  return ZONES.find((z) => z.key === key)!;
}

/** Half the tree's width at a given height (the widest tier there). */
export function halfWidthAt(y: number): number {
  let hw = 0;
  for (const t of TIERS) {
    if (y < t.top || y > t.bottom) continue;
    hw = Math.max(hw, t.topHalf + ((t.bottomHalf - t.topHalf) * (y - t.top)) / (t.bottom - t.top));
  }
  return hw;
}

/** The widest the tree gets anywhere in a zone (for fitting the view to it). */
export function zoneHalfWidth(key: OppType): number {
  const z = zoneOf(key);
  let hw = 0;
  for (let y = z.y0; y <= z.y1; y += 0.5) hw = Math.max(hw, halfWidthAt(y));
  return hw;
}

/** Each tier as an SVG path in tree units: straight sides, a gently curved hem. */
export function tierPaths(): string[] {
  const c = TREE.centerX;
  return TIERS.map(
    (t) =>
      `M ${c - t.topHalf} ${t.top} L ${c + t.topHalf} ${t.top} L ${c + t.bottomHalf} ${t.bottom} ` +
      `Q ${c} ${t.bottom + 6} ${c - t.bottomHalf} ${t.bottom} Z`
  );
}

/** Stored positions are percent of the tree's width and height; tree units are not. */
export const toUnits = (xPct: number, yPct: number) => ({ x: xPct, y: (yPct * TREE.height) / 100 });
export const toPercent = (x: number, y: number) => ({ x: Math.round(x * 10) / 10, y: Math.round(((y * 100) / TREE.height) * 10) / 10 });

/** Grid points inside a zone band at a given spacing (offset rows, like a hex grid). */
function pointsAt(zone: { y0: number; y1: number }, s: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = zone.y0 + LABEL_ROOM + s * 0.6; y <= zone.y1 - s * 0.4; y += s * 0.87, row++) {
    // The narrower of this row's top and bottom edge, so ornaments stay inside a slanted side.
    const hw = Math.min(halfWidthAt(y - s * 0.4), halfWidthAt(y + s * 0.4) || halfWidthAt(y)) - s * 0.42;
    if (hw <= 0) continue;
    const offset = row % 2 ? s / 2 : 0;
    for (let x = TREE.centerX - hw + ((hw * 2) % s) / 2 + offset; x <= TREE.centerX + hw + 0.001; x += s) {
      out.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }
  return out;
}

/** The biggest spacing that fits `count` ornaments into a zone, and their spots. */
export function autoPlace(zoneKey: OppType, count: number): { spacing: number; points: { x: number; y: number }[] } {
  const zone = zoneOf(zoneKey);
  if (count <= 0) return { spacing: 12, points: [] };
  let s = 18;
  let pts = pointsAt(zone, s);
  while (pts.length < count && s > 2) {
    s -= 0.25;
    pts = pointsAt(zone, s);
  }
  // More room than needed: spread the ornaments evenly over the spots.
  if (pts.length > count) {
    const step = pts.length / count;
    pts = Array.from({ length: count }, (_, i) => pts[Math.floor(i * step + step / 2)]);
  }
  return { spacing: s, points: pts.slice(0, count) };
}

/**
 * Place every opportunity, in tree units. Auto-placed ones fill their zone in
 * sort order; the slot an opportunity gets is fixed by its order among ALL of
 * the zone's opportunities (open or not), so claiming one never shuffles the
 * others.
 */
export function placeOrnaments<T extends { id: string; zone: OppType; x: number | null; y: number | null }>(
  items: T[]
): Map<string, { x: number; y: number; size: number }> {
  const out = new Map<string, { x: number; y: number; size: number }>();
  for (const z of ZONES) {
    const inZone = items.filter((i) => i.zone === z.key);
    const { spacing, points } = autoPlace(z.key, inZone.length);
    const size = Math.min(14, spacing * 0.86);
    inZone.forEach((item, i) => {
      if (item.x != null && item.y != null) out.set(item.id, { ...toUnits(item.x, item.y), size });
      else out.set(item.id, { ...points[i], size });
    });
  }
  return out;
}

/**
 * Stars on a sunflower spiral, oldest in the middle. The field simply grows
 * outward as more stars arrive and stars never overlap, however many there
 * are. Flattened a little so the sky is wider than it is tall.
 */
const GOLDEN_ANGLE = Math.PI * (3 - Math.sqrt(5));
export const STAR_SPACING = 7;

export function starPosition(index: number): { x: number; y: number } {
  const r = STAR_SPACING * Math.sqrt(index + 0.5);
  const a = index * GOLDEN_ANGLE;
  return { x: Math.round(r * Math.cos(a) * 1.35 * 10) / 10, y: Math.round(r * Math.sin(a) * 0.8 * 10) / 10 };
}
