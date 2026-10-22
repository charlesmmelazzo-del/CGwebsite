// ─── 08 Train Dominoes ───────────────────────────────────────────────────────
// Handoff preset: 2–8 players, double-twelve, 13 rounds with engines 12-12
// down to 0-0 (set aside before the deal), 15/12/10 tiles, one personal train
// each plus one community train, one tile per turn, draw one when stuck and
// mark your train public, doubles must be covered (by the same player first,
// then whoever's next), an uncoverable double closes its train. Lowest
// cumulative pips after 13 rounds wins.

import { nameOf, randomIndex, winnerMessage } from "../common";
import { fullSet, handPips, has, isDouble, other, shuffledSet, sortTiles, tile, ends, type Tile } from "../dominoes";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const ROUNDS = 13;
const MAX = 12;

export interface Train {
  /** Seat that owns it; null = the community train. */
  owner: number | null;
  tiles: { tile: Tile; near: number; far: number }[];
  public: boolean;
  closed: boolean;
}

export interface TrainState {
  seats: Seat[];
  round: number;
  starter: number;
  hands: Record<string, Tile[]>;
  boneyard: Tile[];
  trains: Train[];
  turn: number;
  /** A double waiting to be covered. */
  pending: { train: number; value: number } | null;
  /** The tile the current player just drew — the only one they may now play. */
  drawn: Tile | null;
  passes: number;
  penalties: number[];
  phase: "play" | "roundOver" | "over";
  result: { out: number | null; added: number[] } | null;
  log: string;
}

export type TrainAction = { type: "play"; tile: Tile; train: number } | { type: "draw" } | { type: "nextRound" };

export const engineOf = (round: number) => MAX - round;

export function trainEnd(s: TrainState, i: number): number {
  const t = s.trains[i];
  return t.tiles.length ? t.tiles[t.tiles.length - 1].far : engineOf(s.round);
}

/** Trains a seat may play on right now, and the value each needs. */
export function openTrains(s: TrainState, seat: number): number[] {
  if (s.pending) return s.trains[s.pending.train].closed ? [] : [s.pending.train];
  return s.trains.map((t, i) => (!t.closed && (t.owner === seat || t.owner === null || t.public) ? i : -1)).filter((i) => i >= 0);
}

export function legalMoves(s: TrainState, seat: number, hand = s.hands[s.seats[seat].id]): { tile: Tile; train: number }[] {
  const out: { tile: Tile; train: number }[] = [];
  for (const i of openTrains(s, seat)) {
    const need = s.pending ? s.pending.value : trainEnd(s, i);
    for (const t of hand) {
      if (!has(t, need)) continue;
      if (s.pending && isDouble(t)) continue; // a double can't cover a double
      out.push({ tile: t, train: i });
    }
  }
  return out;
}

function deal(seats: Seat[], round: number, starter: number, rand: () => number) {
  const engine = tile(engineOf(round), engineOf(round));
  const set = shuffledSet(MAX, rand).filter((t) => t !== engine);
  const n = seats.length;
  const size = n <= 4 ? 15 : n <= 6 ? 12 : 10;
  const hands: Record<string, Tile[]> = {};
  seats.forEach((p, i) => (hands[p.id] = sortTiles(set.slice(i * size, (i + 1) * size))));
  const trains: Train[] = [...seats.map((_, i) => ({ owner: i, tiles: [], public: false, closed: false })), { owner: null, tiles: [], public: true, closed: false }];
  return { round, starter, hands, boneyard: set.slice(n * size), trains, turn: starter, pending: null, drawn: null, passes: 0, phase: "play" as const, result: null, log: "" };
}

function endRound(s: TrainState, out: number | null): TrainState {
  const added = s.seats.map((p) => handPips(s.hands[p.id]));
  const penalties = s.penalties.map((v, i) => v + added[i]);
  return { ...s, penalties, result: { out, added }, phase: s.round + 1 >= ROUNDS ? "over" : "roundOver" };
}

