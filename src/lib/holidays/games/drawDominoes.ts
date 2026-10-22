// ─── 05 Draw Dominoes ────────────────────────────────────────────────────────
// Handoff preset: 2–4 players, double-six, 7 tiles each (6 with four), any
// opening tile, play one matching tile per turn; with no match, draw until one
// plays and play it (or pass when the boneyard is empty). Doubles are ordinary.
// Going out scores the others' pips; a block scores the unique lowest hand
// (others' total minus their own). First to 100.

import { nameOf, randomIndex, winnerMessage } from "../common";
import { ends, handPips, has, other, shuffledSet, sortTiles, type Placed, type Tile } from "../dominoes";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TARGET = 100;

export interface DrawState {
  seats: Seat[];
  starter: number;
  hands: Record<string, Tile[]>;
  boneyard: Tile[];
  /** The line, left to right, each tile as [left value, right value]. */
  line: Placed[];
  turn: number;
  passes: number;
  scores: number[];
  phase: "play" | "handOver" | "over";
  result: { winner: number | null; points: number; blocked: boolean } | null;
  /** How many tiles the current player was just forced to draw. */
  drew: number;
  log: string;
}

export type DrawAction = { type: "play"; tile: Tile; end: "left" | "right" } | { type: "draw" } | { type: "nextHand" };

export function lineEnds(line: Placed[]): { left: number; right: number } | null {
  return line.length ? { left: line[0][0], right: line[line.length - 1][1] } : null;
}

export function legalEnds(line: Placed[], t: Tile): ("left" | "right")[] {
  const e = lineEnds(line);
  if (!e) return ["left"];
  const out: ("left" | "right")[] = [];
  if (has(t, e.left)) out.push("left");
  if (has(t, e.right)) out.push("right");
  return out;
}

export function place(line: Placed[], t: Tile, end: "left" | "right"): Placed[] {
  const e = lineEnds(line);
  if (!e) return [ends(t)];
  if (end === "left") return [[other(t, e.left), e.left], ...line];
  return [...line, [e.right, other(t, e.right)]];
}

function deal(seats: Seat[], starter: number, rand: () => number) {
  const set = shuffledSet(6, rand);
  const size = seats.length === 4 ? 6 : 7;
  const hands: Record<string, Tile[]> = {};
  seats.forEach((p, i) => (hands[p.id] = sortTiles(set.slice(i * size, (i + 1) * size))));
  return { starter, hands, boneyard: set.slice(seats.length * size), line: [] as Placed[], turn: starter, passes: 0, phase: "play" as const, result: null, drew: 0, log: "" };
}

function endHand(s: DrawState, winner: number | null): DrawState {
  const totals = s.seats.map((p) => handPips(s.hands[p.id]));
  let w = winner;
  let pts = 0;
  if (w !== null) pts = totals.reduce((t, v, i) => (i === w ? t : t + v), 0);
  else {
    const low = Math.min(...totals);
    const lows = totals.map((v, i) => (v === low ? i : -1)).filter((i) => i >= 0);
    if (lows.length === 1) {
      w = lows[0];
      pts = totals.reduce((t, v, i) => (i === w ? t : t + v), 0) - low;
    }
  }
  const scores = s.scores.slice();
  if (w !== null) scores[w] += pts;
  return { ...s, scores, result: { winner: w, points: pts, blocked: winner === null }, phase: scores.some((v) => v >= TARGET) ? "over" : "handOver" };
}

