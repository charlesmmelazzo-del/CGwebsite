// ─── 15 Word Grid ────────────────────────────────────────────────────────────
// Handoff defaults: 2–8 players, a shared 4×4 letter grid, three 3-minute
// rounds. Words of 3+ letters trace touching tiles (diagonals count), each
// tile once per word; "Qu" is one tile. Words found by two or more players are
// cancelled for all of them. Score by length: 3–4 = 1, 5 = 2, 6 = 3, 7 = 5,
// 8+ = 11. The server checks every path and the dictionary.

import { normalizeWord, winnerMessage } from "../common";
import { GRID_LETTERS } from "../decks";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const ROUNDS = 3;
export const ROUND_MS = 180_000;
const SIZE = 4;
const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export interface GridState {
  seats: Seat[];
  round: number;
  board: string[];
  phase: "live" | "results" | "done";
  endsAt: number;
  found: Record<string, string[]>;
  rejected: Record<string, string[]>;
  scores: number[];
  results: { id: string; accepted: { word: string; points: number }[]; cancelled: string[]; rejected: string[]; total: number }[] | null;
}

export type GridAction = { type: "word"; path?: number[]; word?: string } | { type: "next" };

export function wordPoints(word: string): number {
  const n = word.length;
  return n >= 8 ? 11 : n === 7 ? 5 : n === 6 ? 3 : n === 5 ? 2 : n >= 3 ? 1 : 0;
}

export function makeBoard(rand: () => number): string[] {
  const total = GRID_LETTERS.reduce((t, [, w]) => t + w, 0);
  const pick = () => {
    let r = rand() * total;
    for (const [l, w] of GRID_LETTERS) if ((r -= w) < 0) return l;
    return "E";
  };
  for (;;) {
    const b = Array.from({ length: SIZE * SIZE }, pick);
    const vowels = b.filter((l) => VOWELS.has(l)).length;
    if (vowels >= 5 && vowels <= 8) return b;
  }
}

export function adjacent(a: number, b: number): boolean {
  const [r1, c1] = [Math.floor(a / SIZE), a % SIZE];
  const [r2, c2] = [Math.floor(b / SIZE), b % SIZE];
  return a !== b && Math.abs(r1 - r2) <= 1 && Math.abs(c1 - c2) <= 1;
}

export function spell(board: string[], path: number[]): string {
  return path.map((i) => board[i]).join("").toLowerCase();
}

export function validPath(path: number[]): boolean {
  if (new Set(path).size !== path.length) return false;
  return path.every((p, i) => Number.isInteger(p) && p >= 0 && p < SIZE * SIZE && (i === 0 || adjacent(path[i - 1], p)));
}

/** Find any path spelling `word` (for typed answers). */
export function findPath(board: string[], word: string): number[] | null {
  const w = word.toLowerCase();
  const tiles = board.map((l) => l.toLowerCase());
  const dfs = (pos: number, at: number, used: number[]): number[] | null => {
    const t = tiles[pos];
    if (!w.startsWith(t, at)) return null;
    const path = [...used, pos];
    if (at + t.length === w.length) return path;
    for (let n = 0; n < tiles.length; n++) {
      if (!path.includes(n) && adjacent(pos, n)) {
        const r = dfs(n, at + t.length, path);
        if (r) return r;
      }
    }
    return null;
  };
  for (let i = 0; i < tiles.length; i++) {
    const r = dfs(i, 0, []);
    if (r) return r;
  }
  return null;
}

function score(s: GridState): GridState {
  const counts = new Map<string, number>();
  for (const words of Object.values(s.found)) for (const w of words) counts.set(w, (counts.get(w) ?? 0) + 1);
  const scores = s.scores.slice();
  const results = s.seats.map((p, i) => {
    const mine = s.found[p.id] ?? [];
    const accepted = mine.filter((w) => counts.get(w) === 1).map((word) => ({ word, points: wordPoints(word) }));
    const total = accepted.reduce((t, a) => t + a.points, 0);
    scores[i] += total;
    return { id: p.id, accepted, cancelled: mine.filter((w) => (counts.get(w) ?? 0) > 1), rejected: s.rejected[p.id] ?? [], total };
  });
  return { ...s, scores, results, phase: s.round + 1 >= ROUNDS ? "done" : "results" };
}

