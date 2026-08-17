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
import TopShelf from "./TopShelf";

export interface ArcadeGameProps {
  /**
   * Call once when the run ends. `detail` is stored alongside the score and is
   * what the owner looks at if a winning number seems too good to be true.
   */
  onGameOver: (score: number, detail?: Record<string, unknown>) => void;
}

const COMPONENTS: Record<string, ComponentType<ArcadeGameProps>> = {
  "behind-the-stick": BehindTheStick,
  "top-shelf": TopShelf,
};

export function getGameComponent(key: string): ComponentType<ArcadeGameProps> | null {
  return COMPONENTS[key] ?? null;
}
