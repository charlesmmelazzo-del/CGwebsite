// ─── Word Grid's dictionary (server only) ────────────────────────────────────
// One lowercase word per line in src/content/holidays/wordlist.txt, loaded
// once per server. The phone never downloads it — the server checks words.
// Source and license for the list: src/content/holidays/WORDLIST-LICENSE.txt.

import { readFileSync } from "fs";
import path from "path";

let words: Set<string> | null | undefined;

export function dictionary(): ((word: string) => boolean) | undefined {
  if (words === undefined) {
    try {
      const raw = readFileSync(path.join(process.cwd(), "src/content/holidays/wordlist.txt"), "utf8");
      words = new Set(raw.split(/\r?\n/).map((w) => w.trim().toLowerCase()).filter((w) => /^[a-z]{3,}$/.test(w)));
    } catch {
      console.error("[holidays] src/content/holidays/wordlist.txt is missing — Word Grid can't check words.");
      words = null;
    }
  }
  const set = words;
  return set ? (w) => set.has(w) : undefined;
}
