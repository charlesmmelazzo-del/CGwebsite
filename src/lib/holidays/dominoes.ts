// ─── Domino tiles, as plain strings ──────────────────────────────────────────
// A tile is "a-b" with a <= b ("0-0" … "6-6"). Turning a tile around on the
// table doesn't make it a different tile; placed tiles carry their facing
// separately as [near, far].

import { shuffle } from "./cards";

export type Tile = string;
/** A tile as laid on the table: [end touching the layout, free end]. */
export type Placed = [number, number];

export function tile(a: number, b: number): Tile {
  return a <= b ? `${a}-${b}` : `${b}-${a}`;
}

export function ends(t: Tile): [number, number] {
  const [a, b] = t.split("-").map(Number);
  return [a, b];
}

export function pips(t: Tile): number {
  const [a, b] = ends(t);
  return a + b;
}

export function isDouble(t: Tile): boolean {
  const [a, b] = ends(t);
  return a === b;
}

export function has(t: Tile, n: number): boolean {
  const [a, b] = ends(t);
  return a === n || b === n;
}

/** The other end of a tile that touches `n`. */
export function other(t: Tile, n: number): number {
  const [a, b] = ends(t);
  return a === n ? b : a;
}

export function fullSet(max: number): Tile[] {
  const out: Tile[] = [];
  for (let a = 0; a <= max; a++) for (let b = a; b <= max; b++) out.push(tile(a, b));
  return out;
}

export function shuffledSet(max: number, rand: () => number): Tile[] {
  return shuffle(fullSet(max), rand);
}

export function handPips(hand: Tile[]): number {
  return hand.reduce((t, x) => t + pips(x), 0);
}

export function sortTiles(hand: Tile[]): Tile[] {
  return hand.slice().sort((x, y) => {
    const [a1, b1] = ends(x);
    const [a2, b2] = ends(y);
    return b1 - b2 || a1 - a2;
  });
}
