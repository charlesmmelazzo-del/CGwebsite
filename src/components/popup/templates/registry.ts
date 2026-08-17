// ─── Pop-up experience templates ─────────────────────────────────────────────
//
// Every pop-up menu names a template here. The template owns the entire visual
// treatment and any interactive gimmick — a trivia board, a mini game per
// cocktail, a scratch-off card. Accounts, voting, scheduling and the archive
// are handled by the platform underneath and don't change.
//
// TO ADD A NEW POP-UP EXPERIENCE:
//   1. Write a component that takes PopupTemplateProps (see lib/popup/types.ts).
//   2. Add one entry to TEMPLATES below.
// It then appears in the admin template picker automatically. Nothing else
// needs to change.

import type { ComponentType } from "react";
import type { PopupTemplateProps } from "@/lib/popup/types";
import ClassicTemplate from "./ClassicTemplate";
import HighScoresTemplate from "./HighScoresTemplate";

export interface PopupTemplate {
  key: string;
  label: string;
  /** Shown in the admin picker so the owner knows what they're choosing. */
  description: string;
  component: ComponentType<PopupTemplateProps>;
  defaultConfig?: Record<string, unknown>;
}

export const TEMPLATES: Record<string, PopupTemplate> = {
  classic: {
    key: "classic",
    label: "Classic Gallery",
    description:
      "A clean card grid — image, name, tagline and ingredients — with voting and the live leaderboard. The neutral baseline.",
    component: ClassicTemplate,
    defaultConfig: { showIngredients: true, showLeaderboard: true },
  },
  "high-scores": {
    key: "high-scores",
    label: "High Scores (Arcade)",
    description:
      "Golden-age arcade cabinets. Each cocktail opens to its full story plus a mini game with a high score board — top score wins a gift card.",
    component: HighScoresTemplate,
    defaultConfig: {},
  },
};

export const FALLBACK_TEMPLATE_KEY = "classic";

/**
 * Look up a template, falling back to the classic one.
 *
 * The fallback matters: a pop-up saved against a template that's since been
 * renamed still renders rather than white-screening in front of guests.
 */
export function getTemplate(key: string): PopupTemplate {
  return TEMPLATES[key] ?? TEMPLATES[FALLBACK_TEMPLATE_KEY];
}

export function listTemplates(): PopupTemplate[] {
  return Object.values(TEMPLATES);
}
