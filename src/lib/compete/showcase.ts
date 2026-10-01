// ─── The partner showcase — a fully simulated Cascahuín event ─────────────────
//
// Built from the same content as the demo event (src/lib/compete/demo.ts) but
// entirely in memory: no database, no codes, nothing saved. Feeds the real
// guest screens so prospective partners see exactly what guests will.

import { DEFAULT_BARTENDER_FIELDS, DEFAULT_COCKTAIL_FIELDS, DEFAULT_SCORE_CATEGORIES, DEFAULT_SUPERLATIVES } from "./defaults";
import { DEMO_CONTESTANTS, DEMO_PROFILE, DEMO_RECIPES } from "./demo";
import type { PublicEvent } from "./types";

export const SHOWCASE_SLUG = "showcase";

export function buildShowcaseEvent(commonGoodLogo: string): PublicEvent {
  return {
    id: "showcase",
    slug: SHOWCASE_SLUG,
    name: "The Cascahuín Cup",
    featuredSpirit: "Tequila Cascahuín",
    eventDate: "2026-10-22",
    startTime: "7:00 PM",
    location: "Common Good Cocktail House, Glen Ellyn",
    intro:
      "Six of the area’s best bartenders, one legendary tequila. Taste each cocktail, score it live from your phone, and help crown the winner.",
    accentColor: "#B8975A",
    status: "published",
    bartenderFields: DEFAULT_BARTENDER_FIELDS,
    cocktailFields: DEFAULT_COCKTAIL_FIELDS,
    scoreCategories: DEFAULT_SCORE_CATEGORIES,
    superlatives: DEFAULT_SUPERLATIVES,
    recipes: DEMO_RECIPES,
    bigScreen: false,
    sponsors: [{ id: "cascahuin", isPrimary: true, profile: DEMO_PROFILE }],
    contestants: DEMO_CONTESTANTS.map((c, i) => ({
      id: `c${i + 1}`,
      sort: i,
      bartender: c.bartender,
      cocktail: c.cocktail,
    })),
    commonGoodLogo,
  };
}
