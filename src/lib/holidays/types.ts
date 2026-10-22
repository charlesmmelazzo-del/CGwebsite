// ─── Home for the Holidays — the game contract ───────────────────────────────
//
// Every group game is one module in src/lib/holidays/games/ that implements
// GameDef. The module is pure rules: no React, no network, no clock of its
// own — the server passes `now` and a random source in, which is what lets
// `npm run test:holidays` play whole games in a few milliseconds.
//
// The server is the referee. Phones send actions; the server runs `act`,
// saves the new state, and every phone gets back `view(state, you)` — so a
// player can never see someone else's hand by poking at the network.
//
// TO ADD A GAME:
//   1. Write src/lib/holidays/games/<game>.ts exporting a GameDef.
//   2. Write src/components/popup/holidays/games/<Game>.tsx (the board).
//   3. Add one line to each registry (lib/holidays/games/index.ts and
//      components/popup/holidays/games/index.tsx).

export type GameStyle = "cards" | "dominoes" | "word" | "party" | "dice" | "board" | "teams" | "cooperative";

export const STYLE_LABELS: Record<GameStyle, string> = {
  cards: "Card games",
  dominoes: "Dominoes",
  word: "Word games",
  party: "Party games",
  dice: "Dice games",
  board: "Board games",
  teams: "Team games",
  cooperative: "Cooperative",
};

/** A player as the game sees them. Order = turn order (the host joins first). */
export interface Seat {
  id: string;
  name: string;
  /** 0-based team index, for games that play in teams or partnerships. */
  team?: number;
}

export interface GameCtx {
  /** Milliseconds since the epoch, from the server. */
  now: number;
  /** Uniform in [0, 1). Seeded in tests. */
  rand: () => number;
  /** Is this a word? Server-only dictionary, for word games. */
  isWord?: (word: string) => boolean;
  /** The room's host — allowed to make visible score corrections. */
  hostId?: string;
}

/** A rules section shown before the game starts and from the in-game menu. */
export interface RulesSection {
  heading: string;
  body: string[];
}

export interface ScoreLine {
  /** A player's name, or a team name. */
  label: string;
  score: number;
  /** The players this line belongs to — highlights "you". */
  playerIds: string[];
}

export interface GameStatus {
  /** The game has finished on its own (someone won, the board is full…). */
  over: boolean;
  /** One line for the top of every phone: "Ava's turn", "Team 2 wins!" */
  message: string;
  /** Whose move it is, to nudge the right phones. */
  turn: string[];
}

export class GameError extends Error {}

export interface TeamRule {
  /** How many teams (2 for partnerships). */
  count: number;
  /** Each team needs at least this many players to start. */
  minPerTeam: number;
  /** Exact team size, for strict partnership games. */
  exactPerTeam?: number;
  names?: string[];
}

export interface GameLicense {
  /** "Traditional — public domain", "CC BY-SA 4.0", … */
  name: string;
  url?: string;
  note?: string;
}

export interface GameDef<S = unknown, A = unknown, V = unknown> {
  key: string;
  name: string;
  /** One line under the name in the list. */
  tagline: string;
  styles: GameStyle[];
  minPlayers: number;
  maxPlayers: number;
  /** "15–30 min" */
  time: string;
  /** Teams or partnerships the players pick in the lobby. */
  teams?: TeamRule;
  /** A paragraph for the detail sheet. */
  description: string;
  rules: RulesSection[];
  license: GameLicense;
  /** Optional art (public/ path). Without it, the detail sheet shows a live mini board. */
  image?: string;

  setup(seats: Seat[], ctx: GameCtx): S;
  act(state: S, playerId: string, action: A, ctx: GameCtx): S;
  /** Time-based changes (a turn timer running out). Null = nothing to do. */
  tick?(state: S, ctx: GameCtx): S | null;
  /** What one phone is allowed to see. */
  view(state: S, playerId: string): V;
  status(state: S): GameStatus;
  /** Running totals for the scoreboard. Omit for games without a score. */
  scoreboard?(state: S): ScoreLine[];
  /** Lowest score wins (penalty games). */
  lowScoreWins?: boolean;
}

// ─── Rooms ───────────────────────────────────────────────────────────────────

export type RoomStatus = "lobby" | "playing" | "ended";

/** A player as stored on the server — includes the secret token. */
export interface RoomPlayer {
  id: string;
  token: string;
  name: string;
  team?: number;
  host: boolean;
  joinedAt: string;
}

/** Everything one phone receives on each poll. */
export interface RoomView {
  code: string;
  gameKey: string;
  status: RoomStatus;
  version: number;
  you: { id: string; host: boolean } | null;
  players: { id: string; name: string; team?: number; host: boolean }[];
  /** The game's view for this phone, once it has started. */
  game: unknown;
  scoreboard: ScoreLine[] | null;
  lowScoreWins: boolean;
  gameStatus: GameStatus | null;
  endedBy?: "host" | "game";
  serverNow: number;
}