/** Every tile showing `value` is already on the table (so a double can't be covered). */
function exhausted(s: TrainState, value: number, double: Tile): boolean {
  const onTable = new Set(s.trains.flatMap((t) => t.tiles.map((x) => x.tile)));
  onTable.add(tile(engineOf(s.round), engineOf(s.round)));
  return fullSet(MAX).filter((t) => t !== double && has(t, value)).every((t) => onTable.has(t));
}

function markPublic(s: TrainState, seat: number): Train[] {
  return s.trains.map((t) => (t.owner === seat ? { ...t, public: true } : t));
}

function nextTurn(s: TrainState, seat: number, passed: boolean): TrainState {
  const n = s.seats.length;
  const passes = passed ? s.passes + 1 : 0;
  const next = { ...s, turn: (seat + 1) % n, drawn: null, passes };
  if (passed && next.boneyard.length === 0 && passes >= n && next.seats.every((_, i) => legalMoves(next, i).length === 0)) {
    return endRound({ ...next, log: "Nobody can play — the round is blocked." }, null);
  }
  return next;
}

export const trainDominoes: GameDef<TrainState, TrainAction> = {
  key: "train-dominoes",
  name: "Train Dominoes",
  tagline: "Build your own train — or hop on someone else's.",
  styles: ["dominoes"],
  minPlayers: 2,
  maxPlayers: 8,
  time: "60–90 min",
  description:
    "A big, friendly domino game for up to eight. Everyone builds a train out from the centre engine, and there's a community train anyone can use. Get stuck and your train opens to everybody. Play a double and it must be covered before anything else happens. Thirteen rounds; fewest pips left over wins.",
  rules: [
    { heading: "Setup", body: ["A double-twelve set. Each round has an engine double in the middle: 12-12 in round one, down to 0-0 in round thirteen.", "Two to four players take 15 tiles; five or six take 12; seven or eight take 10."] },
    {
      heading: "Trains",
      body: [
        "Everyone has their own train starting from the engine. There's also one community train open to all.",
        "On your turn, play one tile on your train, the community train, or anyone's train that's been marked open. Match the number at the end (an empty train starts with the engine number).",
        "If you can't play, draw one tile. If it fits, play it. If not, your train is marked open for everyone until you play on it yourself.",
      ],
    },
    {
      heading: "Doubles",
      body: [
        "Play a double and you must cover it straight away with a matching tile on that same train.",
        "If you can't, draw one; if you still can't, your train is marked open — and the next player must cover the double. Nothing else can be played until it's covered.",
        "If every tile that could cover it is already on the table, that train closes for the round.",
      ],
    },
    {
      heading: "Scoring",
      body: [
        "A round ends when someone plays their last tile, or when nobody can move and the boneyard is empty.",
        "Everyone adds up the pips left in their hand as a penalty. After 13 rounds, the lowest total wins. Ties share the win.",
      ],
    },
  ],
  license: { name: "Traditional — public domain", note: "Original implementation of a Mexican Train-style preset. Rules after Pagat and Masters Traditional Games." },

  setup(seats, ctx) {
    return { seats, penalties: seats.map(() => 0), ...deal(seats, 0, randomIndex(seats.length, ctx.rand), ctx.rand) };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    if (a.type === "nextRound") {
      if (s.phase !== "roundOver") throw new GameError("The round is still going.");
      return { ...s, ...deal(s.seats, s.round + 1, (s.starter + 1) % s.seats.length, ctx.rand) };
    }
    if (s.phase !== "play") throw new GameError("Not now.");
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");
    const hand = s.hands[playerId];
    const name = nameOf(s.seats, playerId);
    const moves = legalMoves(s, seat);

    if (a.type === "draw") {
      if (s.drawn) throw new GameError("You've already drawn this turn.");
      if (moves.length) throw new GameError("You have a tile that plays — play it.");
      if (s.boneyard.length === 0) {
        return nextTurn({ ...s, trains: markPublic(s, seat), log: `${name} can't play — their train is open.` }, seat, true);
      }
      const [t, ...boneyard] = s.boneyard;
      const next: TrainState = { ...s, boneyard, hands: { ...s.hands, [playerId]: sortTiles([...hand, t]) } };
      if (legalMoves(next, seat, [t]).length) return { ...next, drawn: t, log: `${name} drew a tile that plays.` };
      return nextTurn({ ...next, trains: markPublic(next, seat), log: `${name} drew and couldn't play — their train is open.` }, seat, true);
    }

    if (s.drawn && a.tile !== s.drawn) throw new GameError("Play the tile you just drew.");
    if (!moves.some((m) => m.tile === a.tile && m.train === a.train)) throw new GameError(hand.includes(a.tile) ? "That tile can't go there." : "That tile isn't in your hand.");
    const need = s.pending ? s.pending.value : trainEnd(s, a.train);
    const placed = { tile: a.tile, near: need, far: other(a.tile, need) };
    // Playing on your own train takes your marker off.
    let trains = s.trains.map((t, i) => (i === a.train ? { ...t, tiles: [...t.tiles, placed], public: t.owner === seat ? false : t.public } : t));
    const left = hand.filter((t) => t !== a.tile);
    let next: TrainState = { ...s, trains, hands: { ...s.hands, [playerId]: left }, drawn: null, passes: 0, pending: null, log: `${name} played ${a.tile}.` };

    if (left.length === 0) return endRound({ ...next, log: `${name} played their last tile!` }, seat);

    if (isDouble(a.tile)) {
      const v = ends(a.tile)[0];
      if (exhausted(next, v, a.tile)) {
        trains = next.trains.map((t, i) => (i === a.train ? { ...t, closed: true } : t));
        return nextTurn({ ...next, trains, log: `${name} played ${a.tile} — nothing can cover it, so that train closes.` }, seat, false);
      }
      // Same player must cover it now. If they can't, the draw/mark rules apply.
      next = { ...next, pending: { train: a.train, value: v }, log: `${name} played a double — cover it!` };
      if (legalMoves(next, seat).length) return next;
      if (next.boneyard.length) return { ...next, log: `${name} played a double and must draw to cover it.` };
      return nextTurn({ ...next, trains: markPublic(next, seat), log: `${name} can't cover the double — their train is open.` }, seat, true);
    }

    return nextTurn(next, seat, false);
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    const mine = seat === s.turn && s.phase === "play";
    return {
      seats: s.seats.map((p) => ({ id: p.id, name: p.name, tiles: s.hands[p.id].length })),
      you: seat,
      hand: s.hands[playerId] ?? [],
      legal: mine ? legalMoves(s, seat).filter((m) => !s.drawn || m.tile === s.drawn) : [],
      trains: s.trains.map((t, i) => ({ ...t, end: trainEnd(s, i) })),
      engine: engineOf(s.round),
      round: s.round,
      rounds: ROUNDS,
      boneyard: s.boneyard.length,
      turn: s.turn,
      pending: s.pending,
      drawn: mine ? s.drawn : null,
      phase: s.phase,
      result: s.result,
      log: s.log,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: winnerMessage(trainDominoes.scoreboard!(s), true), turn: [] };
    if (s.phase === "roundOver") {
      const r = s.result!;
      return { over: false, message: r.out === null ? "Round blocked" : `${s.seats[r.out].name} went out!`, turn: [] };
    }
    const p = s.seats[s.turn];
    const one = s.seats.filter((x) => s.hands[x.id].length === 1).map((x) => x.name);
    return { over: false, message: `${p.name}'s turn${s.pending ? " — cover the double" : ""}${one.length ? ` · ${one.join(", ")} on 1 tile!` : ""}`, turn: [p.id] };
  },

  lowScoreWins: true,

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: `${p.name} (pips)`, score: s.penalties[i], playerIds: [p.id] }));
  },
};
