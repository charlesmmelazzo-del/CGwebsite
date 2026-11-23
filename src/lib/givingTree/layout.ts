// ─── Where things go on the tree and in the sky (12) ─────────────────────────
//
// Positions come from data, never hand-placed markup. The tree is a 100 × 100
// box; zones are horizontal tiers of equal area, so each holds a similar
// number of ornaments. An opportunity with its own tree_x / tree_y keeps it;
// everything else is auto-placed inside its zone. Pure, so it is stable: the
// same opportunities always land in the same spots.

import type { OppType } from "./types";

/** The tree outline: apex at the top, base across the bottom. */
export const TREE = { apexX: 50, apexY: 4, baseY: 94, halfBase: 46 } as const;

/** Zones top to bottom, as bands of the tree's height. */
export const ZONES: { key: OppType; y0: number; y1: number }[] = [
  { key: "volunteer", y0: 10, y1: 56 },
  { key: "gift", y0: 56, y1: 78 },
  { key: "cash", y0: 78, y1: 92 },
];

export function zoneOf(key: OppType) {
  return ZONES.find((z) => z.key === key)!;
}

/** Half the tree's width at a given height. */
export function halfWidthAt(y: number): number {
  return (TREE.halfBase * Math.max(0, y - TREE.apexY)) / (TREE.baseY - TREE.apexY);
}

/** Grid points inside a zone band at a given spacing (offset rows, like a hex grid). */
function pointsAt(zone: { y0: number; y1: number }, s: number): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  let row = 0;
  for (let y = zone.y0 + s * 0.6; y <= zone.y1 - s * 0.4; y += s * 0.87, row++) {
    const hw = halfWidthAt(y) - s * 0.55;
    if (hw <= 0) continue;
    const offset = row % 2 ? s / 2 : 0;
    for (let x = TREE.apexX - hw + ((hw * 2) % s) / 2 + offset; x <= TREE.apexX + hw + 0.001; x += s) {
      out.push({ x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 });
    }
  }
  return out;
}

/** The biggest spacing that fits `count` ornaments into a zone, and their spots. */
export function autoPlace(zoneKey: OppType, count: number): { spacing: number; points: { x: number; y: number }[] } {
  const zone = zoneOf(zoneKey);
  if (count <= 0) return { spacing: 12, points: [] };
  let s = 16;
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
 * Place every opportunity. Auto-placed ones fill their zone in sort order;
 * the slot an opportunity gets is fixed by its order among ALL of the zone's
 * opportunities (open or not), so claiming one never shuffles the others.
 */
export function placeOrnaments<T extends { id: string; zone: OppType; x: number | null; y: number | null }>(
  items: T[]
): Map<string, { x: number; y: number; size: number }> {
  const out = new Map<string, { x: number; y: number; size: number }>();
  for (const z of ZONES) {
    const inZone = items.filter((i) => i.zone === z.key);
    const { spacing, points } = autoPlace(z.key, inZone.length);
    const size = Math.min(12, spacing * 0.86);
    inZone.forEach((item, i) => {
      if (item.x != null && item.y != null) out.set(item.id, { x: item.x, y: item.y, size });
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
