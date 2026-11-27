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
//   - Coffee 02: Toast's guest-facing option groups (milk, temperature, syrup / flavor) show automatically, with friendly
//     names: once under a section's heading when the whole section has them ("Milk options: Whole, Oat" · "Iced or Hot"),
//     otherwise under the item ("Available syrup flavors (+0.50): Madagascar Vanilla, …"). They follow Toast every night.
//     The admin can rename a group's display name or hide a group (per tab).
//   - Coffee 02: display sections. A tab can split a Toast section for the page only (Toast's single "Tea" group shown as
//     "Tea Lattes" / "Hot Tea" / "Iced Tea"): a heading, an optional note and items picked from the feed. An item in a
//     display section shows there instead of in its Toast section (a Toast section left empty is hidden); items not
//     placed in one stay in their Toast section, so a new Toast item never goes missing. Display sections are ordered
//     together with the Toast sections.

export interface FeedPrice { label: string | null; price: number }
/** Coffee 02: a Toast flavor add-on group ("Syrup Flavors"): option names only, one price (null when they differ). */
export interface FeedAddonGroup { name: string; price: number | null; options: string[] }
export interface FeedItem { id: string; name: string; description: string; prices: FeedPrice[]; ordinal: number; addon_groups: FeedAddonGroup[] }
export interface FeedSection { id: string; name: string; group?: string; ordinal: number; items: FeedItem[]; addon_groups?: FeedAddonGroup[] }
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
  /** Coffee 02: Toast option group name → the name guests see ("Milk Option" → "Milk options"); unset = the default. */
  groupLabels?: Record<string, string>;
  /** Coffee 02: Toast option group names not shown on this tab. */
  hiddenGroups?: string[];
  /** Coffee 02: display-only sections on this tab (ids "d_…"), ordered with the Toast sections through `order`. */
  displaySections?: DisplaySection[];
}

/** Coffee 02: a section that exists only on the website, holding items picked from the feed (in the owner's order). */
export interface DisplaySection { id: string; heading: string; note?: string; items: string[] }

export interface TabInput {
  id: string;
  label: string;
  live?: CoffeeLiveConfig | null;
  hasPdf?: boolean;     // has PDF pages or an image to fall back on
}

export interface ShownItem { id: string; name: string; description: string; prices: FeedPrice[]; note: string; flavors: string[] }
export interface ShownSection { id: string; heading: string; note: string; options: string[]; items: ShownItem[]; display?: boolean }
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

/** Coffee 02: the add-on groups the website will show, by name (the Bible applies the same allow-list first). */
export const ADDON_GROUP_ALLOW = /syrup|flavou?r|milk|temperature|\btemp\b|iced or hot/i;

export type GroupKind = "milk" | "temperature" | "flavor" | "other";
export function groupKind(name: string): GroupKind {
  if (/milk/i.test(name)) return "milk";
  if (/temperature|\btemp\b|iced or hot/i.test(name)) return "temperature";
  if (/syrup|flavou?r/i.test(name)) return "flavor";
  return "other";
}
/** The name guests see for a Toast option group, unless the admin set one ("" shows the options with no label). */
export function defaultGroupLabel(name: string): string {
  switch (groupKind(name)) {
    case "milk": return "Milk options";
    case "temperature": return "";
    case "flavor": return "Available syrup flavors";
    default: return name;
  }
}
/**
 * Coffee 02: the line guests see for one option group. Temperature reads "Iced or Hot"; the others
 * "Milk options: Whole, 2%, Oat" / "Available syrup flavors (+0.50): Madagascar Vanilla, Charred Cinnamon".
 */
export function groupLine(g: FeedAddonGroup, label?: string | null): string {
  const custom = typeof label === "string" ? label.replace(/\s+/g, " ").trim() : null;
  const l = custom !== null && custom !== "" ? custom : defaultGroupLabel(g.name);
  const price = g.price ? `+${formatPrice(g.price)}` : "";
  const opts = groupKind(g.name) === "temperature" ? g.options.join(" or ") : g.options.join(", ");
  if (!l) return price ? `${opts} (${price})` : opts;
  return `${l}${price ? ` (${price})` : ""}: ${opts}`;
}