export const drawDominoes: GameDef<DrawState, DrawAction> = {
  key: "draw-dominoes",
  name: "Draw Dominoes",
  tagline: "Match the ends. No match? Draw until you can.",
  styles: ["dominoes"],
  minPlayers: 2,
  maxPlayers: 4,
  time: "20–40 min",
  description:
    "The classic domino game. Take turns matching a tile to either end of the line. If you can't, draw from the boneyard until you can. Go out first to score everyone else's pips — first to 100 wins.",
  rules: [
    { heading: "Setup", body: ["A double-six set (28 tiles). Two or three players take 7 tiles each; four players take 6.", "The rest stay face down in the boneyard."] },
    {
      heading: "Your turn",
      body: [
        "The first player lays any tile. After that, add one tile to either end of the line, matching the number at that end. Blank matches blank.",
        "If you have a tile that fits, you must play it.",
        "If nothing fits, tap Draw: you draw from the boneyard until you get one that plays, then play it. If the boneyard is empty, you pass.",
        "Doubles are ordinary tiles — no branches, no extra turns.",
      ],
    },
    {
      heading: "Scoring",
      body: [
        "Empty your hand to win the hand and score the pips left in everyone else's hands.",
        "If nobody can play and the boneyard is empty, the player with the lowest total scores everyone else's pips minus their own. A tie for lowest scores nothing.",
        "First to 100 points wins.",
      ],
    },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation. Rules after Pagat and MobilityWare's digital draw game." },

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
    const playable = hand.filter((t) => legalEnds(s.line, t).length > 0);
    const n = s.seats.length;

    if (a.type === "draw") {
      if (playable.length) throw new GameError("You have a tile that fits — play it.");
      const bone = s.boneyard.slice();
      const got = hand.slice();
      let drew = 0;
      while (bone.length) {
        const t = bone.shift()!;
        got.push(t);
        drew++;
        if (legalEnds(s.line, t).length) break;
      }
      const fits = got.some((t) => legalEnds(s.line, t).length);
      const next: DrawState = { ...s, boneyard: bone, hands: { ...s.hands, [playerId]: sortTiles(got) }, drew };
      if (fits) return { ...next, log: `${nameOf(s.seats, playerId)} drew ${drew}.` };
      const passes = s.passes + 1;
      const passed = { ...next, passes, turn: (seat + 1) % n, drew: 0, log: `${nameOf(s.seats, playerId)} ${drew ? `drew ${drew} and ` : ""}passed.` };
      return passes >= n ? endHand({ ...passed, log: "Nobody can play — the hand is blocked." }, null) : passed;
    }

    if (!hand.includes(a.tile)) throw new GameError("That tile isn't in your hand.");
    if (!legalEnds(s.line, a.tile).includes(a.end)) throw new GameError("That tile doesn't fit there.");
    const left = hand.filter((t) => t !== a.tile);
    const next: DrawState = { ...s, line: place(s.line, a.tile, a.end), hands: { ...s.hands, [playerId]: left }, passes: 0, drew: 0, turn: (seat + 1) % n, log: `${nameOf(s.seats, playerId)} played ${a.tile}.` };
    return left.length === 0 ? endHand({ ...next, log: `${nameOf(s.seats, playerId)} dominoed!` }, seat) : next;
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    const hand = s.hands[playerId] ?? [];
    return {
      seats: s.seats.map((p) => ({ id: p.id, name: p.name, tiles: s.hands[p.id].length })),
      you: seat,
      hand,
      legal: seat === s.turn && s.phase === "play" ? Object.fromEntries(hand.map((t) => [t, legalEnds(s.line, t)]).filter(([, e]) => e.length)) : {},
      line: s.line,
      boneyard: s.boneyard.length,
      turn: s.turn,
      phase: s.phase,
      result: s.result,
      drew: seat === s.turn ? s.drew : 0,
      log: s.log,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: winnerMessage(drawDominoes.scoreboard!(s)), turn: [] };
    if (s.phase === "handOver") {
      const r = s.result!;
      return { over: false, message: r.winner === null ? "Blocked — a tie, no score" : `${s.seats[r.winner].name} +${r.points}`, turn: [] };
    }
    const p = s.seats[s.turn];
    return { over: false, message: `${p.name}'s turn`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.scores[i], playerIds: [p.id] }));
  },
};
