/**
 * File 14: nested navigation. Plain functions (no React, no server-only code) that turn the data the Menu and Index
 * tabs already have into short screens that drill down, like an iPod's menus: every screen is a short set of choices,
 * except a final list the member deliberately opened (one group of a menu, one category, one producer, one letter),
 * and those are compact rows. Nothing here asks the Bible for anything: every level is built from the one answer the
 * tab already loaded. The tests (__tests__/passport.test.ts) check the rules on these models, not on pixels.
 */
import type { Album, BaseSpirit, Chart, HouseList, IndexBottle, IndexCocktail, IndexDrink, ItemKind, MenuGroup, MenuItem, MenuTabDef, PassportList, Recommendation, ToastMenu, VoteCard } from "./types";
import type { SectionId } from "./accents";

/** About a dozen rows before the member has chosen something. */
export const ROW_LIMIT = 12;
/** A spirits category with more bottles than this opens by producer first. */
export const PRODUCER_THRESHOLD = 40;
/** A grid of tiles is two to a row on a phone. */
export const TILE_COLUMNS = 2;

// ── Covers ───────────────────────────────────────────────────────────────────
/** A photo to show for a place: the bar's photo of one of its own items. */
export interface Cover { kind: ItemKind; id: number; photo: string; name: string }
interface Pictured { id: number | null; name: string; photo?: string | null; cover?: boolean }
/** The admin's "Use as cover" first, otherwise the first item that has a photo; null when none does. */
export function coverOf(items: Pictured[], kind: ItemKind | ((x: Pictured) => ItemKind)): Cover | null {
  const k = (x: Pictured) => (typeof kind === "function" ? kind(x) : kind);
  const pick = items.find((x) => x.cover && x.photo && x.id) || items.find((x) => x.photo && x.id);
  return pick && pick.photo && pick.id ? { kind: k(pick), id: pick.id, photo: pick.photo, name: pick.name } : null;
}
const menuItemCover = (items: MenuItem[]): Cover | null =>
  coverOf(items.map((it) => ({ id: it.cocktail_id || it.bottle_id, name: it.name, photo: it.photo, cover: it.cover, k: it.cocktail_id ? "cocktail" : "bottle" })) as (Pictured & { k: ItemKind })[], (x) => (x as Pictured & { k: ItemKind }).k);

/** The two letters of a monogram tile for a place with no photo anywhere inside it. */
export function monogram(label: string): string {
  const words = label.replace(/[^A-Za-z0-9& ]/g, " ").split(/\s+/).filter((w) => w && !/^(the|and|of|&)$/i.test(w));
  if (!words.length) return "CG";
  return (words.length === 1 ? words[0].slice(0, 2) : words[0][0] + words[1][0]).toUpperCase().replace(/^(.)(.)$/, (_m, a: string, b: string) => a + b.toLowerCase());
}

// ── The Menu tab ─────────────────────────────────────────────────────────────
export type MenuTabKind = "exclusives" | "menu" | "spirits";
export interface MenuTabModel { id: string; label: string; kind: MenuTabKind; groups: MenuGroup[]; chips: boolean; cover: Cover | null; section: SectionId }
export interface MenuInput { exclusives: { id: number; name: string; photo?: string | null }[]; menus: ToastMenu[]; tabs?: MenuTabDef[]; spirits: ToastMenu | null; available: boolean }
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "tab";
export const SPIRITS_TAB = "spirits";
export const EXCLUSIVES_TAB = "exclusives";
const sectionOfMenu = (label: string, groups: MenuGroup[]): SectionId =>
  /beer|wine|cider|sake|bubbl/i.test(`${label} ${groups.map((g) => g.name).join(" ")}`) && !/cocktail/i.test(label) ? "beer-wine" : "cocktails";

/**
 * The Menu tab's tabs: "Exclusives" first when there are any; then the ticked Toast menus in the admin's order (a
 * "groups as tabs" menu gives one tab per group and its own name appears nowhere; a "one tab" menu is one tab under
 * its own name, with its groups as sub-headings, or a row of chips when it has more than three); "Spirits" last.
 */
