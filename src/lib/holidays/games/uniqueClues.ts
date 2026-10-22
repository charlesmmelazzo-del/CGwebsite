// ─── 12 Unique Clues ─────────────────────────────────────────────────────────
// Cooperative, per the handoff: 4–10 players, ten rounds. Everyone except the
// guesser sees the word and locks in a one-word clue (60 s). Identical clues
// cancel each other out — every copy. A moderator (the seat after the
// guesser) may strike illegal clues in a 20-second review. The guesser sees
// what survived and gets one try (30 s). Score out of ten, together.

import { shuffle } from "../cards";
import { nameOf, normalizeWord, randomIndex } from "../common";
import { UNIQUE_TARGETS } from "../decks";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const ROUNDS = 10;
export const ENTRY_MS = 60_000;
export const REVIEW_MS = 20_000;
export const GUESS_MS = 30_000;

export interface UniqueState {
  seats: Seat[];
  round: number;
  firstGuesser: number;
  deck: number[];
  phase: "entry" | "review" | "guess" | "result" | "done";
  deadline: number;
  /** playerId → clue ("" = didn't submit in time). */
  clues: Record<string, string>;
  /** playerIds whose clue was cancelled as a duplicate. */
  dupes: string[];
  /** playerIds whose clue the moderator struck. */
  struck: string[];
  guess: string | null;
  correct: boolean;
  corrected: boolean;
  points: number;
  history: { word: string; correct: boolean }[];
}

export type UniqueAction =
  | { type: "clue"; word: string }
  | { type: "strike"; playerId: string }
  | { type: "reviewDone" }
  | { type: "guess"; word: string }
  | { type: "pass" }
  | { type: "correction"; correct: boolean }
  | { type: "next" };

const guesserIdx = (s: UniqueState) => (s.firstGuesser + s.round) % s.seats.length;
export const guesserOf = (s: UniqueState) => s.seats[guesserIdx(s)].id;
export const moderatorOf = (s: UniqueState) => s.seats[(guesserIdx(s) + 1) % s.seats.length].id;
const target = (s: UniqueState) => UNIQUE_TARGETS[s.deck[s.round]];

function matchesTarget(s: UniqueState, word: string) {
  const t = target(s);
  const w = normalizeWord(word);
  return [t.word, ...(t.aliases ?? [])].some((x) => normalizeWord(x) === w);
}

function closeEntry(s: UniqueState, now: number): UniqueState {
  const clues = { ...s.clues };
  for (const p of s.seats) if (p.id !== guesserOf(s) && !(p.id in clues)) clues[p.id] = "";
  const groups = new Map<string, string[]>();
  for (const [id, c] of Object.entries(clues)) {
    if (!c) continue;
    const k = normalizeWord(c);
    groups.set(k, [...(groups.get(k) ?? []), id]);
  }
  const dupes = Array.from(groups.values()).filter((g) => g.length > 1).flat();
  return { ...s, clues, dupes, phase: "review", deadline: now + REVIEW_MS };
}

function survivors(s: UniqueState): string[] {
  return Object.entries(s.clues)
    .filter(([id, c]) => c && !s.dupes.includes(id) && !s.struck.includes(id))
    .map(([, c]) => c);
}

function resolve(s: UniqueState, guess: string | null): UniqueState {
  const correct = guess !== null && matchesTarget(s, guess);
  return { ...s, phase: "result", guess, correct, points: s.points + (correct ? 1 : 0), corrected: false };
}

