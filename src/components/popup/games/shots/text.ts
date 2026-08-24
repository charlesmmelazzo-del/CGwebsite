// ─── Let's Do Shots! — laying out sentences ──────────────────────────────────
//
// Its own module so the TEST can reach it. The instruction pages are written as
// sentences rather than as pre-broken lines, which means how many lines they
// need is a function of the font, the copy and the screen — exactly the sort of
// thing that quietly stops fitting when somebody edits a word, and exactly the
// sort of thing a test should be able to check without rendering anything.

import { textWidth } from "../arcade";

/** Height of one line of `scale` lettering, leading included. */
export function lineHeight(scale: number): number {
  return 7 * scale + 3 * scale;
}

/** Break `text` into lines no wider than `maxW`. */
export function wrapLines(text: string, maxW: number, scale: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = "";
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (line && textWidth(candidate, scale) > maxW) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);
  return lines;
}

/**
 * The instruction copy, in the order the pages show it.
 *
 * Here rather than inline in the renderer so the test can measure it — see
 * "the how-to copy fits on the shortest screen" in __tests__/shots.test.ts.
 */
export const HOWTO_COPY: string[][] = [
  ["Flick a bottle into the one next to it to swap them."],
  [
    "Match 4 to clear them and earn points.",
    "Match 4 next to a coffee cup to get more swipes.",
  ],
  [
    "Swipe to put bottles in the right order to match the recipe of the shot the guest ordered, to break out more bottles and earn bonuses.",
    "Clear the number of bottles called for by the round before running out of swipes to make the next stage!",
  ],
];

/** Space between wrapped paragraphs, in logical pixels. */
export const PARAGRAPH_GAP = 8;
