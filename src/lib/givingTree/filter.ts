// ─── Moderation filter (7) ───────────────────────────────────────────────────
//
// Display names and notes appear on the tree, in the sky and on the wall at
// the bar. Anything that trips this goes to a moderation hold: the guest sees
// the normal success screen, and the pledge stays private until approved.
//
// The offensive-word list is the one Home for the Holidays maintains for player
// names (src/lib/holidays/nameFilter.ts), so there is one list to keep up to date.

import { isOffensiveName } from "@/lib/holidays/nameFilter";

const LINK = /(https?:\/\/|www\.|\b[a-z0-9-]+\.(com|net|org|io|co|us|me|info|biz|xyz|ly|gg|tv|app|link|site|online|shop)\b)/i;
const EMAIL = /[a-z0-9._%+-]+\s*(@|\(at\)|\[at\])\s*[a-z0-9.-]+\.[a-z]{2,}/i;
const HANDLE = /(^|\s)@[a-z0-9_.]{3,}/i;

/** Seven or more digits, allowing the usual separators: a phone number. */
function hasPhone(s: string): boolean {
  const runs = s.match(/[+(]?\d[\d\s().-]{5,}\d/g) ?? [];
  return runs.some((r) => r.replace(/\D/g, "").length >= 7);
}

/** True when the text should be held for a person to look at. */
export function needsModeration(text: string | null | undefined, opts: { contactInfo: boolean }): boolean {
  const t = (text ?? "").trim();
  if (!t) return false;
  const words = t.split(/\s+/).filter(Boolean);
  // Short text (a name): check it whole, which also catches "f u c k".
  if (words.length <= 4 && isOffensiveName(t)) return true;
  // Longer text (a note): squashing the whole thing would join innocent
  // neighbours into false matches ("this hit"), so check each word and each
  // pair of neighbours instead.
  for (let i = 0; i < words.length; i++) {
    if (isOffensiveName(words[i])) return true;
    if (i + 1 < words.length && words[i].length <= 3 && isOffensiveName(`${words[i]} ${words[i + 1]}`)) return true;
  }
  if (opts.contactInfo && (LINK.test(t) || EMAIL.test(t) || HANDLE.test(t) || hasPhone(t))) return true;
  return false;
}

export function pledgeNeedsModeration(displayName: string | null, note: string | null): boolean {
  return needsModeration(displayName, { contactInfo: true }) || needsModeration(note, { contactInfo: true });
}
