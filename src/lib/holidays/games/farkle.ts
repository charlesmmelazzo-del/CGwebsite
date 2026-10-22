// ─── 17 Farkle ───────────────────────────────────────────────────────────────
// Handoff defaults (publisher table, triple ones = 300): 2–8 players, six
// dice, keep scoring dice from each roll and roll the rest or bank. A roll
// with nothing scoring loses the turn's points. First bank must be 500+.
// Banking 10,000 gives everyone else one final turn; highest total wins.

import { nameOf, randomIndex, winnerMessage } from "../common";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TARGET = 10_000;
export const ENTRY = 500;
const TRIPLE = [0, 300, 200, 300, 400, 500, 600];
const KIND: Record<number, number> = { 4: 1000, 5: 2000, 6: 3000 };

/** Best score for dice that must ALL score, or -1 if any die doesn't. */
export function scoreDice(dice: number[]): number {
  if (dice.length === 0) return -1;
  const counts = [0, 0, 0, 0, 0, 0, 0];
  for (const d of dice) counts[d]++;
  let best = -1;
  if (dice.length === 6) {
    const c = counts.slice(1).filter((n) => n > 0).sort((a, b) => a - b);
    if (c.length === 6) best = Math.max(best, 1500); // 1-2-3-4-5-6
    if (c.length === 3 && c.every((n) => n === 2)) best = Math.max(best, 1500); // three pairs
    if (c.length === 2 && c[0] === 2 && c[1] === 4) best = Math.max(best, 1500); // four + a pair
    if (c.length === 2 && c[0] === 3 && c[1] === 3) best = Math.max(best, 2500); // two triplets
  }
  // Otherwise each face scores on its own: an n-of-a-kind, plus loose 1s and 5s.
  let total = 0;
  for (let f = 1; f <= 6; f++) {
    const n = counts[f];
    if (n === 0) continue;
    let face = -1;
    for (let k = 0; k <= n; k++) {
      if (k > 0 && k < 3) continue;
      const kind = k === 0 ? 0 : k === 3 ? TRIPLE[f] : KIND[k];
      const loose = n - k;
      const single = f === 1 ? 100 : f === 5 ? 50 : loose === 0 ? 0 : -1;
      if (single < 0) continue;
      face = Math.max(face, kind + loose * single);
    }
    if (face < 0) {
      total = -1;
      break;
    }
    total += face;
  }
  return Math.max(best, total);
}

/** Does this roll contain anything that scores? */
export function anyScore(dice: number[]): boolean {
  return dice.includes(1) || dice.includes(5) || [2, 3, 4, 6].some((f) => dice.filter((d) => d === f).length >= 3) || scoreDice(dice) > 0;
}

export interface FarkleState {
  seats: Seat[];
  turn: number;
  banked: number[];
  turnTotal: number;
  /** The dice from the latest roll (only the ones still in play). */
  dice: number[];
  phase: "roll" | "choose" | "over";
  /** Seats still owed a final turn, once someone banks 10,000. */
  finals: number[] | null;
  last: { seat: number; kind: "farkle" | "bank"; points: number; dice: number[] } | null;
}

export type FarkleAction = { type: "roll"; keep?: number[] } | { type: "bank"; keep: number[] };

const roll = (n: number, rand: () => number) => Array.from({ length: n }, () => 1 + Math.floor(rand() * 6));

function pickKeep(s: FarkleState, keep: number[] | undefined): { points: number; left: number } {
  const idx = keep ?? [];
  if (idx.length === 0 || new Set(idx).size !== idx.length || idx.some((i) => !Number.isInteger(i) || i < 0 || i >= s.dice.length)) {
    throw new GameError("Choose at least one scoring die to keep.");
  }
  const points = scoreDice(idx.map((i) => s.dice[i]));
  if (points <= 0) throw new GameError("Every die you keep has to score.");
  return { points, left: s.dice.length - idx.length };
}

function nextTurn(s: FarkleState, seat: number): FarkleState {
  const n = s.seats.length;
  if (s.finals) {
    const finals = s.finals.filter((x) => x !== seat);
    if (finals.length === 0) return { ...s, finals, phase: "over", turnTotal: 0, dice: [] };
    return { ...s, finals, turn: finals[0], phase: "roll", turnTotal: 0, dice: [] };
  }
  return { ...s, turn: (seat + 1) % n, phase: "roll", turnTotal: 0, dice: [] };
}

/** Roll `count` dice; a roll with nothing scoring ends the turn at once. */
function doRoll(s: FarkleState, seat: number, count: number, turnTotal: number, rand: () => number): FarkleState {
  const dice = roll(count, rand);
  if (!anyScore(dice)) return nextTurn({ ...s, last: { seat, kind: "farkle", points: turnTotal, dice } }, seat);
  return { ...s, dice, turnTotal, phase: "choose" };
}

