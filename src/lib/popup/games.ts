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
}

export const GAMES: Record<string, GameMeta> = {
  "behind-the-stick": {
    key: "behind-the-stick",
    title: "Behind the Stick",
    blurb: "Build the drink. Don't drop it.",
    howToPlay: [
      "Ingredients slide across the rail.",
      "Hit the matching button while it's inside the window.",
      "Three misses and you're done.",
      "Every ten pours, shake or stir it out.",
    ],
    playable: true,
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