export function menuTabs(d: MenuInput): MenuTabModel[] {
  const out: MenuTabModel[] = [];
  const used = new Set<string>();
  const idFor = (label: string) => { let id = slug(label); let n = 2; while (used.has(id) || id === SPIRITS_TAB || id === EXCLUSIVES_TAB) id = `${slug(label)}-${n++}`; used.add(id); return id; };
  if (d.exclusives.length) out.push({ id: EXCLUSIVES_TAB, label: "Exclusives", kind: "exclusives", groups: [], chips: false, cover: coverOf(d.exclusives, "cocktail"), section: "cocktails" });
  if (d.available) {
    // An older Bible sends no tabs: each menu is one tab under its own name (as the Menu tab showed them before).
    const defs: MenuTabDef[] = d.tabs ?? d.menus.map((_m, i) => ({ label: d.menus[i].name, menu: i, groups: null }));
    for (const t of defs) {
      const m = d.menus[t.menu];
      if (!m) continue;
      const groups = (t.groups === null ? m.groups : t.groups.map((g) => m.groups[g]).filter(Boolean)).filter((g) => g.items.length);
      if (!groups.length || !t.label) continue;
      out.push({ id: idFor(t.label), label: t.label, kind: "menu", groups, chips: t.groups === null && groups.length > 3, cover: menuItemCover(groups.flatMap((g) => g.items)), section: sectionOfMenu(t.label, groups) });
    }
  }
  if (d.spirits && d.spirits.groups.some((g) => g.items.length)) {
    const items = d.spirits.groups.flatMap((g) => g.items);
    out.push({ id: SPIRITS_TAB, label: "Spirits", kind: "spirits", groups: d.spirits.groups, chips: false, cover: menuItemCover(items), section: "spirits" });
  }
  return out;
}
/** The tab an address asks for (?tab= or the old #spirits), else the remembered one, else the first. */
export function chosenTab(tabs: MenuTabModel[], asked: string | null | undefined, remembered: string | null | undefined): string | null {
  for (const want of [asked, remembered]) if (want && tabs.some((t) => t.id === want)) return want;
  return tabs[0]?.id ?? null;
}

// ── Spirits, the same drill-down on the Menu tab and in the Index ─────────────
/** One bottle in a spirits drill-down (from the spirits list or from the Index). */
export interface SpiritEntry { id: number | null; name: string; category: string; producer: string; out: boolean; photo?: string | null; cover?: boolean }
export interface CountTile { name: string; count: number; cover: Cover | null }
const OTHER_PRODUCER = "Other producers";
const producerOf = (x: SpiritEntry) => x.producer.trim() || OTHER_PRODUCER;
/** "Out right now" sinks to the bottom of its list (kept in the list's own order otherwise). */
export const outLast = <T extends { out: boolean }>(xs: T[]): T[] => [...xs.filter((x) => !x.out), ...xs.filter((x) => x.out)];
/** The category tiles, in the list's own order, each with its count and a cover photo if any bottle in it has one. */
export function spiritCategories(items: SpiritEntry[]): CountTile[] {
  const at = new Map<string, SpiritEntry[]>();
  for (const x of items) { const k = x.category || "Other"; if (!at.has(k)) at.set(k, []); at.get(k)!.push(x); }
  return Array.from(at.entries()).map(([name, xs]) => ({ name, count: xs.length, cover: coverOf(xs, "bottle") }));
}
export type SpiritLevel =
  | { kind: "producers"; category: string; producers: CountTile[] }
  | { kind: "bottles"; category: string; producer: string | null; items: SpiritEntry[] }
  | { kind: "missing" };
