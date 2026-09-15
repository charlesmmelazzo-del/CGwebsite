// ─── Mini game catalogue (metadata only) ─────────────────────────────────────
//
// Deliberately free of React imports so the API routes and the admin picker can
// validate a game key without pulling a canvas game into the server bundle.
// The components themselves live in src/components/popup/games/registry.ts,
// which builds on this list.

export interface GameMeta {
  key: string;
  /** Marquee title, shown on the cabinet. */
  title: string;
  /** One line under the title. */
  blurb: string;
  /** How to play, shown on the attract screen before the first round. */
  howToPlay: string[];
  /** False for a cocktail whose game hasn't been built yet. */
  playable: boolean;
  /**
   * Drop the cabinet chrome and give the game the whole viewport.
   *
   * The string-art games are 224x288 and look right inside a bezel with a
   * marquee over them. Tiki Wars is higher resolution, flexes its height to
   * the device, and draws its own controls into the canvas — a frame around
   * it would waste the screen its art is drawn for.
   */
  fullBleed?: boolean;
  /**
   * The game has a pass-the-phone party mode whose team scores go on a board
   * of their own, so a group never competes against solo players. Party scores
   * are stored under boardKey(key, "party"); the ticket run is still the game's.
   */
  partyBoard?: boolean;
}

export type BoardMode = "solo" | "party";

/** The game_key a board's scores are stored under. Solo is the game's own key. */
export function boardKey(gameKey: string, mode: BoardMode): string {
  return mode === "party" ? `${gameKey}:party` : gameKey;
}

/** True when this game keeps a separate party board. */
export function hasPartyBoard(gameKey: string | undefined): boolean {
  return Boolean(gameKey && GAMES[gameKey]?.partyBoard);
}

export const GAMES: Record<string, GameMeta> = {
  "behind-the-stick": {
    key: "behind-the-stick",
    title: "Behind the Stick",
    blurb: "It's a rush. Two thumbs, no mercy.",
    howToPlay: [
      "Hold your phone sideways, a thumb on each side.",
      "Tap the order's bottles as they fall. Dodge the junk, the vodka and the bombs.",
      "Play the build down the highway: two buttons per thumb.",
      "Shake or stir with your right thumb while the next order falls on the left.",
      "Micro games cut in. Win them for big points.",
      "Party Mode: up to 10 friends pass the phone. Mess up and you're out.",
    ],
    playable: true,
    fullBleed: true,
    partyBoard: true,
  },
  "top-shelf": {
    key: "top-shelf",
    title: "Top Shelf",
    blurb: "Climb after the bottle thief.",
    howToPlay: [
      "Climb the shelves and catch the thief.",
      "Jump the bottles rolling down at you.",
      "Every bottle you clear is points.",
      "Three hits and it's over.",
    ],
    playable: true,
  },
  "lets-do-shots": {
    key: "lets-do-shots",
    title: "Let's Do Shots!",
    blurb: "Match the bottles. Pour the order.",
    howToPlay: [
      "Flick a bottle into the one next to it.",
      "Three in a row breaks. Four or more takes the neighbours with it.",
      "Fill the guest's order before the swipes run out.",
      "Pour the bonus shot in recipe order for double.",
      "Break a coffee cup and you get swipes back.",
    ],
    playable: true,
    fullBleed: true,
  },
  "tater-tales": {
    key: "tater-tales",
    title: "Tater Tales",
    blurb: "Blast up Mr. Tater's shelves. How high can you go?",
    howToPlay: [
      "When the arrow points where you want to go, press and hold.",
      "Let go when the fizz is where you want it. Hold too long and it explodes.",
      "Fuller means faster and further. Bank off the walls.",
      "Grab mixers and hand them to the dusty bottles up there.",
      "Knock Tater off his top shelf, then do it again. Every lap is harder.",
      "Falling never kills you. Running out of fizz ends the run.",
    ],
    playable: true,
    fullBleed: true,
  },
  "tiki-wars": {
    key: "tiki-wars",
    title: "Tiki Wars",
    blurb: "Get her back. Shoot the fruit.",
    howToPlay: [
      "Drag anywhere to move. You fire automatically.",
      "Small fruit dies in one shot — big ones have to be killed.",
      "Steer through the gate you want. One side is a trap.",
      "Bank the money and upgrade between stages.",
    ],
    playable: true,
    fullBleed: true,
  },
};

/** Cocktails whose game is still to come render this instead. */
export const COMING_SOON_KEY = "coming-soon";

export function getGameMeta(key: string | undefined): GameMeta | null {
  if (!key) return null;
  return GAMES[key] ?? null;
}

export function isPlayableGame(key: string | undefined): boolean {
  return Boolean(key && GAMES[key]?.playable);
}

export function listGames(): GameMeta[] {
  return Object.values(GAMES);
}

// ─── Demo play ───────────────────────────────────────────────────────────────
//
// The games are a garnish on the drink. Anyone can try one for DEMO_SECONDS;
// to keep playing — unlimited free play, plus High Score Runs — they enter the
// ticket that came with that cocktail. The owner can open a game up to
// everyone (say, once the pop-up has sold out) with the cocktail's "enable free
// play" switch in the admin panel, stored as meta.freePlay.

/** How long a demo lasts, in seconds of actual play. */
export const DEMO_SECONDS = 90;

/** True when the owner has opened this cocktail's game to everyone, no ticket needed. */
export function isFreePlayEnabled(cocktail: { meta?: Record<string, unknown> } | null | undefined): boolean {
  return cocktail?.meta?.freePlay === true;
}
