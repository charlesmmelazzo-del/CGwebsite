// ─── 14 Pass the Word ────────────────────────────────────────────────────────
// Handoff defaults: a hidden timer of 45–90 s (only the server knows it).
// Every correct answer passes control to the OTHER team's next clue giver —
// correct answers don't score. Whoever holds control when the buzzer goes
// loses the round; the other team gets a point. One skip per possession; an
// opposing referee's foul retires the prompt and locks the clue giver out for
// 5 s. First team to 7. Not Word Relay: no fixed turns, no per-answer points.

import { shuffle } from "../cards";
import { nameOf, randomIndex, TEAM_NAMES, teamMembers, TWO_TEAMS } from "../common";
import { PROMPTS } from "../decks";
import { GameError, type GameDef, type ScoreLine, type Seat } from "../types";

export const TARGET = 7;
export const MIN_S = 45;
export const MAX_S = 90;
export const LOCKOUT_MS = 5000;

export interface PassState {
  seats: Seat[];
  scores: [number, number];
  round: number;
  startTeam: number;
  phase: "ready" | "live" | "roundOver" | "done";
  team: number;
  nextGiver: [number, number];
  giver: string;
  /** Server-only: never sent to a phone. */
  deadline: number | null;
  deck: number[];
  card: number | null;
  skipUsed: boolean;
  lockoutUntil: number;
  referee: [string, string];
  passes: number;
  lastRound: { loser: number } | null;
}

export type PassAction = { type: "start" } | { type: "correct" } | { type: "skip" } | { type: "foul" } | { type: "next" };

function member(seats: Seat[], team: number, idx: number) {
  const m = teamMembers(seats, team);
  return m[idx % m.length].id;
}

function draw(s: PassState, rand: () => number): Pick<PassState, "card" | "deck"> {
  const deck = s.deck.length ? s.deck : shuffle(PROMPTS.map((_, i) => i).filter((i) => i !== s.card), rand);
  return { card: deck[0], deck: deck.slice(1) };
}

/** Hand control to `team`'s next clue giver. */
function giveTo(s: PassState, team: number): PassState {
  const nextGiver: [number, number] = [...s.nextGiver];
  const giver = member(s.seats, team, nextGiver[team]);
  nextGiver[team]++;
  return { ...s, team, giver, nextGiver, skipUsed: false, lockoutUntil: 0 };
}

function roundReferees(seats: Seat[], round: number): [string, string] {
  return [member(seats, 0, round + 1), member(seats, 1, round + 1)];
}

