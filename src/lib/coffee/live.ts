// Coffee 01: the coffee page's tabs, built from the Bible's guest-safe Toast "Coffee Shop" feed
// (GET <BIBLE_API_URL>/api/public/coffee-menu) and what the owner set for each tab in the website admin.
//
// Pure (no server-only code) so the admin, the page, the public JSON route and the tests share one rule.
//
// The rule, per tab:
//   - Sections: the ones chosen in admin, or by default from the tab's name: a "Food" tab takes the Food sections, a
//     "Limited" / "LTD" tab takes a section named like "Limited" / "LTD", and the first other tab takes every section
//     no other tab took.
//   - Single items can be picked into a tab from any section. A picked item shows only on the tab(s) that picked it,
//     so picking "Ain't You Just A Peach" into Limited Time Lattes takes it off the Coffee Menu without touching Toast.
//   - A section can be renamed, given a note line under its heading, hidden, or moved; an item can be hidden or given a
//     note line (e.g. "Add any latte flavor +0.50"). Never modifiers.

export interface FeedPrice { label: string | null; price: number }
export interface FeedItem { id: string; name: string; description: string; prices: FeedPrice[]; ordinal: number }
export interface FeedSection { id: string; name: string; ordinal: number; items: FeedItem[] }
export interface CoffeeFeed { updated_at: string | null; menu_read_at: string | null; sections: FeedSection[] }

/** What the owner sets for one tab (stored on coffee_menus.live). Every field is optional. */
export interface CoffeeLiveConfig {
  /** true: show the tab's PDF (or image) instead. false: always the live menu. Unset: live once it has items. */
  showPdf?: boolean;
  /** Section ids on this tab; unset = by the tab's name (see above). */
  sections?: string[] | null;
  /** Single items picked into this tab. */
  items?: string[];
  /** Section ids in the order they show; others follow in Toast's order. */
  order?: string[];
  /** Section id → heading shown instead of Toast's name. */
  labels?: Record<string, string>;
  /** Section id → note line(s) under the heading. */
  notes?: Record<string, string>;
  hiddenSections?: string[];
  hiddenItems?: string[];
  /** Item id → note line under the item. */
  itemNotes?: Record<string, string>;
}

export interface TabInput {
  id: string;
  label: string;
  live?: CoffeeLiveConfig | null;
  hasPdf?: boolean;     // has PDF pages or an image to fall back on
}

export interface ShownItem { id: string; name: string; description: string; prices: FeedPrice[]; note: string }
export interface ShownSection { id: string; heading: string; note: string; items: ShownItem[] }
export type Showing = "live" | "pdf" | "empty";
export interface ComposedTab { id: string; label: string; showing: Showing; sections: ShownSection[]; itemCount: number }
export interface NotShown { id: string; name: string; section: string; reason: string }

export type TabKind = "food" | "limited" | "coffee";
export function tabKind(label: string): TabKind {
  if (/food|pastr|bakery|kitchen/i.test(label)) return "food";
  if (/limited|\bltd\b|seasonal/i.test(label)) return "limited";
  return "coffee";
}
const DEFAULT_SECTION: Record<Exclude<TabKind, "coffee">, RegExp> = {
  food: /food|pastr|bakery|baked|snack|bites/i,
  limited: /limited|\bltd\b/i,
};