/** One category: its bottles, or (more than 40) its producers first; or one producer's bottles in it. */
export function spiritLevel(items: SpiritEntry[], category: string, producer?: string | null): SpiritLevel {
  const inCat = items.filter((x) => (x.category || "Other") === category);
  if (!inCat.length) return { kind: "missing" };
  if (producer) {
    const mine = inCat.filter((x) => producerOf(x) === producer);
    return mine.length ? { kind: "bottles", category, producer, items: outLast(mine) } : { kind: "missing" };
  }
  if (inCat.length > PRODUCER_THRESHOLD) {
    const by = new Map<string, SpiritEntry[]>();
    for (const x of inCat) { const p = producerOf(x); if (!by.has(p)) by.set(p, []); by.get(p)!.push(x); }
    const producers = Array.from(by.entries()).map(([name, xs]) => ({ name, count: xs.length, cover: coverOf(xs, "bottle") }))
      .sort((a, b) => (a.name === OTHER_PRODUCER ? 1 : b.name === OTHER_PRODUCER ? -1 : a.name.localeCompare(b.name)));
    return { kind: "producers", category, producers };
  }
  return { kind: "bottles", category, producer: null, items: outLast(inCat) };
}
/** The spirits list (Menu tab) as drill-down entries. */
export const spiritsFromMenu = (groups: MenuGroup[]): (SpiritEntry & { item: MenuItem })[] =>
  groups.flatMap((g) => g.items.map((it) => ({ id: it.bottle_id, name: it.name, category: g.name, producer: it.producer || "", out: it.unavailable, photo: it.photo, cover: it.cover, item: it })));
/** The Index's bottles as drill-down entries; "Pouring now" keeps only bottles on the spirits list. */
export const spiritsFromIndex = (bottles: IndexBottle[], everything: boolean): (SpiritEntry & { bottle: IndexBottle })[] =>
  bottles.filter((b) => everything || b.on_list || b.available)
    .map((b) => ({ id: b.id, name: b.name, category: b.category, producer: b.producer || "", out: !b.available && (b.on_list || b.status_label === "Out right now"), photo: b.photo, cover: b.cover, bottle: b }));

// ── Index addresses ──────────────────────────────────────────────────────────
export const INDEX_HREF = "/passport/library";
/** A level's address: /passport/library?at=cocktails/spirit/mezcal (each step encoded, so any name is safe). */
export function indexHref(path: string[]): string {
  if (!path.length) return INDEX_HREF;
  return `${INDEX_HREF}?at=${encodeURIComponent(path.map((p) => encodeURIComponent(p)).join("/"))}`;
}
/** Read ?at= back into its steps. */
export function parseAt(at: string | null | undefined): string[] {
  if (!at) return [];
  return at.split("/").filter(Boolean).slice(0, 4).map((p) => { try { return decodeURIComponent(p); } catch { return p; } });
}
const HASHES: Record<string, string[]> = { lists: ["lists"], "from-common-good": ["cg"], yours: ["yours"], cocktails: ["cocktails"], spirits: ["spirits"], "beer-wine": ["beer-wine"] };
/**
 * Every Index address, old and new, to its level: ?at= (file 14), ?spirit= (an old Library filter link → By spirit),
 * and the old jump links (#lists, #yours, …). ?q= stays a search (the search box fills, on top of the level).
 */
