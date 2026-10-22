// ─── Word Grid with the whole bar ────────────────────────────────────────────
// Rounds run back to back: two minutes of play, twenty seconds of results.
// Play solo if nobody else is on — the first person in starts a round. Join
// mid-round and you're in the next one. Words two or more players found are
// cancelled (as in the friends' game); round points add to today's score.

import { makeBoard, spell, validPath, findPath, wordPoints } from "../games/wordGrid";
import { normalizeWord } from "../common";
import { GameError } from "../types";
import { here, type PubState, type PublicGameDef } from "./engine";

export const ROUND_MS = 120_000;
export const BREAK_MS = 20_000;

export interface WGRound {
  round: number;
  phase: "idle" | "live" | "results";
  board: string[];
  endsAt: number;
  nextAt: number;
  participants: string[];
  found: Record<string, string[]>;
  rejected: Record<string, string[]>;
  last: {
    round: number;
    board: string[];
    results: { id: string; name: string; accepted: { word: string; points: number }[]; cancelled: string[]; total: number }[];
    winners: string[];
  } | null;
}

export type WGAction = { type: "word"; path?: number[]; word?: string };
type S = PubState<WGRound>;

function startRound(s: S, now: number, rand: () => number): S {
  const ids = s.players.filter((p) => here(p, now) && p.status !== "gone").map((p) => p.id);
  if (ids.length === 0) return { ...s, game: { ...s.game, phase: "idle", participants: [] } };
  const players = s.players.map((p) => (ids.includes(p.id) ? { ...p, status: "active" as const } : p.status === "active" ? { ...p, status: "queued" as const } : p));
  return {
    ...s,
    players,
    game: {
      ...s.game,
      round: s.game.round + 1,
      phase: "live",
      board: makeBoard(rand),
      endsAt: now + ROUND_MS,
      nextAt: 0,
      participants: ids,
      found: Object.fromEntries(ids.map((id) => [id, []])),
      rejected: Object.fromEntries(ids.map((id) => [id, []])),
    },
  };
}

function scoreRound(s: S): S {
  const g = s.game;
  const counts = new Map<string, number>();
  for (const id of g.participants) for (const w of g.found[id] ?? []) counts.set(w, (counts.get(w) ?? 0) + 1);
  const results = g.participants.map((id) => {
    const mine = g.found[id] ?? [];
    const accepted = mine.filter((w) => counts.get(w) === 1).map((word) => ({ word, points: wordPoints(word) }));
    return { id, name: s.players.find((p) => p.id === id)?.name ?? "", accepted, cancelled: mine.filter((w) => (counts.get(w) ?? 0) > 1), total: accepted.reduce((t, a) => t + a.points, 0) };
  });
  const best = Math.max(0, ...results.map((r) => r.total));
  const winners = best > 0 ? results.filter((r) => r.total === best).map((r) => r.id) : [];
  const players = s.players.map((p) => {
    const r = results.find((x) => x.id === p.id);
    return r ? { ...p, score: p.score + r.total } : p;
  });
  return { ...s, players, game: { ...g, phase: "results", nextAt: g.endsAt + BREAK_MS, last: { round: g.round, board: g.board, results, winners } } };
}

export const wordGridPublic: PublicGameDef<WGRound, WGAction> = {
  key: "word-grid",
  name: "Word Grid",
  tagline: "Back-to-back two-minute rounds. Play solo or against the whole bar.",
  description:
    "Find words in a grid of sixteen letters by joining touching tiles. Everyone in the bar plays the same grid at the same time; a word somebody else also found doesn't count. Every round adds to your score for today — even if you're the only one playing.",
  rules: [
    { heading: "Rounds", body: ["Each round lasts two minutes, then there's a short break for the results.", "If a round is already running when you join, you'll start with the next one. If nobody's playing, your round starts right away."] },
    { heading: "Words", body: ["Tap touching letters (diagonals count) to spell a word of three or more letters, then tap Add. Each tile once per word; “Qu” is one tile.", "3–4 letters: 1 point · 5: 2 · 6: 3 · 7: 5 · 8 or more: 11.", "Words two or more players found are crossed off for all of them."] },
    { heading: "Today's winner", body: ["Your round points add up all day. Whoever has the most when the day ends (4 a.m.) goes on the Daily Winners board."] },
  ],
  minPlayers: 1,
  maxActive: 200,

  init() {
    return { round: 0, phase: "idle", board: [], endsAt: 0, nextAt: 0, participants: [], found: {}, rejected: {}, last: null };
  },

  onJoin(s, playerId, ctx) {
    if (s.game.phase === "idle") return startRound(s, ctx.now, ctx.rand);
    // Already in this round (came back after a refresh): carry on.
    if (s.game.phase === "live" && s.game.participants.includes(playerId)) {
      return { ...s, players: s.players.map((p) => (p.id === playerId ? { ...p, status: "active" as const } : p)) };
    }
    return s;
  },

  act(s, playerId, a, ctx) {
    const g = s.game;
    if (g.phase !== "live" || ctx.now >= g.endsAt) throw new GameError("Time's up for this round!");
    if (!g.participants.includes(playerId)) throw new GameError("You'll be in the next round.");
    if (!ctx.isWord) throw new GameError("The dictionary isn't available right now.");
    const path = a.path ?? (a.word ? findPath(g.board, normalizeWord(a.word).replace(/[^a-z]/g, "")) : null);
    if (!path || !validPath(path)) throw new GameError("Those letters don't connect.");
    const word = spell(g.board, path);
    if (word.length < 3) throw new GameError("Words need at least three letters.");
    const mine = g.found[playerId] ?? [];
    if (mine.includes(word)) return s;
    if (!ctx.isWord(word)) {
      const rej = g.rejected[playerId] ?? [];
      if (rej.includes(word)) throw new GameError(`“${word}” isn't in the dictionary.`);
      return { ...s, game: { ...g, rejected: { ...g.rejected, [playerId]: [...rej, word] } } };
    }
    return { ...s, game: { ...g, found: { ...g.found, [playerId]: [...mine, word] } } };
  },

  tick(s, ctx) {
    const g = s.game;
    if (g.phase === "live" && ctx.now >= g.endsAt) return scoreRound(s);
    if (g.phase === "results" && ctx.now >= g.nextAt) return startRound(s, ctx.now, ctx.rand);
    // Nobody left? Stop the clock until someone joins.
    if (g.phase === "live" && !s.players.some((p) => here(p, ctx.now))) return { ...s, game: { ...g, phase: "idle", participants: [] } };
    return null;
  },

  view(s, playerId, ctx) {
    const g = s.game;
    const inRound = !!playerId && g.participants.includes(playerId);
    return {
      round: g.round,
      phase: g.phase,
      board: g.phase === "live" ? g.board : [],
      endsAt: g.endsAt,
      nextAt: g.nextAt,
      inRound,
      inThisRound: g.participants.length,
      waiting: s.players.filter((p) => p.status === "queued" && here(p, ctx.now)).length,
      found: inRound ? g.found[playerId!] ?? [] : [],
      rejected: inRound ? g.rejected[playerId!] ?? [] : [],
      last: g.last
        ? {
            ...g.last,
            // Long lists get trimmed: your own row, and the top ten.
            results: g.last.results.slice().sort((a, b) => b.total - a.total).filter((r, i) => i < 10 || r.id === playerId),
            winners: g.last.winners.map((id) => s.players.find((p) => p.id === id)?.name ?? ""),
          }
        : null,
    };
  },
};
