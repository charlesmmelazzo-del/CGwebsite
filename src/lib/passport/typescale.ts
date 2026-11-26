/**
 * File 14, Part 8: the guest app's one type scale. Two families only, the ones the site already loads:
 *   display  KorinthSerial (the bar's licensed serif; its files are not in the public repo), falling back to Cormorant
 *            Garamond (next/font, weights 300 to 600), then Georgia: page titles, section headings, card titles.
 *   body     Futura (licensed; Light, Book and Medium files), falling back to Jost (next/font, 200 to 500), then the
 *            system sans: body text, secondary text, small-caps eyebrows and labels.
 * Sizes are in rem so a larger system text size scales everything. KorinthSerial ships Regular and an optional Bold;
 * Cormorant has no 700: headings use 600 with synthetic bold switched off, so a missing bold face shows the regular
 * weight rather than a smeared fake one. The same numbers drive globals.css (.pp-t-*) and the tests.
 */
export const ROOT_PX = 16;
export interface TypeStep { name: string; use: string; family: "display" | "body"; rem: number; weight: number; lineHeight: number; tracking?: string; caps?: boolean }
export const TYPE = {
  page: { name: "Page title", use: "Menu, Index, a cocktail's name (h1)", family: "display", rem: 2.5, weight: 500, lineHeight: 1.08 },
  // File 16, Part 9: one step larger (1.5 → 1.75rem) and drawn as a band: the section's icon, its accent and a rule.
  section: { name: "Section heading", use: "Right now, From the bar, Your lists, a tab's or album's name (h2)", family: "display", rem: 1.75, weight: 600, lineHeight: 1.2 },
  card: { name: "Card title", use: "a card's or row's name (h3, or the row's own text)", family: "display", rem: 1.25, weight: 500, lineHeight: 1.2 },
  body: { name: "Body", use: "descriptions, messages, paragraphs", family: "body", rem: 1, weight: 400, lineHeight: 1.5 },
  secondary: { name: "Secondary", use: "the one line under a name, captions, notes", family: "body", rem: 0.875, weight: 400, lineHeight: 1.45 },
  eyebrow: { name: "Eyebrow / label", use: "the small caps line above a title, a card's kind", family: "body", rem: 0.75, weight: 500, lineHeight: 1.3, tracking: "0.18em", caps: true },
} satisfies Record<string, TypeStep>;
export const px = (s: TypeStep) => s.rem * ROOT_PX;
