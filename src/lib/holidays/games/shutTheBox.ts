// ─── 18 Shut the Box ─────────────────────────────────────────────────────────
// Handoff defaults: 2–8 players, tiles 1–9, two dice (one allowed once 7, 8
// and 9 are shut — chosen before the roll), close any set of open tiles that
// adds up to the roll; stuck = penalty of all open tiles; shutting the box
// scores 0. Three rounds, everyone plays each round; lowest total wins.

import { nameOf, randomIndex, winnerMessage } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const ROUNDS = 3;
const ALL = [1, 2, 3, 4, 5, 6, 7, 8, 9];

export interface BoxState {
  seats: Seat[];
  first: number;
  round: number;
  /** How many players have finished their turn this round. */
  played: number;
  open: number[];
  roll: number[] | null;
  penalties: number[];
  last: { seat: number; penalty: number; shut: boolean; roll: number[] | null } | null;
  over: boolean;
}

export type BoxAction = { type: "roll"; dice: 1 | 2 } | { type: "close"; tiles: number[] };

/** Can some set of these tiles add up to `total`? (checks every subset) */
export function canMake(open: number[], total: number): boolean {
  const go = (i: number, left: number): boolean => left === 0 || (i < open.length && left > 0 && (go(i + 1, left - open[i]) || go(i + 1, left)));
  return go(0, total);
}

export const oneDieAllowed = (open: number[]) => ![7, 8, 9].some((t) => open.includes(t));

const current = (s: BoxState) => (s.first + s.played) % s.seats.length;

function finishTurn(s: BoxState, penalty: number): BoxState {
  const seat = current(s);
  const penalties = s.penalties.slice();
  penalties[seat] += penalty;
  const played = s.played + 1;
  const last = { seat, penalty, shut: penalty === 0, roll: s.roll };
  if (played < s.seats.length) return { ...s, penalties, played, open: ALL, roll: null, last };
  if (s.round + 1 >= ROUNDS) return { ...s, penalties, played, roll: null, last, over: true };
  return { ...s, penalties, round: s.round + 1, played: 0, open: ALL, roll: null, last };
}

export const shutTheBox: GameDef<BoxState, BoxAction> = {
  key: "shut-the-box",
  name: "Shut the Box",
  tagline: "Roll the dice, flip down tiles that add up. Shut them all.",
  styles: ["dice", "board"],
  minPlayers: 2,
  maxPlayers: 8,
  time: "10–20 min",
  description:
    "The old pub dice game. Nine numbered tiles start open. Roll the dice and close any tiles that add up to your roll — an 8 could close the 8, or 6 and 2, or 5, 2 and 1. Keep going until you can't. Whatever's still open counts against you. Three rounds; lowest total wins.",
  rules: [
    {
      heading: "Your turn",
      body: [
        "All nine tiles start open. Roll two dice.",
        "Close any open tiles that add up exactly to the roll, then roll again.",
        "Once the 7, 8 and 9 are all closed, you can choose to roll just one die — decide before you roll.",
      ],
    },
    { heading: "Ending your turn", body: ["If no combination of open tiles makes your roll, your turn ends. Add up the open tiles — that's your penalty.", "Close every tile and you've shut the box: zero for the turn."] },
    { heading: "Winning", body: ["Everyone takes one turn per round, for three rounds. The lowest total wins; ties share the win."] },
  ],
  license: {
    name: "MIT code reference (OMerkel/Shut-the-Box); original code and art",
    url: "https://github.com/OMerkel/Shut-the-Box/blob/master/LICENSE",
    note: "That project's graphics are separately licensed and aren't used.",
  },

  setup(seats, ctx) {
    return { seats, first: randomIndex(seats.length, ctx.rand), round: 0, played: 0, open: ALL, roll: null, penalties: seats.map(() => 0), last: null, over: false };
  },

  act(s, playerId, a, ctx) {
    if (s.over) throw new GameError("The game is over.");
    if (s.seats[current(s)].id !== playerId) throw new GameError("It's not your turn.");

    if (a.type === "roll") {
      if (s.roll) throw new GameError("Close tiles for this roll first.");
      if (a.dice === 1 && !oneDieAllowed(s.open)) throw new GameError("One die only once 7, 8 and 9 are shut.");
      const roll = Array.from({ length: a.dice === 1 ? 1 : 2 }, () => 1 + Math.floor(ctx.rand() * 6));
      const total = roll[0] + (roll[1] ?? 0);
      const next = { ...s, roll };
      if (!canMake(s.open, total)) return finishTurn({ ...next }, s.open.reduce((t, n) => t + n, 0));
      return next;
    }

    if (!s.roll) throw new GameError("Roll first.");
    const tiles = a.tiles ?? [];
    const total = s.roll.reduce((t, n) => t + n, 0);
    if (tiles.length === 0 || new Set(tiles).size !== tiles.length || !tiles.every((t) => s.open.includes(t))) throw new GameError("Pick open tiles.");
    if (tiles.reduce((t, n) => t + n, 0) !== total) throw new GameError(`Those add up to ${tiles.reduce((t, n) => t + n, 0)}, not ${total}.`);
    const open = s.open.filter((t) => !tiles.includes(t));
    if (open.length === 0) return finishTurn({ ...s, open }, 0);
    return { ...s, open, roll: null };
  },

  view(s, playerId) {
    const seat = current(s);
    return {
      seats: s.seats.map((p, i) => ({ id: p.id, name: p.name, penalty: s.penalties[i] })),
      turn: seat,
      yourTurn: s.seats[seat].id === playerId,
      round: s.round,
      rounds: ROUNDS,
      open: s.open,
      roll: s.roll,
      oneDie: oneDieAllowed(s.open),
      last: s.last ? { ...s.last, name: s.seats[s.last.seat].name } : null,
    };
  },

  status(s) {
    if (s.over) return { over: true, message: winnerMessage(shutTheBox.scoreboard!(s), true), turn: [] };
    const p = s.seats[current(s)];
    return { over: false, message: `Round ${s.round + 1} · ${nameOf(s.seats, p.id)}'s turn`, turn: [p.id] };
  },

  lowScoreWins: true,

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.penalties[i], playerIds: [p.id] }));
  },
};