export const farkle: GameDef<FarkleState, FarkleAction> = {
  key: "farkle",
  name: "Farkle",
  tagline: "Keep rolling for more — or bank it before you bust.",
  styles: ["dice"],
  minPlayers: 2,
  maxPlayers: 8,
  time: "20–40 min",
  description:
    "The push-your-luck dice game. Roll six dice, set aside the ones that score, and decide: bank your points, or roll what's left for more? Roll nothing that scores and you lose everything from that turn. First to 10,000 triggers a final round.",
  rules: [
    {
      heading: "Your turn",
      body: [
        "Roll all six dice. Keep at least one scoring die, then either bank your turn's points or roll the rest.",
        "Score all six? Hot dice — you can roll all six again and keep your points.",
        "If a roll has nothing that scores, you farkle: the turn's points are lost.",
        "Your first bank of the game needs at least 500 points.",
      ],
    },
    {
      heading: "Scoring (from a single roll)",
      body: [
        "A 1 = 100 · a 5 = 50.",
        "Three of a kind: 1s = 300, 2s = 200, 3s = 300, 4s = 400, 5s = 500, 6s = 600.",
        "Four of a kind = 1,000 · five = 2,000 · six = 3,000.",
        "1-2-3-4-5-6 = 1,500 · three pairs = 1,500 · four of a kind plus a pair = 1,500 · two triplets = 2,500.",
        "Dice from different rolls never combine.",
      ],
    },
    { heading: "Winning", body: ["When someone banks 10,000 or more, everyone else gets one last turn. Highest total wins; ties share the win."] },
  ],
  license: {
    name: "GPL-3.0 reference (joacand/farkle-game-web); original code",
    url: "https://github.com/joacand/farkle-game-web/blob/main/LICENSE",
    note: "No code from that project is used. Scoring table after PlayMonster's published rules.",
  },

  setup(seats, ctx) {
    return { seats, turn: randomIndex(seats.length, ctx.rand), banked: seats.map(() => 0), turnTotal: 0, dice: [], phase: "roll", finals: null, last: null };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "over") throw new GameError("The game is over.");
    const seat = s.seats.findIndex((p) => p.id === playerId);
    if (seat !== s.turn) throw new GameError("It's not your turn.");

    if (a.type === "roll") {
      if (s.phase === "roll") return doRoll(s, seat, 6, 0, ctx.rand);
      const { points, left } = pickKeep(s, a.keep);
      return doRoll(s, seat, left === 0 ? 6 : left, s.turnTotal + points, ctx.rand);
    }

    if (s.phase !== "choose") throw new GameError("Roll first.");
    const { points } = pickKeep(s, a.keep);
    const total = s.turnTotal + points;
    if (s.banked[seat] === 0 && total < ENTRY) throw new GameError(`Your first bank needs at least ${ENTRY}. Keep rolling!`);
    const banked = s.banked.slice();
    banked[seat] += total;
    let finals = s.finals;
    if (!finals && banked[seat] >= TARGET) finals = s.seats.map((_, i) => (seat + 1 + i) % s.seats.length).filter((i) => i !== seat);
    const next: FarkleState = { ...s, banked, finals, last: { seat, kind: "bank", points: total, dice: [] } };
    if (finals && finals.length === 0) return { ...next, phase: "over" };
    return nextTurn(next, seat);
  },

  view(s, playerId) {
    const seat = s.seats.findIndex((p) => p.id === playerId);
    return {
      seats: s.seats.map((p, i) => ({ id: p.id, name: p.name, banked: s.banked[i], final: s.finals?.includes(i) ?? false })),
      you: seat,
      turn: s.turn,
      turnTotal: s.turnTotal,
      dice: s.dice,
      phase: s.phase,
      canBankFrom: s.banked[s.turn] === 0 ? ENTRY : 0,
      finals: s.finals !== null,
      last: s.last ? { ...s.last, name: s.seats[s.last.seat].name } : null,
    };
  },

  status(s) {
    if (s.phase === "over") return { over: true, message: winnerMessage(farkle.scoreboard!(s)), turn: [] };
    const p = s.seats[s.turn];
    const lead = s.finals ? "Final turns · " : "";
    return { over: false, message: `${lead}${nameOf(s.seats, p.id)}${s.turnTotal ? ` has ${s.turnTotal} riding` : "'s turn"}`, turn: [p.id] };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.banked[i], playerIds: [p.id] }));
  },
};