export function indexPathOf(params: { get(name: string): string | null } | null | undefined, hash = ""): string[] {
  const at = params?.get("at");
  if (at) return parseAt(at);
  const spirit = (params?.get("spirit") || "").slice(0, 40);
  if (spirit) return ["cocktails", "spirit", spirit];
  return HASHES[hash.replace(/^#/, "")] ?? [];
}

// ── The Index tree ───────────────────────────────────────────────────────────
export interface IndexInput {
  cocktails: IndexCocktail[]; bottles: IndexBottle[]; drinks: IndexDrink[]; base_spirits: BaseSpirit[]; albums?: Album[];
  lists?: PassportList[]; house_lists?: HouseList[]; charts?: Chart[]; past_count?: number; votes?: VoteCard[]; past_votes_count?: number;
  recommendations?: Recommendation[];
}
export interface Tile { id: string; label: string; count?: number; line?: string; cover: Cover | null; href: string; section: SectionId }
export interface Crumb { label: string; href: string }
interface LevelBase { title: string; trail: Crumb[]; section: SectionId | null; path: string[] }
export type IndexLevel = LevelBase & (
  | { kind: "tiles"; tiles: Tile[]; note?: string }
  | { kind: "letters"; letters: { letter: string; count: number; href: string }[] }
  | { kind: "cocktails"; items: IndexCocktail[] }
  | { kind: "bottles"; items: (SpiritEntry & { bottle: IndexBottle })[] }
  | { kind: "producers"; producers: (CountTile & { href: string })[] }
  | { kind: "drinks"; items: IndexDrink[] }
  | { kind: "lists" }
  | { kind: "house"; lists: HouseList[] }
  | { kind: "charts"; charts: Chart[] }
  | { kind: "votes"; votes: VoteCard[] }
  | { kind: "for-you" }
  | { kind: "missing" }
);
/** Kinds that are a final list the member deliberately opened (compact rows, any length). */
export const FINAL_KINDS = new Set(["cocktails", "bottles", "producers", "drinks", "lists", "house", "charts", "votes", "for-you"]);

export const NOW_ALBUM = "On the menu now";
const DRINK_KINDS: { id: string; kind: IndexDrink["kind"]; label: string }[] = [
  { id: "beer", kind: "Beer", label: "Beer" }, { id: "wine", kind: "Wine", label: "Wine" }, { id: "other", kind: "Other", label: "Cider and more" },
];
/** The first letter a cocktail is filed under (A–Z; anything else under #). */
export const letterOf = (name: string) => { const c = name.trim().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/^(the|a)\s+/i, "").charAt(0).toUpperCase(); return /[A-Z]/.test(c) ? c : "#"; };
const byName = <T extends { name: string }>(xs: T[]) => [...xs].sort((a, b) => a.name.localeCompare(b.name));
const houseKinds = (lists: HouseList[]) => ({
  house: lists.filter((l) => !l.staff_pick && l.price == null),
  staff: lists.filter((l) => l.staff_pick),
  flights: lists.filter((l) => l.price != null && !l.staff_pick),
});
export const PAST_LISTS_HREF = "/passport/house/past";
export const PAST_VOTES_HREF = "/passport/votes/past";

/** The top level's six tiles (each only when it has something, except Lists and Yours, which always do). */
function topTiles(d: IndexInput, everything: boolean): Tile[] {
  const spirits = spiritsFromIndex(d.bottles, everything);
  const fcg = cgTiles(d);
  const tiles: Tile[] = [];
  if (d.cocktails.length) tiles.push({ id: "cocktails", label: "Cocktails", count: d.cocktails.length, cover: coverOf(d.cocktails, "cocktail"), href: indexHref(["cocktails"]), section: "cocktails" });
  if (d.bottles.length) tiles.push({ id: "spirits", label: "Spirits", count: spirits.length || d.bottles.length, cover: coverOf(d.bottles, "bottle"), href: indexHref(["spirits"]), section: "spirits" });
  if (d.drinks.length) tiles.push({ id: "beer-wine", label: "Beer & wine", count: d.drinks.length, cover: null, href: indexHref(["beer-wine"]), section: "beer-wine" });
  tiles.push({ id: "lists", label: "Lists", count: d.lists?.length ?? 0, line: "Your own lists", cover: null, href: indexHref(["lists"]), section: "yours" });
  if (fcg.length) tiles.push({ id: "cg", label: "From Common Good", line: "House lists, picks and votes", cover: null, href: indexHref(["cg"]), section: "bar" });
  tiles.push({ id: "yours", label: "Yours", line: "Favorites, notes, history", cover: null, href: indexHref(["yours"]), section: "yours" });
  return tiles;
}
function cgTiles(d: IndexInput): Tile[] {
  const k = houseKinds(d.house_lists || []);
  const t = (id: string, label: string, count: number, href = indexHref(["cg", id])): Tile => ({ id, label, count, cover: null, href, section: "bar" });
  return [
    k.house.length ? t("house", "House lists", k.house.length) : null,
    k.staff.length ? t("staff", "Staff picks", k.staff.length) : null,
    k.flights.length ? t("flights", "Flights", k.flights.length) : null,
    d.charts?.length ? t("charts", "Charts", d.charts.length) : null,
    d.votes?.length ? t("votes", "Votes and brackets", d.votes.length) : null,
    d.past_count ? t("past", "Past lists", d.past_count, PAST_LISTS_HREF) : null,
    d.past_votes_count ? t("past-votes", "Past votes", d.past_votes_count, PAST_VOTES_HREF) : null,
  ].filter(Boolean) as Tile[];
}
export const YOURS_PAGES = [
  { id: "for-you", label: "For you", line: "Suggestions from your own picks", href: indexHref(["yours", "for-you"]) },
  { id: "favorites", label: "Favorites", line: "What you love, and your ratings", href: "/passport/favorites" },
  { id: "bespoke", label: "My Cocktails", line: "Drinks made for you, and your own", href: "/passport/bespoke" },
  { id: "notes", label: "Notes", line: "Your tasting notes", href: "/passport/notes" },
  { id: "history", label: "History", line: "What you've ordered", href: "/passport/history" },
  { id: "photos", label: "My photos", line: "Only for you and our team", href: "/passport/photos" },
];

/** The cocktails of one album ("On the menu now" or a library menu), A to Z. */
export function albumCocktails(cocktails: IndexCocktail[], album: string): IndexCocktail[] {
  return byName(album === NOW_ALBUM ? cocktails.filter((c) => c.menu_status === "current") : cocktails.filter((c) => (c.menus || [c.menu_name]).includes(album)));
}
/** "By menu": "On the menu now" first, then each album newest first, each with its count and cover. */
export function albumTiles(d: IndexInput): Tile[] {
  const now = albumCocktails(d.cocktails, NOW_ALBUM);
  const names = d.albums?.length ? d.albums.map((a) => a.name) : Array.from(new Set(d.cocktails.map((c) => c.menu_name)));
  const tiles: Tile[] = [];
  if (now.length) tiles.push({ id: NOW_ALBUM, label: NOW_ALBUM, count: now.length, cover: coverOf(now, "cocktail"), href: indexHref(["cocktails", "menu", NOW_ALBUM]), section: "cocktails" });
  for (const name of names) {
    const xs = albumCocktails(d.cocktails, name);
    if (xs.length) tiles.push({ id: name, label: name, count: xs.length, cover: coverOf(xs, "cocktail"), href: indexHref(["cocktails", "menu", name]), section: "cocktails" });
  }
  return tiles;
}

/** One level of the Index, from the Index's one answer. Unknown addresses say so (and offer the way back). */
export function indexLevel(d: IndexInput, path: string[], { everything = false }: { everything?: boolean } = {}): IndexLevel {
  const crumbs: Crumb[] = [{ label: "Index", href: INDEX_HREF }];
  const at = (n: number, label: string) => { crumbs.push({ label, href: indexHref(path.slice(0, n)) }); return crumbs.slice(); };
  const base = (title: string, section: SectionId | null): LevelBase => ({ title, trail: crumbs.slice(), section, path });
  const missing = (): IndexLevel => ({ ...base("Not here any more", null), kind: "missing" });
  const [a, b, c] = path;
  if (!a) return { ...base("Index", null), kind: "tiles", tiles: topTiles(d, everything) };
  if (a === "cocktails") {
    at(1, "Cocktails");
    if (!b) {
      const now = d.cocktails.filter((x) => x.available).length;
      const albums = albumTiles(d);
      const letters = new Set(d.cocktails.map((x) => letterOf(x.name))).size;
      const tiles: Tile[] = [
        { id: "menu", label: "By menu", count: albums.length, line: "Each season, newest first", cover: albums[0]?.cover ?? null, href: indexHref(["cocktails", "menu"]), section: "cocktails" },
        ...(d.base_spirits.length ? [{ id: "spirit", label: "By spirit", count: d.base_spirits.length, line: "Gin, mezcal, whiskey…", cover: null, href: indexHref(["cocktails", "spirit"]), section: "cocktails" as SectionId }] : []),
        { id: "az", label: "A to Z", count: letters, line: "By first letter", cover: null, href: indexHref(["cocktails", "az"]), section: "cocktails" },
        ...(now ? [{ id: "now", label: "Available now", count: now, line: "Being served right now", cover: coverOf(d.cocktails.filter((x) => x.available), "cocktail"), href: indexHref(["cocktails", "now"]), section: "cocktails" as SectionId }] : []),
      ];
      return { ...base("Cocktails", "cocktails"), kind: "tiles", tiles };
    }
    if (b === "menu") {
      at(2, "By menu");
      if (!c) return { ...base("By menu", "cocktails"), kind: "tiles", tiles: albumTiles(d) };
      const items = albumCocktails(d.cocktails, c);
      if (!items.length) return missing();
      at(3, c);
      return { ...base(c, "cocktails"), kind: "cocktails", items };
    }
    if (b === "spirit") {
      at(2, "By spirit");
      if (!c) {
        const tiles = d.base_spirits.map((s) => {
          const xs = d.cocktails.filter((x) => x.spirits?.includes(s.key));
          return { id: s.key, label: s.label, count: xs.length || s.count, cover: coverOf(xs, "cocktail"), href: indexHref(["cocktails", "spirit", s.key]), section: "cocktails" as SectionId };
        });
        return { ...base("By spirit", "cocktails"), kind: "tiles", tiles };
      }
      const s = d.base_spirits.find((x) => x.key === c);
      if (!s) return missing();
      at(3, s.label);
      return { ...base(s.label, "cocktails"), kind: "cocktails", items: byName(d.cocktails.filter((x) => x.spirits?.includes(s.key))) };
    }
    if (b === "az") {
      at(2, "A to Z");
      const counts = new Map<string, number>();
      for (const x of d.cocktails) counts.set(letterOf(x.name), (counts.get(letterOf(x.name)) || 0) + 1);
      if (!c) {
        const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ#".split("").filter((l) => counts.has(l)).map((l) => ({ letter: l, count: counts.get(l)!, href: indexHref(["cocktails", "az", l]) }));
        return { ...base("A to Z", "cocktails"), kind: "letters", letters };
      }
      const L = c.toUpperCase();
      if (!counts.has(L)) return missing();
      at(3, L);
      return { ...base(L, "cocktails"), kind: "cocktails", items: byName(d.cocktails.filter((x) => letterOf(x.name) === L)) };
    }
    if (b === "now") {
      at(2, "Available now");
      return { ...base("Available now", "cocktails"), kind: "cocktails", items: byName(d.cocktails.filter((x) => x.available)) };
    }
    return missing();
  }
  if (a === "spirits") {
    at(1, "Spirits");
    const entries = spiritsFromIndex(d.bottles, everything);
    if (!b) return { ...base("Spirits", "spirits"), kind: "tiles", tiles: spiritCategories(entries).map((t) => ({ id: t.name, label: t.name, count: t.count, cover: t.cover, href: indexHref(["spirits", t.name]), section: "spirits" as SectionId })) };
    const lvl = spiritLevel(entries, b, c);
    if (lvl.kind === "missing") return missing();
    at(2, b);
    if (lvl.kind === "producers") return { ...base(b, "spirits"), kind: "producers", producers: lvl.producers.map((p) => ({ ...p, href: indexHref(["spirits", b, p.name]) })) };
    if (c) at(3, c);
    return { ...base(c || b, "spirits"), kind: "bottles", items: lvl.items as (SpiritEntry & { bottle: IndexBottle })[] };
  }
  if (a === "beer-wine") {
    at(1, "Beer & wine");
    if (!b) {
      const tiles = DRINK_KINDS.map((k) => ({ ...k, n: d.drinks.filter((x) => x.kind === k.kind).length })).filter((k) => k.n)
        .map((k) => ({ id: k.id, label: k.label, count: k.n, cover: null, href: indexHref(["beer-wine", k.id]), section: "beer-wine" as SectionId }));
      return { ...base("Beer & wine", "beer-wine"), kind: "tiles", tiles };
    }
    const k = DRINK_KINDS.find((x) => x.id === b);
    const items = k ? d.drinks.filter((x) => x.kind === k.kind) : [];
    if (!k || !items.length) return missing();
    at(2, k.label);
    return { ...base(k.label, "beer-wine"), kind: "drinks", items: [...items.filter((x) => !x.status_label), ...items.filter((x) => x.status_label)] };
  }
  if (a === "lists") { at(1, "Lists"); return { ...base("Your lists", "yours"), kind: "lists" }; }
  if (a === "cg") {
    at(1, "From Common Good");
    if (!b) return { ...base("From Common Good", "bar"), kind: "tiles", tiles: cgTiles(d) };
    const k = houseKinds(d.house_lists || []);
    const label = { house: "House lists", staff: "Staff picks", flights: "Flights", charts: "Charts", votes: "Votes and brackets" }[b];
    if (!label) return missing();
    at(2, label);
    if (b === "charts") return d.charts?.length ? { ...base(label, "bar"), kind: "charts", charts: d.charts } : missing();
    if (b === "votes") return d.votes?.length ? { ...base(label, "bar"), kind: "votes", votes: d.votes } : missing();
    const lists = k[b as "house" | "staff" | "flights"];
    return lists.length ? { ...base(label, "bar"), kind: "house", lists } : missing();
  }
  if (a === "yours") {
    at(1, "Yours");
    if (!b) return { ...base("Yours", "yours"), kind: "tiles", tiles: YOURS_PAGES.map((p) => ({ id: p.id, label: p.label, line: p.line, cover: null, href: p.href, section: "yours" as SectionId })) };
    if (b === "for-you") { at(2, "For you"); return { ...base("For you", "yours"), kind: "for-you" }; }
    return missing();
  }
  return missing();
}

/**
 * How many rows a level shows before the member chooses something: a tile grid is two to a row; the letter strip
 * wraps seven to a row; a list is one row each. A final list the member opened is allowed to be long (compact rows).
 */
export function rowsBeforeChoice(level: IndexLevel): number {
  if (level.kind === "tiles") return Math.ceil(level.tiles.length / TILE_COLUMNS);
  if (level.kind === "letters") return Math.ceil(level.letters.length / 7);
  return 0;
}
export const isFinal = (level: IndexLevel) => FINAL_KINDS.has(level.kind);

/** Every level the tree can reach from the top (for the tests and the speed walk). */
export function allLevels(d: IndexInput, opts: { everything?: boolean } = {}): IndexLevel[] {
  const out: IndexLevel[] = [];
  const seen = new Set<string>();
  const walk = (path: string[]) => {
    const key = path.join("\u0000");
    if (seen.has(key) || path.length > 4) return;
    seen.add(key);
    const lvl = indexLevel(d, path, opts);
    out.push(lvl);
    const next: string[][] = [];
    if (lvl.kind === "tiles") for (const t of lvl.tiles) { const p = pathOfHref(t.href); if (p) next.push(p); }
    if (lvl.kind === "letters") for (const l of lvl.letters) next.push(pathOfHref(l.href)!);
    if (lvl.kind === "producers") for (const p of lvl.producers) next.push(pathOfHref(p.href)!);
    next.forEach(walk);
  };
  walk([]);
  return out;
}
/** The level an Index address names, or null for a page of its own (Favorites, a past list…). */
export function pathOfHref(href: string): string[] | null {
  if (href === INDEX_HREF) return [];
  if (!href.startsWith(`${INDEX_HREF}?`)) return null;
  return parseAt(new URLSearchParams(href.slice(INDEX_HREF.length + 1)).get("at"));
}

// ── Jump back in ─────────────────────────────────────────────────────────────
export interface Recent { kind: ItemKind; id: number; name: string }
/**
 * The last three things the member opened that the Index still holds (so nothing they may no longer open, and never a
 * cocktail the Index rule hides, can appear), newest first.
 */
export function jumpBackIn(recent: Recent[], d: Pick<IndexInput, "cocktails" | "bottles">, n = 3): (Recent & { photo: string | null })[] {
  const cocktails = new Map(d.cocktails.map((c) => [c.id, c]));
  const bottles = new Map(d.bottles.map((b) => [b.id, b]));
  const out: (Recent & { photo: string | null })[] = [];
  const seen = new Set<string>();
  for (const r of recent) {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const x = r.kind === "cocktail" ? cocktails.get(r.id) : bottles.get(r.id);
    if (x) out.push({ kind: r.kind, id: r.id, name: x.name, photo: x.photo ?? null });
    if (out.length >= n) break;
  }
  return out;
}

// ── Compact rows: the one short line under a name ────────────────────────────
const clean = (s: string) => s.replace(/^\[(.*)\]$/, "$1").replace(/\s+/g, " ").trim();
/** A menu item's one line: the flavor line, else the tagline, else the first line of its Toast description. */
export function shortLine(it: { card?: { flavor?: string; tagline?: string; ingredients?: string }; description?: string }): string {
  const c = it.card;
  if (c?.flavor && clean(c.flavor)) return clean(c.flavor);
  if (c?.tagline) return clean(c.tagline);
  const lines = String(it.description || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const flavor = lines.find((l) => /^\[[^[\]]+\]$/.test(l));
  return clean(flavor || lines[0] || "");
}
