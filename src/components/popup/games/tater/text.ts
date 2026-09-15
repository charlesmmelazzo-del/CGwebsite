// ─── Tater Tales — laying out sentences ──────────────────────────────────────
//
// Its own module so the TEST can reach it. Mr. Tater's line is long, the intro
// slides are written as sentences rather than as pre-broken lines, and how many
// lines any of it needs is a function of the font, the copy and the screen —
// exactly the sort of thing that quietly stops fitting when somebody edits a
// word, and exactly the sort of thing a test should be able to check without
// rendering anything.

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
 * How to play, in the order the pages show it.
 *
 * Here rather than inline in the renderer so the test can measure it against
 * the narrowest screen the game supports.
 */
export const HOWTO_COPY: string[][] = [
  [
    "ELMER SHAKES MIXEY UP AND RIDES THE FIZZ.",
    "TAP ONCE TO STOP THE ARROW WHERE YOU WANT TO GO.",
  ],
  [
    "THEN TAP AGAIN TO STOP THE CARBONATION GAUGE.",
    "FULLER MEANS FASTER AND FURTHER. YOU CAN BANK OFF THE WALLS.",
  ],
  [
    "GRAB MIXERS. HAND ONE TO A DUSTY BOTTLE AND IT FINALLY BECOMES A DRINK.",
    "MIXERS ARE ALSO FIZZ. WHEN THE CAN GOES FLAT THE RUN IS OVER.",
  ],
  [
    "FALLING NEVER KILLS YOU. YOU JUST HAVE TO CLIMB IT AGAIN.",
    "MR. TATER IS WAITING AT THE VERY TOP. KNOCK HIM OFF, THEN DO IT AGAIN. EVERY LAP GETS HARDER.",
  ],
];

/** Space between wrapped paragraphs, in logical pixels. */
export const PARAGRAPH_GAP = 8;
