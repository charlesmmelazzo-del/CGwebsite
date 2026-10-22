// ─── 09 Forbidden Words ──────────────────────────────────────────────────────
// Handoff defaults: two teams, three 60-second turns each, the clue giver and
// an opposing referee see the card; Correct +1, Skip −1, referee's Foul −1;
// ties add paired extra turns.

import { TWO_TEAMS } from "../common";
import { FORBIDDEN } from "../decks";
import type { GameDef } from "../types";
import { makeTurnGame, type TurnAction, type TurnState } from "./teamTurns";

const engine = makeTurnGame({
  turnMs: 60_000,
  turnsPerTeam: 3,
  deckSize: FORBIDDEN.length,
  points: { correct: 1, skip: -1, foul: -1, expired: 0 },
  skips: null,
  referee: true,
  foulUsesSkip: false,
});

export const forbiddenWords: GameDef<TurnState, TurnAction> = {
  key: "forbidden-words",
  name: "Forbidden Words",
  tagline: "Get your team to say it — without the words on the card.",
  styles: ["word", "party", "teams"],
  minPlayers: 4,
  maxPlayers: 12,
  time: "20–30 min",
  teams: TWO_TEAMS,
  description:
    "Describe the word on your card so your team can guess it — but you can't say any of the forbidden words listed underneath. Someone from the other team watches the card and buzzes you if you slip. Sixty seconds a turn; three turns a team.",
  rules: [
    { heading: "Teams", body: ["Two teams take turns. The clue giver rotates each turn.", "For every turn, one player from the other team is the referee."] },
    {
      heading: "Giving clues",
      body: [
        "Tap Start and a card appears on your phone (and the referee's). Describe the word so your team says it.",
        "You can't say the word, any forbidden word on the card, or forms of them (like 'snowy' for 'snow'). Parts of a two-word answer are off limits too.",
        "No spelling, first letters, rhymes, translations, gestures or sound effects.",
      ],
    },
    {
      heading: "Scoring",
      body: [
        "Correct: +1 and a new card. Skip: −1 and a new card. A foul called by the referee: −1 and a new card. Scores can go below zero.",
        "When the 60 seconds run out, the card in play scores nothing. The host can fix a disputed card before the next turn starts.",
        "After three turns each, the highest score wins. A tie means one more turn each, until it's broken.",
      ],
    },
  ],
  license: {
    name: "MIT reference (Tabooo); original code and cards",
    url: "https://github.com/pawelblaszczyk5/tabooo/blob/master/LICENSE",
    note: "Rules adapted for the pop-up; no third-party code or card content is used.",
  },

  setup: engine.setup,
  act: engine.act,
  tick: engine.tick,
  view: (s, id) => engine.view(s, id, (i) => FORBIDDEN[i], (st, pid) => pid === st.giver || pid === st.referee),
  status: engine.status,
  scoreboard: engine.scoreboard,
};