export const passTheWord: GameDef<PassState, PassAction> = {
  key: "pass-the-word",
  name: "Pass the Word",
  tagline: "Get it, pass it — don't be holding it when the buzzer goes.",
  styles: ["word", "party", "teams"],
  minPlayers: 4,
  maxPlayers: 12,
  time: "15–30 min",
  teams: TWO_TEAMS,
  description:
    "A hot-potato word game. A secret timer starts. Your clue giver describes a word; the moment your team gets it, control jumps to the other team's phone. Back and forth it goes — and whichever team has it when the buzzer sounds loses the round. First to seven.",
  rules: [
    { heading: "Teams", body: ["Two teams. Each time control comes to a team, the next player on that team gives the clues.", "One player on the other team is the referee and can see the word."] },
    {
      heading: "Playing",
      body: [
        "Tap Start. A hidden timer — somewhere between 45 and 90 seconds — begins. Nobody knows how long it is.",
        "Describe or act out the word. Don't say it, its parts, a form of it, spell it, or give first letters.",
        "When your team gets it, tap Correct: control passes straight to the other team with a new word. Correct answers don't score.",
        "One skip per turn with the word. A foul called by the referee throws the word out and locks the clue giver out for 5 seconds.",
      ],
    },
    { heading: "Scoring", body: ["Whichever team has control when the buzzer goes loses the round. The other team scores a point.", "First team to 7 points wins."] },
  ],
  license: { name: "MIT reference (ehopps/catchphrase); original code and prompts", url: "https://github.com/ehopps/catchphrase/blob/main/LICENSE", note: "Hidden-buzzer scoring is the pop-up's own implementation." },

  setup(seats, ctx) {
    const startTeam = randomIndex(2, ctx.rand);
    const base: PassState = {
      seats,
      scores: [0, 0],
      round: 0,
      startTeam,
      phase: "ready",
      team: startTeam,
      nextGiver: [0, 0],
      giver: "",
      deadline: null,
      deck: shuffle(PROMPTS.map((_, i) => i), ctx.rand),
      card: null,
      skipUsed: false,
      lockoutUntil: 0,
      referee: roundReferees(seats, 0),
      passes: 0,
      lastRound: null,
    };
    return giveTo(base, startTeam);
  },

  act(s, playerId, a, ctx) {
    if (s.phase === "done") throw new GameError("The game is over.");
    const ticked = passTheWord.tick!(s, ctx);
    if (ticked) {
      if (a.type === "next") return passTheWord.act(ticked, playerId, a, ctx);
      throw new GameError("Buzz! Time's up.");
    }

    if (a.type === "next") {
      if (s.phase !== "roundOver") throw new GameError("The round is still going.");
      const startTeam = 1 - s.startTeam;
      return giveTo({ ...s, round: s.round + 1, startTeam, phase: "ready", card: null, deadline: null, referee: roundReferees(s.seats, s.round + 1), passes: 0 }, startTeam);
    }
    if (a.type === "foul") {
      if (s.phase !== "live") throw new GameError("No word is in play.");
      if (playerId !== s.referee[1 - s.team]) throw new GameError("Only the referee can call a foul.");
      return { ...s, ...draw(s, ctx.rand), lockoutUntil: ctx.now + LOCKOUT_MS };
    }
    if (playerId !== s.giver) throw new GameError("Only the clue giver can do that.");
    if (a.type === "start") {
      if (s.phase !== "ready") throw new GameError("The round has started.");
      const seconds = MIN_S + Math.floor(ctx.rand() * (MAX_S - MIN_S + 1));
      return { ...s, phase: "live", deadline: ctx.now + seconds * 1000, ...draw(s, ctx.rand) };
    }
    if (s.phase !== "live") throw new GameError("Tap Start first.");
    if (ctx.now < s.lockoutUntil) throw new GameError("Locked out for a few seconds after that foul.");
    if (a.type === "skip") {
      if (s.skipUsed) throw new GameError("You've used your skip.");
      return { ...s, skipUsed: true, ...draw(s, ctx.rand) };
    }
    // Correct: pass it to the other team.
    return { ...giveTo(s, 1 - s.team), ...draw(s, ctx.rand), passes: s.passes + 1 };
  },

  tick(s, ctx) {
    if (s.phase !== "live" || s.deadline === null || ctx.now < s.deadline) return null;
    const winner = 1 - s.team;
    const scores: [number, number] = [...s.scores];
    scores[winner]++;
    return { ...s, scores, phase: scores[winner] >= TARGET ? "done" : "roundOver", deadline: null, card: null, lastRound: { loser: s.team } };
  },

  view(s, playerId) {
    const you = s.seats.find((p) => p.id === playerId);
    const isRef = playerId === s.referee[1 - s.team];
    return {
      teams: [0, 1].map((t) => ({ name: TEAM_NAMES[t], score: s.scores[t], members: teamMembers(s.seats, t).map((p) => ({ id: p.id, name: p.name })) })),
      phase: s.phase,
      team: s.team,
      giver: { id: s.giver, name: nameOf(s.seats, s.giver) },
      referee: { id: s.referee[1 - s.team], name: nameOf(s.seats, s.referee[1 - s.team]) },
      yourTeam: you?.team ?? null,
      // The prompt goes to the clue giver and the referee only. The deadline goes to nobody.
      card: s.phase === "live" && s.card !== null && (playerId === s.giver || isRef) ? PROMPTS[s.card] : null,
      isReferee: isRef,
      skipUsed: s.skipUsed,
      lockoutUntil: s.lockoutUntil,
      passes: s.passes,
      lastRound: s.lastRound ? { loser: TEAM_NAMES[s.lastRound.loser], winner: TEAM_NAMES[1 - s.lastRound.loser] } : null,
      target: TARGET,
    };
  },

  status(s) {
    if (s.phase === "done") return { over: true, message: `${TEAM_NAMES[s.scores[0] >= TARGET ? 0 : 1]} wins!`, turn: [] };
    if (s.phase === "roundOver") return { over: false, message: `Buzz! ${TEAM_NAMES[s.lastRound!.loser]} was holding it`, turn: [] };
    const g = nameOf(s.seats, s.giver);
    return { over: false, message: s.phase === "ready" ? `${g} starts for ${TEAM_NAMES[s.team]}` : `${TEAM_NAMES[s.team]} has it — ${g}`, turn: [s.giver] };
  },

  scoreboard(s): ScoreLine[] {
    return [0, 1].map((t) => ({ label: TEAM_NAMES[t], score: s.scores[t], playerIds: teamMembers(s.seats, t).map((p) => p.id) }));
  },
};
