// ─── 06 All Fives ────────────────────────────────────────────────────────────
// Handoff preset: 2–4 players, double-six, 9/7/5 tiles, one spinner (the first
// double played), draw until playable, score the open ends whenever they total
// a multiple of five, hand bonus = others' pips rounded to the nearest five,
// first to 200 (checked right after a placement score, before any bonus).

import { nameOf, randomIndex, sum, winnerMessage } from "../common";
import { ends, handPips, has, isDouble, other, shuffledSet, sortTiles, type Tile } from "../dominoes";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TARGET = 200;
export type Arm = "W" | "E" | "N" | "S";
export const ARMS: Arm[] = ["W", "E", "N", "S"];

/** A tile laid along an arm: [value touching the layout, free value]. */
export type Link = { tile: Tile; near: number; far: number };

export interface Layout {
  /** Before any double: a plain line, left to right, as links. */
  line: Link[];
  /** The spinner's value, once the first double is down. */
  spinner: number | null;
  /** Arms grow outward from the spinner. */
  arms: Record<Arm, Link[]>;
}

export interface FivesState {
  seats: Seat[];
  starter: number;
  hands: Record<string, Tile[]>;
  boneyard: Tile[];
  layout: Layout;
  turn: number;
  passes: number;
  scores: number[];
  phase: "play" | "handOver" | "over";
  lastScore: { seat: number; points: number; sum: number } | null;
  result: { winner: number | null; bonus: number } | null;
  drew: number;
  log: string;
}

/** Where a tile can go: a line end before the spinner, an arm after. */
export type Port = "left" | "right" | Arm;
export type FivesAction = { type: "play"; tile: Tile; port: Port } | { type: "draw" } | { type: "nextHand" };

const EMPTY_LAYOUT: Layout = { line: [], spinner: null, arms: { W: [], E: [], N: [], S: [] } };

/** The value each open port needs. */
export function openPorts(L: Layout): Partial<Record<Port, number | "any">> {
  if (L.spinner === null) {
    if (L.line.length === 0) return { left: "any" };
    return { left: L.line[0].near, right: L.line[L.line.length - 1].far };
  }
  const end = (arm: Arm) => (L.arms[arm].length ? L.arms[arm][L.arms[arm].length - 1].far : L.spinner!);
  const out: Partial<Record<Port, number>> = { W: end("W"), E: end("E") };
  if (L.arms.W.length && L.arms.E.length) {
    out.N = end("N");
    out.S = end("S");
  }
  return out;
}

export function legalPorts(L: Layout, t: Tile): Port[] {
  return (Object.entries(openPorts(L)) as [Port, number | "any"][]).filter(([, v]) => v === "any" || has(t, v)).map(([p]) => p);
}

/** Sum of the scoring terminals (see the handoff's worked example). */
export function endSum(L: Layout): number {
  if (L.spinner === null) {
    if (L.line.length === 0) return 0;
    if (L.line.length === 1) return sum(ends(L.line[0].tile));
    return L.line[0].near + L.line[L.line.length - 1].far;
  }
  const terminal = (arm: Arm) => {
    const a = L.arms[arm];
    if (!a.length) return 0;
    const last = a[a.length - 1];
    return isDouble(last.tile) ? last.far * 2 : last.far;
  };
  const w = L.arms.W.length > 0;
  const e = L.arms.E.length > 0;
  const spinnerPart = w && e ? 0 : L.spinner * 2;
  return spinnerPart + ARMS.reduce((t, arm) => t + terminal(arm), 0);
}

