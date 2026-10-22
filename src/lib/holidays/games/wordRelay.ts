// ─── 10 Word Relay ───────────────────────────────────────────────────────────
// Handoff defaults: one team keeps the whole visible 60-second turn; Correct
// +1 and the SAME clue giver gets the next prompt; three skips per turn, no
// penalty; illegal clues are fixed by the host between turns (−1). Three turns
// a team; ties add paired turns. Not Pass the Word — control never passes on a
// correct answer here.

import { TWO_TEAMS } from "../common";
import { PROMPTS } from "../decks";
import type { GameDef } from "../types";
import { makeTurnGame, type TurnAction, type TurnState } from "./teamTurns";

const engine = makeTurnGame({
  turnMs: 60_000,
  turnsPerTeam: 3,
  deckSize: PROMPTS.length,
  points: { correct: 1, skip: 0, foul: -1, expired: 0 },
  skips: 3,
  referee: false,
  foulUsesSkip: true,
});

export const wordRelay: GameDef<TurnState, TurnAction> = {
  key: "word-relay",
  name: "Word Relay",
  tagline: "Sixty seconds. One clue giver. As many as your team can get.",
  styles: ["word", "party", "teams"],
  minPlayers: 4,
  maxPlayers: 12,
  time: "20–30 min",
  teams: TWO_TEAMS,
  description:
    "A sprint for your team. The clue giver gets a word or phrase and describes it any way they like — words, gestures, whatever works — except saying the answer. Every correct guess is a point and a fresh prompt. Keep going until the buzzer.",
  rules: [
    { heading: "Teams", body: ["Two teams take turns; each team's clue giver rotates every turn.", "Only the clue giver sees the prompt. Their teammates shout guesses."] },
    {
      heading: "Giving clues",
      body: [
        "Describe it, act it, hint at it — anything goes, except saying the answer, a form of it, or any word in it.",
        "No spelling, first letters, or straight translations.",
      ],
    },
    {
      heading: "Scoring",
      body: [
        "Correct: +1, and you keep going with a new prompt.",
        "You have three skips per turn; skipping costs nothing. When they're used up, Skip is turned off.",
        "If a clue broke the rules, the host can mark that card as a foul between turns: −1.",
        "After three turns each, the higher score wins. A tie means one more turn each.",
      ],
    },
  ],
  license: {
    name: "MIT reference (ehopps/catchphrase); original code and prompts",
    url: "https://github.com/ehopps/catchphrase/blob/main/LICENSE",
    note: "Fixed-turn rules are the pop-up's own adaptation.",
  },

  setup: engine.setup,
  act: engine.act,
  tick: engine.tick,
  view: (s, id) => engine.view(s, id, (i) => ({ word: PROMPTS[i] }), (st, pid) => pid === st.giver),
  status: engine.status,
  scoreboard: engine.scoreboard,
};