/** "6.00": two decimals, no dollar sign. */
export function formatPrice(n: number): string {
  return (Math.round(Number(n) * 100) / 100).toFixed(2);
}
/** One line for an item's prices: "6.00", or "12 oz 3.00 / 16 oz 3.50". */
export function priceLine(prices: FeedPrice[]): string {
  return prices.map((p) => (p.label ? `${p.label} ${formatPrice(p.price)}` : formatPrice(p.price))).join(" / ");
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const idOk = (v: unknown): v is string => typeof v === "string" && /^[a-z]_[0-9a-f]{6,32}$/i.test(v);

/** Keep only well-formed, guest-safe fields from whatever the Bible sent (null when it isn't a feed at all). */
export function sanitizeFeed(raw: unknown): CoffeeFeed | null {
  if (!raw || typeof raw !== "object" || !Array.isArray((raw as CoffeeFeed).sections)) return null;
  const r = raw as Record<string, unknown>;
  const sections: FeedSection[] = [];
  for (const s of (r.sections as unknown[]).slice(0, 100)) {
    if (!s || typeof s !== "object") continue;
    const so = s as Record<string, unknown>;
    if (!idOk(so.id) || !str(so.name, 80)) continue;
    const items: FeedItem[] = [];
    for (const it of (Array.isArray(so.items) ? so.items : []).slice(0, 300)) {
      if (!it || typeof it !== "object") continue;
      const io = it as Record<string, unknown>;
      if (!idOk(io.id) || !str(io.name, 80)) continue;
      const prices = (Array.isArray(io.prices) ? io.prices : [])
        .filter((p): p is { label?: unknown; price: number } => !!p && typeof p === "object" && typeof (p as { price?: unknown }).price === "number" && (p as { price: number }).price > 0 && (p as { price: number }).price < 10000)
        .slice(0, 6)
        .map((p) => ({ label: str(p.label, 30) || null, price: Math.round(p.price * 100) / 100 }));
      if (!prices.length) continue;
      items.push({ id: io.id, name: str(io.name, 80), description: str(io.description, 300), prices, ordinal: typeof io.ordinal === "number" ? io.ordinal : items.length });
    }
    sections.push({ id: so.id, name: str(so.name, 80), ordinal: typeof so.ordinal === "number" ? so.ordinal : sections.length, items });
  }
  const at = (v: unknown) => (typeof v === "string" && !Number.isNaN(Date.parse(v)) ? v : null);
  return { updated_at: at(r.updated_at), menu_read_at: at(r.menu_read_at), sections };
}

/** The sections each tab takes (before hiding), by the rule above. */
export function sectionsByTab(tabs: TabInput[], feed: CoffeeFeed): Map<string, Set<string>> {
  const all = feed.sections.map((s) => s.id);
  const known = new Set(all);
  const out = new Map<string, Set<string>>();
  let restTab: string | null = null;
  for (const t of tabs) {
    const chosen = t.live?.sections;
    if (Array.isArray(chosen)) { out.set(t.id, new Set(chosen.filter((id) => known.has(id)))); continue; }
    const kind = tabKind(t.label);
    if (kind === "coffee") {
      out.set(t.id, new Set());
      if (!restTab) restTab = t.id;
      continue;
    }
    out.set(t.id, new Set(feed.sections.filter((s) => DEFAULT_SECTION[kind].test(s.name)).map((s) => s.id)));
  }
  if (restTab) {
    const taken = new Set<string>();
    out.forEach((set, id) => { if (id !== restTab) set.forEach((s) => taken.add(s)); });
    out.set(restTab, new Set(all.filter((id) => !taken.has(id))));
  }
  return out;
}

/** Build every tab from the feed (null feed: no live menu at all, so a tab shows its PDF when it has one). */
export function composeTabs(tabs: TabInput[], feed: CoffeeFeed | null): { tabs: ComposedTab[]; notShown: NotShown[] } {
  if (!feed) {
    return {
      tabs: tabs.map((t) => ({ id: t.id, label: t.label, showing: (t.hasPdf ? "pdf" : "empty") as Showing, sections: [], itemCount: 0 })),
      notShown: [],
    };
  }
  const included = sectionsByTab(tabs, feed);
  const pickedBy = new Map<string, Set<string>>();
  for (const t of tabs) for (const id of t.live?.items ?? []) {
    if (!pickedBy.has(id)) pickedBy.set(id, new Set());
    pickedBy.get(id)!.add(t.id);
  }
  const shownAnywhere = new Set<string>();
  const hiddenWhy = new Map<string, string>();

  const composed = tabs.map((t): ComposedTab => {
    const cfg = t.live ?? {};
    const inc = included.get(t.id) ?? new Set<string>();
    const hiddenS = new Set(cfg.hiddenSections ?? []);
    const hiddenI = new Set(cfg.hiddenItems ?? []);
    const order = new Map((cfg.order ?? []).map((id, i) => [id, i]));
    const sorted = [...feed.sections].sort((a, b) =>
      (order.has(a.id) ? order.get(a.id)! : 1e4 + a.ordinal) - (order.has(b.id) ? order.get(b.id)! : 1e4 + b.ordinal));
    const sections: ShownSection[] = [];
    for (const s of sorted) {
      const take = s.items.filter((it) => {
        const picks = pickedBy.get(it.id);
        if (picks) return picks.has(t.id);
        return inc.has(s.id);
      });
      if (!take.length) continue;
      if (hiddenS.has(s.id)) { take.forEach((it) => hiddenWhy.set(it.id, `its section "${s.name}" is hidden on the ${t.label} tab`)); continue; }
      const items = take.filter((it) => {
        if (hiddenI.has(it.id)) { hiddenWhy.set(it.id, `hidden on the ${t.label} tab in the website admin`); return false; }
        return true;
      });
      if (!items.length) continue;
      items.forEach((it) => shownAnywhere.add(it.id));
      sections.push({
        id: s.id,
        heading: str(cfg.labels?.[s.id], 80) || s.name,
        note: typeof cfg.notes?.[s.id] === "string" ? cfg.notes[s.id].trim().slice(0, 300) : "",
        items: items.map((it) => ({ id: it.id, name: it.name, description: it.description, prices: it.prices, note: str(cfg.itemNotes?.[it.id], 120) })),
      });
    }
    const itemCount = sections.reduce((n, s) => n + s.items.length, 0);
    let showing: Showing;
    if (cfg.showPdf === true) showing = t.hasPdf ? "pdf" : itemCount ? "live" : "empty";
    else if (cfg.showPdf === false) showing = itemCount ? "live" : "empty";
    else showing = itemCount ? "live" : t.hasPdf ? "pdf" : "empty";
    return { id: t.id, label: t.label, showing, sections: showing === "live" ? sections : [], itemCount: showing === "live" ? itemCount : 0 };
  });

  // Items guests can't see on any live tab, with the reason in plain words (for the rundown check).
  const liveShown = new Set<string>();
  composed.forEach((t) => t.sections.forEach((s) => s.items.forEach((it) => liveShown.add(it.id))));
  const notShown: NotShown[] = [];
  for (const s of feed.sections) for (const it of s.items) {
    if (liveShown.has(it.id)) continue;
    let reason = hiddenWhy.get(it.id) ?? "";
    if (!reason && shownAnywhere.has(it.id)) reason = "its tab is showing the PDF instead";
    if (!reason) {
      const picks = pickedBy.get(it.id);
      reason = picks ? "picked into a tab that isn't showing" : `its section "${s.name}" isn't on any tab`;
    }
    notShown.push({ id: it.id, name: it.name, section: s.name, reason });
  }
  return { tabs: composed, notShown };
}