const str = (v: unknown, max: number) => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max) : "");
const idOk = (v: unknown): v is string => typeof v === "string" && /^[a-z]_[0-9a-f]{6,32}$/i.test(v);

function sanitizeGroups(raw: unknown): FeedAddonGroup[] {
  const out: FeedAddonGroup[] = [];
  for (const g of (Array.isArray(raw) ? raw : []).slice(0, 6)) {
    if (!g || typeof g !== "object") continue;
    const go = g as Record<string, unknown>;
    const name = str(go.name, 60);
    if (!name || !ADDON_GROUP_ALLOW.test(name)) continue;
    const options = (Array.isArray(go.options) ? go.options : []).map((o) => str(o, 60)).filter(Boolean).slice(0, 40);
    if (!options.length) continue;
    const price = typeof go.price === "number" && go.price > 0 && go.price < 100 ? Math.round(go.price * 100) / 100 : null;
    out.push({ name, price, options });
  }
  return out;
}

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
      const addon_groups = sanitizeGroups(io.addon_groups);
      items.push({ id: io.id, name: str(io.name, 80), description: str(io.description, 300), prices, ordinal: typeof io.ordinal === "number" ? io.ordinal : items.length, addon_groups });
    }
    sections.push({ id: so.id, name: str(so.name, 80), group: str(so.group, 80) || undefined, ordinal: typeof so.ordinal === "number" ? so.ordinal : sections.length, items, addon_groups: sanitizeGroups(so.addon_groups) });
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
    out.set(t.id, new Set(feed.sections.filter((s) => DEFAULT_SECTION[kind].test(s.name) || (!!s.group && DEFAULT_SECTION[kind].test(s.group))).map((s) => s.id)));
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
  const pick = (id: string, tabId: string) => {
    if (!pickedBy.has(id)) pickedBy.set(id, new Set());
    pickedBy.get(id)!.add(tabId);
  };
  // An item placed in a display section is picked into that tab, like a single picked item.
  for (const t of tabs) {
    for (const id of t.live?.items ?? []) pick(id, t.id);
    for (const d of displaySectionsOf(t.live)) for (const id of d.items) pick(id, t.id);
  }
  const byId = new Map<string, FeedItem>();
  feed.sections.forEach((s) => s.items.forEach((it) => byId.set(it.id, it)));
  const shownAnywhere = new Set<string>();
  const hiddenWhy = new Map<string, string>();

  const composed = tabs.map((t): ComposedTab => {
    const cfg = t.live ?? {};
    const inc = included.get(t.id) ?? new Set<string>();
    const hiddenS = new Set(cfg.hiddenSections ?? []);
    const hiddenI = new Set(cfg.hiddenItems ?? []);
    const displays = displaySectionsOf(cfg);
    const inDisplay = displayItemMap(displays);
    const hiddenG = new Set((cfg.hiddenGroups ?? []).map((n) => n.toLowerCase()));
    const lines = (gs: FeedAddonGroup[] | undefined) => (gs ?? []).filter((g) => !hiddenG.has(g.name.toLowerCase())).map((g) => groupLine(g, cfg.groupLabels?.[g.name]));
    // Items shown outside their Toast section (a display section, or picked into another tab) carry that section's
    // options with them, so "Iced or Hot" never gets lost when an item moves.
    const sectionGroupsOf = new Map<string, FeedAddonGroup[]>();
    feed.sections.forEach((s) => s.items.forEach((it) => sectionGroupsOf.set(it.id, s.addon_groups ?? [])));
    const shownItem = (it: FeedItem, carry: boolean): ShownItem => ({
      id: it.id, name: it.name, description: it.description, prices: it.prices, note: str(cfg.itemNotes?.[it.id], 120),
      flavors: lines([...(carry ? sectionGroupsOf.get(it.id) ?? [] : []), ...(it.addon_groups ?? [])]),
    });
    const sections: ShownSection[] = [];
    for (const b of orderedBlocks(cfg, feed)) {
      // Toast's section: its items on this tab, less those placed in one of this tab's display sections.
      // A display section: its picked items that are still on Toast, in the owner's order.
      const name = b.kind === "toast" ? b.section.name : b.display.heading || "Untitled section";
      const take = b.kind === "toast"
        ? b.section.items.filter((it) => {
          if (inDisplay.has(it.id)) return false;
          const picks = pickedBy.get(it.id);
          if (picks) return picks.has(t.id);
          return inc.has(b.section.id);
        })
        : b.display.items.filter((id) => inDisplay.get(id) === b.id && byId.has(id)).map((id) => byId.get(id)!);
      if (!take.length) continue;
      if (hiddenS.has(b.id)) { take.forEach((it) => hiddenWhy.set(it.id, `its section "${name}" is hidden on the ${t.label} tab`)); continue; }
      const items = take.filter((it) => {
        if (hiddenI.has(it.id)) { hiddenWhy.set(it.id, `hidden on the ${t.label} tab in the website admin`); return false; }
        return true;
      });
      if (!items.length) continue;
      items.forEach((it) => shownAnywhere.add(it.id));
      sections.push(b.kind === "toast"
        ? {
          id: b.id,
          heading: str(cfg.labels?.[b.id], 80) || b.section.name,
          note: typeof cfg.notes?.[b.id] === "string" ? cfg.notes[b.id].trim().slice(0, 300) : "",
          options: lines(b.section.addon_groups),
          items: items.map((it) => shownItem(it, false)),
        }
        : { id: b.id, heading: str(b.display.heading, 80) || "Untitled section", note: (b.display.note ?? "").trim().slice(0, 300), options: [], items: items.map((it) => shownItem(it, true)), display: true });
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

// ── Coffee 02: display sections ──────────────────────────────────────────────

const DISPLAY_ID = /^d_[0-9a-f]{6,32}$/i;
/** A tab's display sections, well-formed only. */
export function displaySectionsOf(cfg: CoffeeLiveConfig | null | undefined): DisplaySection[] {
  const list = Array.isArray(cfg?.displaySections) ? cfg!.displaySections : [];
  return list.filter((d): d is DisplaySection => !!d && typeof d === "object" && DISPLAY_ID.test(String(d.id)) && Array.isArray(d.items));
}
/** Item id → the display section (on this tab) it shows in; the first one wins if it was placed twice. */
export function displayItemMap(displays: DisplaySection[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const d of displays) for (const id of d.items) if (typeof id === "string" && !m.has(id)) m.set(id, d.id);
  return m;
}
/** A new display section id ("d_" + 12 hex). */
export function newDisplayId(): string {
  let h = "";
  for (let i = 0; i < 12; i++) h += Math.floor(Math.random() * 16).toString(16);
  return `d_${h}`;
}

export type Block =
  | { kind: "toast"; id: string; section: FeedSection }
  | { kind: "display"; id: string; display: DisplaySection };

/**
 * Every Toast section and display section of a tab, in the order they show: first the ones the owner ordered, then the
 * rest in Toast's order. An unordered display section sits just after the Toast section its first item comes from (so
 * "Tea Lattes" / "Hot Tea" / "Iced Tea" land where Toast's "Tea" was), in the order they were added.
 */
export function orderedBlocks(cfg: CoffeeLiveConfig | null | undefined, feed: CoffeeFeed): Block[] {
  const order = new Map((cfg?.order ?? []).map((id, i) => [id, i]));
  const sectionOf = new Map<string, FeedSection>();
  feed.sections.forEach((s) => s.items.forEach((it) => sectionOf.set(it.id, s)));
  const keyed: { b: Block; k: number }[] = feed.sections.map((s) => ({ b: { kind: "toast" as const, id: s.id, section: s }, k: order.has(s.id) ? order.get(s.id)! : 1e4 + s.ordinal }));
  displaySectionsOf(cfg).forEach((d, i) => {
    const home = d.items.map((id) => sectionOf.get(id)).find(Boolean);
    const k = order.has(d.id) ? order.get(d.id)! : 1e4 + (home ? home.ordinal : 1e3) + (i + 1) / 1e3;
    keyed.push({ b: { kind: "display", id: d.id, display: d }, k });
  });
  return keyed.sort((a, b) => a.k - b.k).map((x) => x.b);
}