export function placeTile(L: Layout, t: Tile, port: Port): Layout {
  const ports = openPorts(L);
  const need = ports[port];
  if (need === undefined) throw new GameError("You can't play there.");
  if (need !== "any" && !has(t, need)) throw new GameError("That tile doesn't fit there.");

  if (L.spinner === null) {
    if (isDouble(t)) {
      // The first double becomes the spinner. Any line so far becomes its west arm.
      const v = ends(t)[0];
      if (L.line.length === 0) return { ...L, spinner: v };
      // Line links run left→right (near = left value). Facing outward from the spinner:
      // joined at the right end → the line reversed and flipped; at the left end → as it is.
      const west: Link[] = port === "right" ? L.line.slice().reverse().map((l) => ({ tile: l.tile, near: l.far, far: l.near })) : L.line.slice();
      return { line: [], spinner: v, arms: { W: west, E: [], N: [], S: [] } };
    }
    if (need === "any") {
      const [a, b] = ends(t);
      return { ...L, line: [{ tile: t, near: a, far: b }] };
    }
    if (port === "left") return { ...L, line: [{ tile: t, near: other(t, need), far: need }, ...L.line] };
    return { ...L, line: [...L.line, { tile: t, near: need, far: other(t, need) }] };
  }
  const arm = port as Arm;
  return { ...L, arms: { ...L.arms, [arm]: [...L.arms[arm], { tile: t, near: need as number, far: other(t, need as number) }] } };
}

export const roundToFive = (n: number) => 5 * Math.floor((n + 2) / 5);

function deal(seats: Seat[], starter: number, rand: () => number) {
  const set = shuffledSet(6, rand);
  const size = seats.length === 2 ? 9 : seats.length === 3 ? 7 : 5;
  const hands: Record<string, Tile[]> = {};
  seats.forEach((p, i) => (hands[p.id] = sortTiles(set.slice(i * size, (i + 1) * size))));
  return { starter, hands, boneyard: set.slice(seats.length * size), layout: EMPTY_LAYOUT, turn: starter, passes: 0, phase: "play" as const, lastScore: null, result: null, drew: 0, log: "" };
}

function endHand(s: FivesState, outSeat: number | null): FivesState {
  const totals = s.seats.map((p) => handPips(s.hands[p.id]));
  let w = outSeat;
  if (w === null) {
    const low = Math.min(...totals);
    const lows = totals.map((v, i) => (v === low ? i : -1)).filter((i) => i >= 0);
    w = lows.length === 1 ? lows[0] : null;
  }
  const bonus = w === null ? 0 : roundToFive(totals.reduce((t, v, i) => (i === w ? t : t + v), 0));
  const scores = s.scores.slice();
  if (w !== null) scores[w] += bonus;
  return { ...s, scores, result: { winner: w, bonus }, phase: scores.some((v) => v >= TARGET) ? "over" : "handOver" };
}

