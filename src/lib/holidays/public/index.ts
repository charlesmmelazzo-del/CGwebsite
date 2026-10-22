// The bar-wide games (Play with strangers). One always-on room each.

import type { PublicGameDef } from "./engine";
import { massivePublic } from "./massivePublic";
import { wordGridPublic } from "./wordGridPublic";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- each game owns its state/action types
export const PUBLIC_GAMES: PublicGameDef<any, any>[] = [wordGridPublic, massivePublic];

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function getPublicGame(key: string): PublicGameDef<any, any> | null {
  return PUBLIC_GAMES.find((g) => g.key === key) ?? null;
}

/** The room code a bar-wide game lives under in holiday_rooms. Never a 4-digit friends' code. */
export const publicCode = (key: string) => `PUB-${key}`;
