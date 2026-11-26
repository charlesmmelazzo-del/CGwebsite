/**
 * Toast descriptions for the bar's cocktails are written in parts with blank lines between them: an ingredient
 * line, a "[Flavor, Words]" line, a tagline and a notes paragraph (the order varies a little). The Bible passes the
 * text through unchanged, line breaks included. Each line becomes its own short paragraph; a line that is wholly
 * "[...]" is the flavor line, shown without its brackets.
 */
export type DescriptionPart = { kind: "flavor" | "text"; text: string };

/**
 * Drop formatting marks that sometimes arrive inside plain descriptions (written elsewhere in Markdown): **bold**,
 * __bold__, *emphasis*, a leading "#" heading mark, and a leading "- " or "* " list mark. The words are kept; nothing
 * is ever rendered as HTML.
 */
export function stripMarks(text: string): string {
  return String(text || "")
    .replace(/\*\*([^*\n]+)\*\*/g, "$1")
    .replace(/__([^_\n]+)__/g, "$1")
    .replace(/(^|[\s(])\*([^*\s][^*\n]*?)\*(?=[\s.,;:!?)]|$)/gm, "$1$2")
    .replace(/^\s{0,3}#{1,6}\s+/gm, "")
    .replace(/^\s{0,3}[-*]\s+/gm, "")
    .replace(/\*\*|__/g, "");
}

export function descriptionParts(text: string): DescriptionPart[] {
  const t = stripMarks(String(text || "").replace(/\r\n?/g, "\n")).trim();
  if (!t) return [];
  let lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  // A description whose line breaks were lost before it reached us: split it around its one "[...]" flavor list,
  // only where that list stands between sentences ("…lumbar support. [Toasty, Silky] Brovo Gin, …").
  if (lines.length === 1 && (lines[0].match(/\[[^[\]]+\]/g) || []).length === 1) {
    const m = lines[0].match(/^(.*?)\s*\[([^[\]]+)\]\s*(.*)$/);
    if (m && (m[1] || m[3]) && (!m[1] || /[.!?…"”)]$/.test(m[1]))) lines = [m[1], `[${m[2]}]`, m[3]].map((l) => l.trim()).filter(Boolean);
  }
  return lines
    .map((l): DescriptionPart => {
      const f = l.match(/^\[([^[\]]*)\]$/);
      return f ? { kind: "flavor", text: f[1].trim() } : { kind: "text", text: l };
    })
    .filter((p) => p.text);
}

/** A flavor line the library may store with its brackets, shown without them. */
export const bareFlavor = (s: string) => String(s || "").trim().replace(/^\[(.*)\]$/, "$1").trim();

/**
 * What a Menu tab item shows under its name: the matched cocktail's card (tagline, ingredients, flavor line) when the
 * Bible sent one, else the item's own Toast description laid out by line. The Bible sends a card only when the Toast
 * item is that cocktail by name, so a variant ("Pear Thee Well - Free Spirited") shows its own description.
 */
export type MenuItemBody =
  | { kind: "card"; tagline: string; ingredients: string; flavor: string }
  | { kind: "description"; parts: DescriptionPart[] }
  | { kind: "none" };
export function menuItemBody(it: { name?: string; description?: string; card?: { tagline?: string; ingredients?: string; flavor?: string } }): MenuItemBody {
  const c = it.card;
  if (c && (c.tagline || c.ingredients || bareFlavor(c.flavor || ""))) {
    return { kind: "card", tagline: c.tagline || "", ingredients: c.ingredients || "", flavor: bareFlavor(c.flavor || "") };
  }
  const parts = descriptionParts(it.description || "");
  return parts.length ? { kind: "description", parts } : { kind: "none" };
}