export const allFives: GameDef<FivesState, FivesAction> = {
  key: "all-fives",
  name: "All Fives",
  tagline: "Make the open ends add up to a multiple of five.",
  styles: ["dominoes"],
  minPlayers: 2,
  maxPlayers: 4,
  time: "30–45 min",
  description:
    "Dominoes with arithmetic. Every time the open ends of the layout add up to 5, 10, 15 or more by fives, you score that many points on the spot. The first double becomes a spinner that can grow in four directions, so the board gets interesting fast. First to 200.",
  rules: [
    { heading: "Setup", body: ["A double-six set. Two players take 9 tiles; three take 7; four take 5. The rest is the boneyard."] },
    {
      heading: "Playing",
      body: [
        "Add one matching tile per turn. If nothing fits, draw until something does and play it; if the boneyard is empty, pass.",
        "The first double played is the spinner. Once both its sides are covered, tiles can also be played off its top and bottom — up to four arms.",
        "Other doubles are ordinary and stay at the end of their arm.",
      ],
    },
    {
      heading: "Scoring as you go",
      body: [
        "After each tile, add up the open ends. An end that's a double counts both halves. The spinner counts both halves until both of its sides are covered.",
        "If the total is 5, 10, 15 … you score it right away.",
      ],
    },
    {
      heading: "End of a hand",
      body: [
        "Go out (or have the lowest total when everyone's blocked) to score everyone else's pips, rounded to the nearest five. A tie for lowest scores no bonus.",
        "First to 200 wins — the moment it happens, even mid-hand.",
      ],
    },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Single-spinner rules after Pagat and MobilityWare." },

  setup(seats, ctx) {
    return { seats, scores: seats.map(() => 0), ...deal(seats, randomIndex(seats.length, ctx.rand), ctx.rand) };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    if (a.type === "nextHand") {
      if (s.phase !== "handOver") throw new GameError("The hand is still going.");
      return { ...s, ...deal(s.seats, (s.starter + 1) % s.seats.length, ctx.rand) };
    }
    if (s.phase !== "play") throw new GameError("Not now.");
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");
    const hand = s.hands[playerId];
    const n = s.seats.length;
    const fits = (t: Tile) => legalPorts(s.layout, t).length > 0;

    if (a.type === "draw") {
      if (hand.some(fits)) throw new GameError("You have a tile that fits — play it.");
      const bone = s.boneyard.slice();
      const got = hand.slice();
      let drew = 0;
      while (bone.length) {
        const t = bone.shift()!;
        got.push(t);
        drew++;
        if (fits(t)) break;
      }
      const next: FivesState = { ...s, boneyard: bone, hands: { ...s.hands, [playerId]: sortTiles(got) }, drew };
      if (got.some(fits)) return { ...next, log: `${nameOf(s.seats, playerId)} drew ${drew}.` };
      const passes = s.passes + 1;
      const passed = { ...next, passes, turn: (seat + 1) % n, drew: 0, log: `${nameOf(s.seats, playerId)} passed.` };
      return passes >= n ? endHand({ ...passed, log: "Nobody can play — the hand is blocked." }, null) : passed;
    }

    if (!hand.includes(a.tile)) throw new GameError("That tile isn't in your hand.");
    const layout = placeTile(s.layout, a.tile, a.port);
    const total = endSum(layout);
    const points = total > 0 && total % 5 === 0 ? total : 0;
    const scores = s.scores.slice();
    scores[seat] += points;
    const left = hand.filter((t) => t !== a.tile);
    const name = nameOf(s.seats, playerId);
    let next: FivesState = {
      ...s,
      layout,
      scores,
      hands: { ...s.hands, [playerId]: left },
      passes: 0,
      drew: 0,
      turn: (seat + 1) % n,
      lastScore: { seat, points, sum: total },
      log: points ? `${name} scored ${points}!` : `${name} played — ends total ${total}.`,
    };
    if (scores[seat] >= TARGET) return { ...next, phase: "over", result: { winner: seat, bonus: 0 } };
    if (left.length === 0) next = endHand({ ...next, log: `${name} went out!` }, seat);
    return next;
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    const hand = s.hands[playerId] ?? [];
    const mine = seat === s.turn && s.phase === "play";
    return {
      seats: s.seats.map((p) => ({ id: p.id, name: p.name, tiles: s.hands[p.id].length })),
      you: seat,
      hand,
      legal: mine
        ? Object.fromEntries(
            hand
              .map((t) => [t, legalPorts(s.layout, t).map((port) => ({ port, sum: endSum(placeTile(s.layout, t, port)) }))] as const)
              .filter(([, ps]) => ps.length)
          )
        : {},
      layout: s.layout,
      endSum: endSum(s.layout),
      boneyard: s.boneyard.length,
      turn: s.turn,
      phase: s.phase,
      lastScore: s.lastScore,
      result: s.result,
      drew: seat === s.turn ? s.drew : 0,
      log: s.log,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: winnerMessage(allFives.scoreboard!(s)), turn: [] };
    if (s.phase === "handOver") {
      const r = s.result!;
      return { over: false, message: r.winner === null ? "Blocked — tied, no bonus" : `${s.seats[r.winner].name} +${r.bonus} bonus`, turn: [] };
    }
    const p = s.seats[s.turn];
    return { over: false, message: `${p.name}'s turn`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.scores[i], playerIds: [p.id] }));
  },
};