function newRound(s: Pick<GridState, "seats">, round: number, now: number, rand: () => number) {
  return {
    round,
    board: makeBoard(rand),
    phase: "live" as const,
    endsAt: now + ROUND_MS,
    found: Object.fromEntries(s.seats.map((p) => [p.id, [] as string[]])),
    rejected: Object.fromEntries(s.seats.map((p) => [p.id, [] as string[]])),
    results: null,
  };
}

export const wordGrid: GameDef<GridState, GridAction> = {
  key: "word-grid",
  name: "Word Grid",
  tagline: "Three minutes, sixteen letters. Find words nobody else does.",
  styles: ["word", "board"],
  minPlayers: 2,
  maxPlayers: 8,
  time: "12 min",
  description:
    "Everyone gets the same grid of sixteen letters and three minutes to find as many words as they can by joining touching tiles. The catch: any word someone else also found doesn't count. Longer words are worth much more. Three rounds.",
  rules: [
    {
      heading: "Finding words",
      body: [
        "Tap letters that touch — across, up and down, or diagonally — to spell a word, then tap Add.",
        "Each tile can be used once per word. Words need at least three letters. “Qu” is one tile.",
        "Dictionary words only: no names, abbreviations or made-up forms.",
      ],
    },
    { heading: "Scoring", body: ["When time's up, any word found by two or more players is crossed off for everyone who found it.", "3–4 letters: 1 point · 5: 2 · 6: 3 · 7: 5 · 8 or more: 11."] },
    { heading: "Winning", body: ["Three rounds, a fresh grid each time. Highest total wins; ties share the win."] },
  ],
  license: {
    name: "MIT reference (fejj182/word-chaser); original code and letter distribution",
    url: "https://github.com/fejj182/word-chaser/blob/main/LICENSE",
    note: "Dictionary: see the word list's own license.",
  },

  setup(seats, ctx) {
    return { seats, scores: seats.map(() => 0), ...newRound({ seats }, 0, ctx.now, ctx.rand) };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "done") throw new GameError("The game is over.");
    if (a.type === "next") {
      const ticked = wordGrid.tick!(s, ctx) ?? s;
      if (ticked.phase !== "results") throw new GameError("The round is still going.");
      return { ...ticked, ...newRound(ticked, ticked.round + 1, ctx.now, ctx.rand) };
    }
    if (s.phase !== "live" || ctx.now >= s.endsAt) throw new GameError("Time's up!");
    if (!ctx.isWord) throw new GameError("The dictionary isn't available right now.");

    const path = a.path ?? (a.word ? findPath(s.board, normalizeWord(a.word).replace(/[^a-z]/g, "")) : null);
    if (!path || !validPath(path)) throw new GameError("Those letters don't connect.");
    const word = spell(s.board, path);
    const mine = s.found[playerId] ?? [];
    if (word.length < 3) throw new GameError("Words need at least three letters.");
    if (mine.includes(word)) return s; // already counted — a retry is harmless
    if (!ctx.isWord(word)) {
      const rejected = s.rejected[playerId] ?? [];
      if (rejected.includes(word)) throw new GameError(`“${word}” isn't in the dictionary.`);
      return { ...s, rejected: { ...s.rejected, [playerId]: [...rejected, word] } };
    }
    return { ...s, found: { ...s.found, [playerId]: [...mine, word] } };
  },

  tick(s, ctx) {
    return s.phase === "live" && ctx.now >= s.endsAt ? score(s) : null;
  },

  view(s, playerId) {
    return {
      board: s.board,
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      endsAt: s.endsAt,
      // Your own words only until the round ends.
      found: s.found[playerId] ?? [],
      rejected: s.rejected[playerId] ?? [],
      counts: s.seats.map((p) => ({ id: p.id, name: p.name, words: (s.found[p.id] ?? []).length })),
      results: s.results?.map((r) => ({ ...r, name: s.seats.find((p) => p.id === r.id)?.name ?? "" })) ?? null,
    };
  },

  status(s) {
    if (s.phase === "done") return { over: true, message: winnerMessage(wordGrid.scoreboard!(s)), turn: [] };
    if (s.phase === "results") return { over: false, message: `Round ${s.round + 1} results`, turn: [] };
    return { over: false, message: `Round ${s.round + 1} of ${ROUNDS} — find words!`, turn: s.seats.map((p) => p.id) };
  },

  scoreboard(s): ScoreLine[] {
    return s.seats.map((p, i) => ({ label: p.name, score: s.scores[i], playerIds: [p.id] }));
  },
};
