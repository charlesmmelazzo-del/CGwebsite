// ─── Tater Tales — the ladder of worlds ──────────────────────────────────────
//
// Mr. Tater's home bar goes up through the sunroof and keeps going, and each
// world it passes through brings its own stage tiles and background colour.
// At the very top is Tater's golden top shelf: the summit, where a lap ends.
//
// SPACE RECURS. It is the corridor between the destinations — moon, Mars,
// Pluto, the ship — and it turning up five times is the joke: you are climbing
// so far that the gaps between worlds are themselves a place. So this is a
// LIST of bands, and `art` (which tile sheet) is separate from `key`.
//
// Zone changes are a HARD CUT, the way Ice Climbers goes straight from brown
// rock to blue ice. There is no transition art.

export type ZoneArt =
  | "shelf"
  | "sky"
  | "space"
  | "moon"
  | "mars"
  | "pluto"
  | "ship"
  | "heaven"
  | "summit";

export interface Zone {
  /** Unique per band, so the same art appearing twice is still two places. */
  key: string;
  /** Which tile sheet to build it from. */
  art: ZoneArt;
  /** Shown once, as the player crosses the floor of the band. */
  title: string;
  /** Flat background colour behind the shaft. */
  bg: string;
  /** First row of the band. */
  fromRow: number;
  /** Last row of the band, inclusive. */
  toRow: number;
}

/**
 * Rows per band.
 *
 * Twenty, which takes a few minutes of climbing, so a new world arriving is an
 * event. The summit is at row 240.
 */
export const ROWS_PER_ZONE = 20;

const BG: Record<ZoneArt, string> = {
  shelf: "#120A06",
  sky: "#3C7CD8",
  space: "#04040C",
  moon: "#0A0A12",
  mars: "#210B06",
  pluto: "#060B26",
  ship: "#171020",
  heaven: "#C9A25A",
  summit: "#C9A25A",
};

/** The order Mr. Tater's shelf passes through, bottom to top. */
const LADDER: Array<{ art: ZoneArt; title: string }> = [
  { art: "shelf",  title: "THE BOTTOM SHELF" },
  { art: "sky",    title: "THE SKY" },
  { art: "space",  title: "OUTER SPACE" },
  { art: "moon",   title: "THE MOON" },
  { art: "space",  title: "DEEPER SPACE" },
  { art: "mars",   title: "MARS" },
  { art: "space",  title: "DEEP SPACE" },
  { art: "pluto",  title: "PLUTO" },
  { art: "space",  title: "THE LONG DARK" },
  { art: "ship",   title: "THE ALIEN SHIP" },
  { art: "space",  title: "THE FAR SIDE" },
  { art: "heaven", title: "HEAVEN" },
];

export const ZONES: Zone[] = LADDER.map((band, i) => ({
  key: `${band.art}-${i}`,
  art: band.art,
  title: band.title,
  bg: BG[band.art],
  fromRow: i * ROWS_PER_ZONE,
  toRow: (i + 1) * ROWS_PER_ZONE - 1,
}));

/** Tater's golden top shelf: one full-width floor, and the end of a lap. */
export const SUMMIT_ROW = ZONES.length * ROWS_PER_ZONE;

export const SUMMIT_ZONE: Zone = {
  key: "summit",
  art: "summit",
  title: "TATER'S TOP SHELF",
  bg: BG.summit,
  fromRow: SUMMIT_ROW,
  toRow: SUMMIT_ROW,
};

/** Every zone art that has a tile sheet. */
export const ZONE_ARTS: ZoneArt[] = ["shelf", "sky", "space", "moon", "mars", "pluto", "ship", "heaven", "summit"];

export function zoneForRow(row: number): Zone {
  if (row <= 0) return ZONES[0];
  if (row >= SUMMIT_ROW) return SUMMIT_ZONE;
  return ZONES[Math.floor(row / ROWS_PER_ZONE)];
}

/** Index into ZONES, with the summit as one past the end. */
export function zoneIndexForRow(row: number): number {
  if (row <= 0) return 0;
  return Math.min(ZONES.length, Math.floor(row / ROWS_PER_ZONE));
}