export const uniqueClues: GameDef<UniqueState, UniqueAction> = {
  key: "unique-clues",
  name: "Unique Clues",
  tagline: "Everyone writes one clue. Matching clues cancel out.",
  styles: ["word", "party", "cooperative"],
  minPlayers: 4,
  maxPlayers: 10,
  time: "15–25 min",
  description:
    "A cooperative word game. One player guesses; everyone else secretly writes a single-word clue. Before the guesser sees them, any clues that match are wiped out — so the obvious clue is a trap. Play ten words together and see how many you get.",
  rules: [
    { heading: "Each round", body: ["One player is the guesser. Everyone else sees the secret word on their phone.", "Each clue giver has 60 seconds to lock in one word. You can't see anyone else's clue."] },
    {
      heading: "Clue rules",
      body: [
        "One word only. Not the secret word or a form of it, no translations, no deliberate misspellings, no spelling hints.",
        "Single-word names are fine.",
      ],
    },
    {
      heading: "Cancelling",
      body: [
        "Identical clues cancel — all copies, not just the extras.",
        "Then there are 20 seconds for the moderator (the player after the guesser) to strike any clue that breaks the rules. The guesser never sees this part.",
      ],
    },
    { heading: "Guessing", body: ["The guesser sees the clues that survived and has 30 seconds for one guess, or can pass.", "A correct guess is a point for everyone. After ten words, see your score out of ten."] },
  ],
  license: { name: "MIT reference (cjquines/just-one); original code and word list", url: "https://github.com/cjquines/just-one/blob/master/LICENSE" },

  setup(seats, ctx) {
    return {
      seats,
      round: 0,
      firstGuesser: randomIndex(seats.length, ctx.rand),
      deck: shuffle(UNIQUE_TARGETS.map((_, i) => i), ctx.rand).slice(0, ROUNDS),
      phase: "entry",
      deadline: ctx.now + ENTRY_MS,
      clues: {},
      dupes: [],
      struck: [],
      guess: null,
      correct: false,
      corrected: false,
      points: 0,
      history: [],
    };
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "done") throw new GameError("The game is over.");
    const ticked = uniqueClues.tick!(s, ctx);
    if (ticked) {
      if (a.type === "next" || a.type === "correction") return uniqueClues.act(ticked, playerId, a, ctx);
      throw new GameError("Time's up for that.");
    }
    const guesser = guesserOf(s);

    switch (a.type) {
      case "clue": {
        if (s.phase !== "entry") throw new GameError("Clues are locked.");
        if (playerId === guesser) throw new GameError("You're guessing this round.");
        if (playerId in s.clues) throw new GameError("Your clue is locked in.");
        const word = String(a.word ?? "").trim();
        if (!word) throw new GameError("Type a clue.");
        if (/[\s_]/.test(word) || /[-–—.,/]/.test(word.replace(/'/g, ""))) throw new GameError("One word only — no spaces or hyphens.");
        if (word.length > 30) throw new GameError("That's a long word!");
        if (matchesTarget(s, word) || normalizeWord(word).startsWith(normalizeWord(target(s).word))) throw new GameError("That's the secret word!");
        const clues = { ...s.clues, [playerId]: word };
        const next = { ...s, clues };
        return Object.keys(clues).length >= s.seats.length - 1 ? closeEntry(next, ctx.now) : next;
      }
      case "strike": {
        if (s.phase !== "review") throw new GameError("Not now.");
        if (playerId !== moderatorOf(s)) throw new GameError("Only the moderator can strike clues.");
        const struck = s.struck.includes(a.playerId) ? s.struck.filter((x) => x !== a.playerId) : [...s.struck, a.playerId];
        return { ...s, struck };
      }
      case "reviewDone": {
        if (s.phase !== "review") throw new GameError("Not now.");
        if (playerId !== moderatorOf(s)) throw new GameError("The moderator decides when review is done.");
        return { ...s, phase: "guess", deadline: ctx.now + GUESS_MS };
      }
      case "guess":
      case "pass": {
        if (s.phase !== "guess") throw new GameError("Not time to guess.");
        if (playerId !== guesser) throw new GameError("Only the guesser can answer.");
        return resolve(s, a.type === "guess" ? String(a.word ?? "").trim() || null : null);
      }
      case "correction": {
        if (s.phase !== "result") throw new GameError("Corrections happen after the guess.");
        if (playerId !== ctx.hostId) throw new GameError("Only the host can correct the score.");
        if (a.correct === s.correct) return s;
        return { ...s, correct: a.correct, corrected: true, points: s.points + (a.correct ? 1 : -1) };
      }
      case "next": {
        if (s.phase !== "result") throw new GameError("Finish the round first.");
        const history = [...s.history, { word: target(s).word, correct: s.correct }];
        if (s.round + 1 >= ROUNDS) return { ...s, history, phase: "done" };
        return { ...s, history, round: s.round + 1, phase: "entry", deadline: ctx.now + ENTRY_MS, clues: {}, dupes: [], struck: [], guess: null, correct: false, corrected: false };
      }
    }
  },

  tick(s, ctx) {
    if (ctx.now < s.deadline) return null;
    if (s.phase === "entry") return closeEntry(s, ctx.now);
    if (s.phase === "review") return { ...s, phase: "guess", deadline: ctx.now + GUESS_MS };
    if (s.phase === "guess") return resolve(s, null);
    return null;
  },

  view(s, playerId) {
    const guesser = guesserOf(s);
    const isGuesser = playerId === guesser;
    const reveal = s.phase === "result" || s.phase === "done";
    const all = Object.entries(s.clues).map(([id, word]) => ({ id, name: nameOf(s.seats, id), word, dupe: s.dupes.includes(id), struck: s.struck.includes(id) }));
    return {
      round: s.round,
      rounds: ROUNDS,
      phase: s.phase,
      deadline: s.deadline,
      guesser: { id: guesser, name: nameOf(s.seats, guesser) },
      moderator: { id: moderatorOf(s), name: nameOf(s.seats, moderatorOf(s)) },
      isGuesser,
      // The guesser never receives the word or raw clues before the result.
      word: !isGuesser || reveal ? target(s)?.word ?? null : null,
      yourClue: s.clues[playerId] ?? null,
      locked: Object.keys(s.clues).length,
      givers: s.seats.length - 1,
      clues: isGuesser && !reveal ? (s.phase === "guess" ? survivors(s) : []) : s.phase === "entry" ? [] : all,
      surviving: s.phase === "guess" || reveal ? survivors(s) : null,
      guess: reveal ? s.guess : null,
      correct: reveal ? s.correct : null,
      corrected: s.corrected,
      points: s.points,
      history: s.history,
    };
  },

  status(s) {
    if (s.phase === "done") return { over: true, message: `You got ${s.points} out of ${ROUNDS}!`, turn: [] };
    const g = nameOf(s.seats, guesserOf(s));
    if (s.phase === "entry") return { over: false, message: `Word ${s.round + 1}: clues for ${g}`, turn: s.seats.filter((p) => p.id !== guesserOf(s) && !(p.id in s.clues)).map((p) => p.id) };
    if (s.phase === "review") return { over: false, message: "Checking clues…", turn: [moderatorOf(s)] };
    if (s.phase === "guess") return { over: false, message: `${g} is guessing`, turn: [guesserOf(s)] };
    return { over: false, message: s.correct ? "Got it!" : "Not this time", turn: [] };
  },

  scoreboard(s): ScoreLine[] {
    return [{ label: "Everyone", score: s.points, playerIds: s.seats.map((p) => p.id) }];
  },
};
