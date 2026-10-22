// ─── Home for the Holidays — every group game ────────────────────────────────
//
// The eighteen games from the owner's catalogue, in its order. The list, the
// filters, the lobby and the server all read from here. Boards live in
// components/popup/holidays/games/index.tsx.

import type { GameDef } from "../types";
import { allFives } from "./allFives";
import { drawDominoes } from "./drawDominoes";
import { euchre } from "./euchre";
import { farkle } from "./farkle";
import { fishbowl } from "./fishbowl";
import { fiveDice } from "./fiveDice";
import { forbiddenWords } from "./forbiddenWords";
import { iDoubtIt } from "./iDoubtIt";
import { massiveDecks } from "./massiveDecks";
import { passTheWord } from "./passTheWord";
import { president } from "./president";
import { rummy } from "./rummy";
import { shutTheBox } from "./shutTheBox";
import { texas42 } from "./texas42";
import { trainDominoes } from "./trainDominoes";
import { uniqueClues } from "./uniqueClues";
import { wordGrid } from "./wordGrid";
import { wordRelay } from "./wordRelay";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each game owns its own state/action types
export const GAMES: GameDef<any, any, any>[] = [
  euchre,
  president,
  iDoubtIt,
  rummy,
  drawDominoes,
  allFives,
  texas42,
  trainDominoes,
  forbiddenWords,
  wordRelay,
  fishbowl,
  uniqueClues,
  massiveDecks,
  passTheWord,
  wordGrid,
  fiveDice,
  farkle,
  shutTheBox,
];

// The owner's illustration for each game's detail page (scripts/holidays-art.py).
for (const g of GAMES) g.image ??= `/popup/holidays/games/${g.key}.webp`;

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getGame(key: string): GameDef<any, any, any> | null {
  return GAMES.find((g) => g.key === key) ?? null;
}

/** "2–7 players" */
export function playerRange(g: Pick<GameDef, "minPlayers" | "maxPlayers">): string {
  return g.minPlayers === g.maxPlayers ? `${g.minPlayers} players` : `${g.minPlayers}–${g.maxPlayers} players`;
}
