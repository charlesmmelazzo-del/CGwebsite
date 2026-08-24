// ─── Mini game components ────────────────────────────────────────────────────
//
// The counterpart to src/lib/popup/games.ts, which holds the metadata the
// server and admin need without dragging a canvas game into their bundles.
//
// TO ADD A GAME:
//   1. Write a component taking ArcadeGameProps — it owns its canvas, its
//      controls and its own state, and calls onGameOver when the run ends.
//   2. Add its metadata to GAMES in src/lib/popup/games.ts.
//   3. Add the component here.
// GameShell then gives it an attract screen, score submission, the high score
// board and the gift-card notice for free.

import type { ComponentType } from "react";
import BehindTheStick from "./BehindTheStick";
import LetsDoShots from "./shots/LetsDoShots";
import TikiWars from "./tiki/TikiWars";
import TopShelf from "./TopShelf";

export interface ArcadeGameProps {
  /**
   * Call once when the run ends. `detail` is stored alongside the score and is
   * what the owner looks at if a winning number seems too good to be true.
   *
   * NEVER called in demo mode.
   */
  onGameOver: (score: number, detail?: Record<string, unknown>) => void;

  /**
   * Attract mode. The game plays ITSELF, on a loop, for someone browsing the
   * carousel — exactly what a cabinet did with nobody standing at it.
   *
   * A game in demo mode must:
   *   * drive itself, ignoring every real input
   *   * hide its controls, so nothing invites a tap that will not register
   *   * restart on game over rather than reporting a score
   *   * never call onGameOver, so a demo cannot land on a leaderboard
   *
   * The bot lives inside the game, next to the rules it is playing against.
   * A central bot would have to know every game's internals and would rot the
   * moment a game changed. See GameDemo.tsx for the wrapper that mounts these.
   */
  demo?: boolean;

  /**
   * Pop-up and guest, for a game that keeps progress between runs.
   *
   * Both optional: the two string-art games are pure client-side — a run
   * happens in memory and one number is posted at the end — and they ignore
   * these entirely. Tiki Wars needs them to find its save file.
   */
  menuId?: string;
  viewerId?: string | null;
}

const COMPONENTS: Record<string, ComponentType<ArcadeGameProps>> = {
  "behind-the-stick": BehindTheStick,
  "top-shelf": TopShelf,
  "tiki-wars": TikiWars,
  "lets-do-shots": LetsDoShots,
};

export function getGameComponent(key: string): ComponentType<ArcadeGameProps> | null {
  return COMPONENTS[key] ?? null;
}
