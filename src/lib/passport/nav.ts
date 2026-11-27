/**
 * File 14: nested navigation. Plain functions (no React, no server-only code) that turn the data the Menu and Index
 * tabs already have into short screens that drill down, like an iPod's menus: every screen is a short set of choices,
 * except a final list the member deliberately opened (one group of a menu, one category, one producer, one letter),
 * and those are compact rows. Nothing here asks the Bible for anything: every level is built from the one answer the
 * tab already loaded. The tests (__tests__/passport.test.ts) check the rules on these models, not on pixels.
 */
import type { Album, BaseSpirit, Chart, HouseItem, HouseList, IndexBottle, IndexCocktail, IndexDrink, ItemKind, Marks, MenuGroup, MenuItem, MenuTabDef, PassportList, Recommendation, ToastMenu, VoteCard } from "./types";
import type { SectionId } from "./accents";
import { stripMarks } from "./description";

/** About a dozen rows before the member has chosen something. */
export const ROW_LIMIT = 12;
/** A spirits category with more bottles than this opens by producer first. */
export const PRODUCER_THRESHOLD = 40;
/** A grid of tiles is two to a row on a phone. */
export const TILE_COLUMNS = 2;

// ── Covers ───────────────────────────────────────────────────────────────────
/**
 * A photo to show for a place: the bar's photo of one of its own items. clear: the photo has a transparent background
 * (a bottle cut out, file 15 Part D), so it is drawn without a box, contain-fit on the section's tint.
 */
export interface Cover { kind: ItemKind; id: number; photo: string; name: string; clear?: boolean }
interface Pictured { id: number | null; name: string; photo?: string | null; cover?: boolean; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }
const toCover = (x: Pictured, kind: ItemKind): Cover => ({ kind, id: x.id as number, photo: x.photo as string, name: x.name, ...(x.photo_clear ? { clear: true } : {}) });
/** The admin's "Use as cover" first, otherwise the first item that has a photo; null when none does. */
export function coverOf(items: Pictured[], kind: ItemKind | ((x: Pictured) => ItemKind)): Cover | null {
  return coversOf(items, kind, 1)[0] ?? null;
}
/** File 15, Part C: the most photos a collage shows (a 2×2, like a playlist's art). */
export const COLLAGE_MAX = 4;
/**
 * File 15, Part C: the photos of a collage, chosen stably: the item an admin marked "Use as cover" first, then the first
 * items in the collection's own order that have a photo, never the same item twice, at most four. The same collection
 * gives the same picture on every visit; it changes only when the collection (or a photo in it) changes. Only items
 * the app was sent can appear, and the Bible sends only items this member may open.
 * File 17: a brand logo never goes into a collage or a cover. While any real photo exists in the collection it is used
 * instead; a collection with only logos gets none (the section's icon, as with no photos at all).
 */
export function coversOf(items: Pictured[], kind: ItemKind | ((x: Pictured) => ItemKind), n = COLLAGE_MAX): Cover[] {
  const k = (x: Pictured) => (typeof kind === "function" ? kind(x) : kind);
  const out: Cover[] = [];
  const seen = new Set<string>();
  const add = (x: Pictured) => {
    if (out.length >= n || !x.photo || !x.id || x.photo_logo) return;
    const key = `${k(x)}:${x.id}`;
    if (seen.has(key)) return;
    seen.add(key);
    out.push(toCover(x, k(x)));
  };
  items.filter((x) => x.cover && !x.photo_logo).forEach(add);
  items.forEach(add);
  return out;
}
/** Several collections' collages laid end to end (Lists, CG Picks, Party Picks): the first photos of each, in order. */
export function mergeCovers(groups: (Cover[] | null | undefined)[], n = COLLAGE_MAX): Cover[] {
  const out: Cover[] = [];
  const seen = new Set<string>();
  // One from each collection first, so four lists give four different pictures; then the rest in order.
  const lists = groups.map((g) => g || []);
  for (let round = 0; out.length < n && lists.some((g) => g.length > round); round++) {
    for (const g of lists) {
      const c = g[round];
      if (!c || out.length >= n) continue;
      const key = `${c.kind}:${c.id}`;
      if (!seen.has(key)) { seen.add(key); out.push(c); }
    }
  }
  return out;
}
const fromCovers = (xs: { kind: ItemKind; id: number; photo: string; name?: string; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }[] | null | undefined): Cover[] =>
  (xs || []).filter((x) => x && x.id && x.photo && !x.photo_logo).slice(0, COLLAGE_MAX).map((x) => ({ kind: x.kind, id: x.id, photo: x.photo, name: x.name || "", ...(x.photo_clear ? { clear: true } : {}) }));
const menuItemCover = (items: MenuItem[]): Cover | null =>
  coverOf(items.map((it) => ({ id: it.cocktail_id || it.bottle_id, name: it.name, photo: it.photo, cover: it.cover, photo_clear: it.photo_clear, photo_logo: !it.cocktail_id && it.photo_logo, k: it.cocktail_id ? "cocktail" : "bottle" })) as (Pictured & { k: ItemKind })[], (x) => (x as Pictured & { k: ItemKind }).k);
const menuItemCovers = (items: MenuItem[]): Cover[] =>
  coversOf(items.map((it) => ({ id: it.cocktail_id || it.bottle_id, name: it.name, photo: it.photo, cover: it.cover, photo_clear: it.photo_clear, photo_logo: !it.cocktail_id && it.photo_logo, k: it.cocktail_id ? "cocktail" : "bottle" })) as (Pictured & { k: ItemKind })[], (x) => (x as Pictured & { k: ItemKind }).k);
export { menuItemCovers };

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
export interface SpiritEntry { id: number | null; name: string; category: string; producer: string; out: boolean; photo?: string | null; cover?: boolean; photo_clear?: boolean; photo_logo?: boolean; photo_logo_light?: boolean }
export interface CountTile { name: string; count: number; covers: Cover[] }
const OTHER_PRODUCER = "Other producers";
const producerOf = (x: SpiritEntry) => x.producer.trim() || OTHER_PRODUCER;
/** "Out right now" sinks to the bottom of its list (kept in the list's own order otherwise). */
export const outLast = <T extends { out: boolean }>(xs: T[]): T[] => [...xs.filter((x) => !x.out), ...xs.filter((x) => x.out)];
/** The category tiles, in the list's own order, each with its count and a collage of its own bottles' photos. */
export function spiritCategories(items: SpiritEntry[]): CountTile[] {
  const at = new Map<string, SpiritEntry[]>();
  for (const x of items) { const k = x.category || "Other"; if (!at.has(k)) at.set(k, []); at.get(k)!.push(x); }
  return Array.from(at.entries()).map(([name, xs]) => ({ name, count: xs.length, covers: coversOf(xs, "bottle") }));
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
    const producers = Array.from(by.entries()).map(([name, xs]) => ({ name, count: xs.length, covers: coversOf(xs, "bottle") }))
      .sort((a, b) => (a.name === OTHER_PRODUCER ? 1 : b.name === OTHER_PRODUCER ? -1 : a.name.localeCompare(b.name)));
    return { kind: "producers", category, producers };
  }
  return { kind: "bottles", category, producer: null, items: outLast(inCat) };
}
/** The spirits list (Menu tab) as drill-down entries. */
export const spiritsFromMenu = (groups: MenuGroup[]): (SpiritEntry & { item: MenuItem })[] =>
  groups.flatMap((g) => g.items.map((it) => ({ id: it.bottle_id, name: it.name, category: g.name, producer: it.producer || "", out: it.unavailable, photo: it.photo, cover: it.cover, photo_clear: it.photo_clear, photo_logo: it.photo_logo, photo_logo_light: it.photo_logo_light, item: it })));
/** The Index's bottles as drill-down entries; "Pouring now" keeps only bottles on the spirits list. */
export const spiritsFromIndex = (bottles: IndexBottle[], everything: boolean): (SpiritEntry & { bottle: IndexBottle })[] =>
  bottles.filter((b) => everything || b.on_list || b.available)
    .map((b) => ({ id: b.id, name: b.name, category: b.category, producer: b.producer || "", out: !b.available && (b.on_list || b.status_label === "Out right now"), photo: b.photo, cover: b.cover, photo_clear: b.photo_clear, photo_logo: b.photo_logo, photo_logo_light: b.photo_logo_light, bottle: b }));

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
/**
 * File 15, Part A: the places renamed and moved. "Yours" is "Journal" (journal), "From Common Good" is "CG Picks" (cg,
 * curated things only), and votes and brackets moved to "Party Picks" (party). An address from before keeps working:
 * ?at=yours/… opens Journal, ?at=cg/votes (Home's old "See all") opens Party Picks.
 */
export function normalizePath(path: string[]): string[] {
  const [a, b] = path;
  if (a === "yours") return ["journal", ...path.slice(1)];
  if (a === "cg" && (b === "votes" || b === "past-votes")) return ["party"];
  if (a === "party-picks") return ["party"];
  if (a === "cg-picks") return ["cg", ...path.slice(1)];
  return path;
}
const HASHES: Record<string, string[]> = {
  lists: ["lists"], "from-common-good": ["cg"], "cg-picks": ["cg"], yours: ["journal"], journal: ["journal"], "party-picks": ["party"], party: ["party"],
  cocktails: ["cocktails"], spirits: ["spirits"], "beer-wine": ["beer-wine"],
};
/**
 * Every Index address, old and new, to its level: ?at= (file 14), ?spirit= (an old Library filter link → By spirit),
 * and the old jump links (#lists, #yours, #from-common-good, …). ?q= stays a search (the search box fills, on top of the level).
 */
export function indexPathOf(params: { get(name: string): string | null } | null | undefined, hash = ""): string[] {
  const at = params?.get("at");
  if (at) return normalizePath(parseAt(at));
  const spirit = (params?.get("spirit") || "").slice(0, 40);
  if (spirit) return ["cocktails", "spirit", spirit];
  return HASHES[hash.replace(/^#/, "")] ?? [];
}

// ── The Index tree ───────────────────────────────────────────────────────────
export interface IndexInput {
  cocktails: IndexCocktail[]; bottles: IndexBottle[]; drinks: IndexDrink[]; base_spirits: BaseSpirit[]; albums?: Album[];
  lists?: PassportList[]; house_lists?: HouseList[]; charts?: Chart[]; past_count?: number; votes?: VoteCard[]; vote_results?: VoteCard[]; past_votes_count?: number;
  recommendations?: Recommendation[];
  /** The member's own hearts and stars (Journal's collage is their favorites' photos). */
  marks?: Marks;
}
export interface Tile { id: string; label: string; count?: number; line?: string; covers: Cover[]; href: string; section: SectionId }
/** File 15: the Party Picks banner across the top of the Index (shorter than a tile). */
export interface Banner { label: string; line: string; covers: Cover[]; href: string; section: SectionId }
export interface Crumb { label: string; href: string }
interface LevelBase { title: string; trail: Crumb[]; section: SectionId | null; path: string[] }
export type IndexLevel = LevelBase & (
  | { kind: "tiles"; tiles: Tile[]; note?: string; banner?: Banner | null }
  | { kind: "letters"; letters: { letter: string; count: number; href: string }[] }
  | { kind: "cocktails"; items: IndexCocktail[] }
  | { kind: "bottles"; items: (SpiritEntry & { bottle: IndexBottle })[] }
  | { kind: "producers"; producers: (CountTile & { href: string })[] }
  | { kind: "drinks"; items: IndexDrink[] }
  | { kind: "lists" }
  | { kind: "house"; lists: HouseList[] }
  | { kind: "charts"; charts: Chart[] }
  | { kind: "party"; open: VoteCard[]; results: VoteCard[]; past: number }
  | { kind: "for-you" }
  | { kind: "missing" }
);
/** Kinds that are a final list the member deliberately opened (compact rows, any length). */
export const FINAL_KINDS = new Set(["cocktails", "bottles", "producers", "drinks", "lists", "house", "charts", "party", "for-you"]);

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

// ── Names (file 15, Part A) ──────────────────────────────────────────────────
export const JOURNAL = "Journal";
export const CG_PICKS = "CG Picks";
export const PARTY_PICKS = "Party Picks";
export const JOURNAL_HREF = indexHref(["journal"]);
export const CG_HREF = indexHref(["cg"]);
export const PARTY_HREF = indexHref(["party"]);
export const LISTS_HREF = indexHref(["lists"]);

// ── Collages for each place ──────────────────────────────────────────────────
const drinkCovers = (xs: IndexDrink[]) => coversOf(xs.map((x) => ({ id: x.id ?? null, name: x.name, photo: x.photo, cover: x.cover, photo_clear: x.photo_clear, photo_logo: x.photo_logo, photo_logo_light: x.photo_logo_light })), "bottle");
/** Journal and Favorites: the photos of the member's own favorites (cocktails, then bottles, in the Index's order). */
export function favoriteCovers(d: Pick<IndexInput, "cocktails" | "bottles" | "marks">): Cover[] {
  const m = d.marks || {};
  const fav = (kind: ItemKind, id: number) => !!m[`${kind}:${id}`]?.favorite;
  return mergeCovers([coversOf(d.cocktails.filter((c) => fav("cocktail", c.id)), "cocktail"), coversOf(d.bottles.filter((b) => fav("bottle", b.id)), "bottle")]);
}
const houseCovers = (l: HouseList) => (l.covers?.length ? fromCovers(l.covers) : coversOf((l.items || []).map((x) => ({ ...x, id: x.opens ? x.id : null })), (x) => (x as unknown as HouseItem).kind));
const chartCovers = (c: Chart) => coversOf(c.items.map((x) => ({ ...x, id: x.opens ? x.id : null })), (x) => (x as unknown as HouseItem).kind);
/** One vote's or bracket's collage (its own options or entries a member may open, chosen by the Bible). */
export const voteCovers = (v: VoteCard) => fromCovers(v.covers);
/** One of the member's own lists. */
export const listCovers = (l: PassportList) => fromCovers(l.covers);
export const houseListCovers = houseCovers;
export const chartCoversOf = chartCovers;
/** The Party Picks banner: open votes first, then results; past votes only. Nothing at all when there is nothing. */
export function partyBanner(d: Pick<IndexInput, "votes" | "vote_results" | "past_votes_count">): Banner | null {
  const open = d.votes || [];
  const results = d.vote_results || [];
  const past = d.past_votes_count || 0;
  if (!open.length && !results.length && !past) return null;
  const line = open.length ? `Voting is open: ${open.length}` : results.length ? "The results are in" : "See past votes";
  return { label: PARTY_PICKS, line, covers: mergeCovers([...open, ...results].map(voteCovers)), href: PARTY_HREF, section: "party" };
}

/** The top level's six tiles (each only when it has something, except Lists and Journal, which always do). */
function topTiles(d: IndexInput, everything: boolean): Tile[] {
  const spirits = spiritsFromIndex(d.bottles, everything);
  const cg = cgTiles(d);
  const tiles: Tile[] = [];
  if (d.cocktails.length) tiles.push({ id: "cocktails", label: "Cocktails", count: d.cocktails.length, covers: coversOf(d.cocktails, "cocktail"), href: indexHref(["cocktails"]), section: "cocktails" });
  if (d.bottles.length) tiles.push({ id: "spirits", label: "Spirits", count: spirits.length || d.bottles.length, covers: coversOf(spirits.length ? spirits : d.bottles, "bottle"), href: indexHref(["spirits"]), section: "spirits" });
  if (d.drinks.length) tiles.push({ id: "beer-wine", label: "Beer & wine", count: d.drinks.length, covers: drinkCovers(d.drinks), href: indexHref(["beer-wine"]), section: "beer-wine" });
  tiles.push({ id: "lists", label: "Lists", count: d.lists?.length ?? 0, line: "Your own lists", covers: mergeCovers((d.lists || []).map(listCovers)), href: LISTS_HREF, section: "yours" });
  if (cg.length) tiles.push({ id: "cg", label: CG_PICKS, line: "House lists, staff picks, flights", covers: mergeCovers(cg.map((t) => t.covers)), href: CG_HREF, section: "bar" });
  tiles.push({ id: "journal", label: JOURNAL, line: "Your favorites, notes and cocktails", covers: favoriteCovers(d), href: JOURNAL_HREF, section: "yours" });
  return tiles;
}
/** CG Picks: only the bar's curated, non-interactive things (votes and brackets live in Party Picks). */
function cgTiles(d: IndexInput): Tile[] {
  const k = houseKinds(d.house_lists || []);
  const t = (id: string, label: string, count: number, covers: Cover[], href = indexHref(["cg", id])): Tile => ({ id, label, count, covers, href, section: "bar" });
  const of = (ls: HouseList[]) => mergeCovers(ls.map(houseCovers));
  return [
    k.house.length ? t("house", "House lists", k.house.length, of(k.house)) : null,
    k.staff.length ? t("staff", "Staff picks", k.staff.length, of(k.staff)) : null,
    k.flights.length ? t("flights", "Flights", k.flights.length, of(k.flights)) : null,
    d.charts?.length ? t("charts", "Charts", d.charts.length, mergeCovers(d.charts.map(chartCovers))) : null,
    d.past_count ? t("past", "Past lists", d.past_count, [], PAST_LISTS_HREF) : null,
  ].filter(Boolean) as Tile[];
}
/** Journal: the member's personal reflections and personal cocktails. */
export const JOURNAL_PAGES = [
  { id: "for-you", label: "For you", line: "Suggestions from your own picks", href: indexHref(["journal", "for-you"]) },
  { id: "favorites", label: "Favorites", line: "What you love, and your ratings", href: "/passport/favorites" },
  { id: "bespoke", label: "My Cocktails", line: "Drinks made for you, and your own", href: "/passport/bespoke" },
  { id: "notes", label: "Notes", line: "Your tasting notes", href: "/passport/notes" },
  { id: "history", label: "History", line: "What you've ordered", href: "/passport/history" },
  { id: "photos", label: "My photos", line: "Only for you and our team", href: "/passport/photos" },
];
/** @deprecated file 14's name for Journal's pages. */
export const YOURS_PAGES = JOURNAL_PAGES;

/** The cocktails of one album ("On the menu now" or a library menu), A to Z. */
export function albumCocktails(cocktails: IndexCocktail[], album: string): IndexCocktail[] {
  return byName(album === NOW_ALBUM ? cocktails.filter((c) => c.menu_status === "current") : cocktails.filter((c) => (c.menus || [c.menu_name]).includes(album)));
}
/** "By menu": "On the menu now" first, then each album newest first, each with its count and collage. */
export function albumTiles(d: IndexInput): Tile[] {
  const now = albumCocktails(d.cocktails, NOW_ALBUM);
  const names = d.albums?.length ? d.albums.map((a) => a.name) : Array.from(new Set(d.cocktails.map((c) => c.menu_name)));
  const tiles: Tile[] = [];
  if (now.length) tiles.push({ id: NOW_ALBUM, label: NOW_ALBUM, count: now.length, covers: coversOf(now, "cocktail"), href: indexHref(["cocktails", "menu", NOW_ALBUM]), section: "cocktails" });
  for (const name of names) {
    const xs = albumCocktails(d.cocktails, name);
    if (xs.length) tiles.push({ id: name, label: name, count: xs.length, covers: coversOf(xs, "cocktail"), href: indexHref(["cocktails", "menu", name]), section: "cocktails" });
  }
  return tiles;
}

/** One level of the Index, from the Index's one answer. Unknown addresses say so (and offer the way back). */
export function indexLevel(d: IndexInput, rawPath: string[], { everything = false }: { everything?: boolean } = {}): IndexLevel {
  const path = normalizePath(rawPath);
  const crumbs: Crumb[] = [{ label: "Index", href: INDEX_HREF }];
  const at = (n: number, label: string) => { crumbs.push({ label, href: indexHref(path.slice(0, n)) }); return crumbs.slice(); };
  const base = (title: string, section: SectionId | null): LevelBase => ({ title, trail: crumbs.slice(), section, path });
  const missing = (): IndexLevel => ({ ...base("Not here any more", null), kind: "missing" });
  const [a, b, c] = path;
  if (!a) return { ...base("Index", null), kind: "tiles", tiles: topTiles(d, everything), banner: partyBanner(d) };
  if (a === "cocktails") {
    at(1, "Cocktails");
    if (!b) {
      const nowList = d.cocktails.filter((x) => x.available);
      const albums = albumTiles(d);
      const letters = new Set(d.cocktails.map((x) => letterOf(x.name))).size;
      const tiles: Tile[] = [
        { id: "menu", label: "By menu", count: albums.length, line: "Each season, newest first", covers: albums[0]?.covers ?? [], href: indexHref(["cocktails", "menu"]), section: "cocktails" },
        ...(d.base_spirits.length ? [{ id: "spirit", label: "By spirit", count: d.base_spirits.length, line: "Gin, mezcal, whiskey…", covers: coversOf(d.cocktails.filter((x) => x.spirits?.length), "cocktail"), href: indexHref(["cocktails", "spirit"]), section: "cocktails" as SectionId }] : []),
        { id: "az", label: "A to Z", count: letters, line: "By first letter", covers: coversOf(byName(d.cocktails), "cocktail"), href: indexHref(["cocktails", "az"]), section: "cocktails" },
        ...(nowList.length ? [{ id: "now", label: "Available now", count: nowList.length, line: "Being served right now", covers: coversOf(nowList, "cocktail"), href: indexHref(["cocktails", "now"]), section: "cocktails" as SectionId }] : []),
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
          return { id: s.key, label: s.label, count: xs.length || s.count, covers: coversOf(xs, "cocktail"), href: indexHref(["cocktails", "spirit", s.key]), section: "cocktails" as SectionId };
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
    if (!b) return { ...base("Spirits", "spirits"), kind: "tiles", tiles: spiritCategories(entries).map((t) => ({ id: t.name, label: t.name, count: t.count, covers: t.covers, href: indexHref(["spirits", t.name]), section: "spirits" as SectionId })) };
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
      const tiles = DRINK_KINDS.map((k) => ({ ...k, xs: d.drinks.filter((x) => x.kind === k.kind) })).filter((k) => k.xs.length)
        .map((k) => ({ id: k.id, label: k.label, count: k.xs.length, covers: drinkCovers(k.xs), href: indexHref(["beer-wine", k.id]), section: "beer-wine" as SectionId }));
      return { ...base("Beer & wine", "beer-wine"), kind: "tiles", tiles };
    }
    const k = DRINK_KINDS.find((x) => x.id === b);
    const items = k ? d.drinks.filter((x) => x.kind === k.kind) : [];
    if (!k || !items.length) return missing();
    at(2, k.label);
    return { ...base(k.label, "beer-wine"), kind: "drinks", items: [...items.filter((x) => !x.status_label), ...items.filter((x) => x.status_label)] };
  }
  if (a === "lists") { at(1, "Lists"); return { ...base("Your lists", "yours"), kind: "lists" }; }
  if (a === "party") {
    at(1, PARTY_PICKS);
    if (b) return missing();
    const open = d.votes || [];
    const results = d.vote_results || [];
    const past = d.past_votes_count || 0;
    return open.length || results.length || past ? { ...base(PARTY_PICKS, "party"), kind: "party", open, results, past } : missing();
  }
  if (a === "cg") {
    at(1, CG_PICKS);
    if (!b) return { ...base(CG_PICKS, "bar"), kind: "tiles", tiles: cgTiles(d) };
    const k = houseKinds(d.house_lists || []);
    const label = ({ house: "House lists", staff: "Staff picks", flights: "Flights", charts: "Charts" } as Record<string, string>)[b];
    if (!label) return missing();
    at(2, label);
    if (b === "charts") return d.charts?.length ? { ...base(label, "bar"), kind: "charts", charts: d.charts } : missing();
    const lists = k[b as "house" | "staff" | "flights"];
    return lists.length ? { ...base(label, "bar"), kind: "house", lists } : missing();
  }
  if (a === "journal") {
    at(1, JOURNAL);
    const fav = favoriteCovers(d);
    if (!b) return { ...base(JOURNAL, "yours"), kind: "tiles", tiles: JOURNAL_PAGES.map((p) => ({ id: p.id, label: p.label, line: p.line, covers: p.id === "favorites" ? fav : [], href: p.href, section: "yours" as SectionId })) };
    if (b === "for-you") { at(2, "For you"); return { ...base("For you", "yours"), kind: "for-you" }; }
    return missing();
  }
  return missing();
}

/**
 * How many rows a level shows before the member chooses something: a tile grid is two to a row; the letter strip
 * wraps seven to a row; a list is one row each. A final list the member opened is allowed to be long (compact rows).
 * The Party Picks banner is one row of its own.
 */
export function rowsBeforeChoice(level: IndexLevel): number {
  if (level.kind === "tiles") return Math.ceil(level.tiles.length / TILE_COLUMNS) + (level.banner ? 1 : 0);
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
    if (lvl.kind === "tiles" && lvl.banner) next.push(pathOfHref(lvl.banner.href)!);
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
export function jumpBackIn(recent: Recent[], d: Pick<IndexInput, "cocktails" | "bottles">, n = 3): (Recent & { photo: string | null; photo_logo?: boolean; photo_logo_light?: boolean })[] {
  const cocktails = new Map(d.cocktails.map((c) => [c.id, c]));
  const bottles = new Map(d.bottles.map((b) => [b.id, b]));
  const out: (Recent & { photo: string | null; photo_logo?: boolean; photo_logo_light?: boolean })[] = [];
  const seen = new Set<string>();
  for (const r of recent) {
    const k = `${r.kind}:${r.id}`;
    if (seen.has(k)) continue;
    seen.add(k);
    const x = r.kind === "cocktail" ? cocktails.get(r.id) : bottles.get(r.id);
    if (x) out.push({ kind: r.kind, id: r.id, name: x.name, photo: x.photo ?? null, ...(r.kind === "bottle" && (x as IndexBottle).photo_logo ? { photo_logo: true, ...((x as IndexBottle).photo_logo_light ? { photo_logo_light: true } : {}) } : {}) });
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
  const lines = stripMarks(String(it.description || "")).split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const flavor = lines.find((l) => /^\[[^[\]]+\]$/.test(l));
  return clean(flavor || lines[0] || "");
}

// ── File 15, Part B: always a way back ───────────────────────────────────────
export type TabKey = "menu" | "index" | "home" | "events" | "inbox";
export interface Parent { href: string; label: string; tab: TabKey }
const MENU_HREF_ = "/passport/menu";
/**
 * Every page in the app (src/app/passport/(app)) and the place one level above it: where its Back control goes when
 * there is no step in the app's own history to go back to (a page opened from a link, or a step that belongs to another
 * tab). The test checks that every route folder has an entry here, so a new page can't arrive without a way back.
 * A tab's own top level (Home, Menu, Index, Events, Messages) has no parent.
 */
export const PAGE_PARENTS: { route: string; test: RegExp; parent: Parent }[] = [
  { route: "library/[id]", test: /^\/passport\/library\/\d+\/?$/, parent: { href: INDEX_HREF, label: "Index", tab: "index" } },
  { route: "spirits/[id]", test: /^\/passport\/spirits\/\d+\/?$/, parent: { href: indexHref(["spirits"]), label: "Spirits", tab: "index" } },
  { route: "producers/[id]", test: /^\/passport\/producers\/\d+\/?$/, parent: { href: indexHref(["spirits"]), label: "Spirits", tab: "index" } },
  { route: "lists/[id]", test: /^\/passport\/lists\/\d+\/?$/, parent: { href: LISTS_HREF, label: "Lists", tab: "index" } },
  { route: "house/[id]", test: /^\/passport\/house\/\d+\/?$/, parent: { href: CG_HREF, label: CG_PICKS, tab: "index" } },
  { route: "house/past", test: /^\/passport\/house\/past\/?$/, parent: { href: CG_HREF, label: CG_PICKS, tab: "index" } },
  { route: "house/charts/[key]", test: /^\/passport\/house\/charts\/[^/]+\/?$/, parent: { href: indexHref(["cg", "charts"]), label: "Charts", tab: "index" } },
  { route: "votes/[id]", test: /^\/passport\/votes\/\d+\/?$/, parent: { href: PARTY_HREF, label: PARTY_PICKS, tab: "index" } },
  { route: "votes/past", test: /^\/passport\/votes\/past\/?$/, parent: { href: PARTY_HREF, label: PARTY_PICKS, tab: "index" } },
  { route: "brackets/[id]", test: /^\/passport\/brackets\/\d+\/?$/, parent: { href: PARTY_HREF, label: PARTY_PICKS, tab: "index" } },
  { route: "favorites", test: /^\/passport\/favorites\/?$/, parent: { href: JOURNAL_HREF, label: JOURNAL, tab: "index" } },
  { route: "notes", test: /^\/passport\/notes\/?$/, parent: { href: JOURNAL_HREF, label: JOURNAL, tab: "index" } },
  { route: "bespoke", test: /^\/passport\/bespoke\/?$/, parent: { href: JOURNAL_HREF, label: JOURNAL, tab: "index" } },
  { route: "history", test: /^\/passport\/history\/?$/, parent: { href: JOURNAL_HREF, label: JOURNAL, tab: "index" } },
  { route: "photos", test: /^\/passport\/photos\/?$/, parent: { href: JOURNAL_HREF, label: JOURNAL, tab: "index" } },
  { route: "account", test: /^\/passport\/account\/?$/, parent: { href: "/passport", label: "Home", tab: "home" } },
  { route: "friends", test: /^\/passport\/friends\/?$/, parent: { href: "/passport/account", label: "Account", tab: "home" } },
  { route: "letsgo", test: /^\/passport\/letsgo\/?$/, parent: { href: "/passport", label: "Home", tab: "home" } },
  { route: "shared/[id]", test: /^\/passport\/shared\/\d+\/?$/, parent: { href: "/passport", label: "Home", tab: "home" } },
  { route: "from-the-bar/[id]", test: /^\/passport\/from-the-bar\/\d+\/?$/, parent: { href: "/passport", label: "Home", tab: "home" } },
  { route: "events/[id]", test: /^\/passport\/events\/\d+\/?$/, parent: { href: "/passport/events", label: "Events", tab: "events" } },
  { route: "events/public/[id]", test: /^\/passport\/events\/public\/[^/]+\/?$/, parent: { href: "/passport/events", label: "Events", tab: "events" } },
  // File 16: the Inbox is called Messages (same addresses).
  { route: "inbox/new", test: /^\/passport\/inbox\/new\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/messages/[id]", test: /^\/passport\/inbox\/messages\/\d+\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/requests/[id]", test: /^\/passport\/inbox\/requests\/\d+\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/events/[id]", test: /^\/passport\/inbox\/events\/\d+\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/friends/[id]", test: /^\/passport\/inbox\/friends\/\d+\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/groups/new", test: /^\/passport\/inbox\/groups\/new\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/groups/[id]", test: /^\/passport\/inbox\/groups\/\d+\/?$/, parent: { href: "/passport/inbox", label: "Messages", tab: "inbox" } },
  { route: "inbox/channels/new", test: /^\/passport\/inbox\/channels\/new\/?$/, parent: { href: "/passport/inbox?tab=channels", label: "Channels", tab: "inbox" } },
  { route: "inbox/channels/[id]", test: /^\/passport\/inbox\/channels\/\d+\/?$/, parent: { href: "/passport/inbox?tab=channels", label: "Channels", tab: "inbox" } },
  { route: "inbox/channels/[id]/threads/[key]", test: /^\/passport\/inbox\/channels\/\d+\/threads\/[^/]+\/?$/, parent: { href: "/passport/inbox?tab=channels", label: "Channels", tab: "inbox" } },
];
/** Route folders that are not a screen of their own: a tab's top level, a redirect to one, a picture or a file. */
export const NOT_PAGES = ["", "[tab]", "menu", "library", "events", "inbox", "lists", "spirits", "bottles", "photo", "library/[id]/home-recipe"];

/**
 * One level up from where the member is: an Index level's previous trail step, a Spirits level on the Menu tab, or a
 * page's parent above. Null at a tab's own top level (nothing above it).
 */
export function parentOf(pathname: string, search = ""): Parent | null {
  const p = pathname.replace(/\/+$/, "") || "/passport";
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  if (p === INDEX_HREF) {
    const path = indexPathOf(params);
    if (!path.length) return null;
    const up = path.slice(0, -1);
    return { href: indexHref(up), label: up.length ? indexCrumbLabel(up) : "Index", tab: "index" };
  }
  if (p === MENU_HREF_) {
    const s = parseAt(params.get("s"));
    if (params.get("tab") !== "spirits" || !s.length) return null;
    const up = s.slice(0, -1);
    return { href: `${MENU_HREF_}?tab=spirits${up.length ? `&s=${encodeURIComponent(up.map((x) => encodeURIComponent(x)).join("/"))}` : ""}`, label: up.length ? up[up.length - 1] : "Spirits", tab: "menu" };
  }
  for (const r of PAGE_PARENTS) if (r.test.test(p)) return r.parent;
  return null;
}
const CRUMB: Record<string, string> = { cocktails: "Cocktails", spirits: "Spirits", "beer-wine": "Beer & wine", lists: "Lists", cg: CG_PICKS, journal: JOURNAL, party: PARTY_PICKS, menu: "By menu", spirit: "By spirit", az: "A to Z", now: "Available now", house: "House lists", staff: "Staff picks", flights: "Flights", charts: "Charts", "for-you": "For you", beer: "Beer", wine: "Wine", other: "Cider and more" };
const indexCrumbLabel = (path: string[]) => { const last = path[path.length - 1]; return path.length === 1 || ["cocktails", "cg", "journal", "beer-wine"].includes(path[0]) ? CRUMB[last] ?? last : last; };

/**
 * Tapping the tab you are on (bottom bar or the wide-screen top bar): below its top level (a page over it, a deeper
 * Index or Spirits level, a Menu tab other than the first) it returns to the top level and scrolls to the top; at the top
 * level but scrolled down, it scrolls up; at the top level and the top already, nothing happens.
 */
export type TabPress = "root" | "top" | "none";
export function tabPress(s: { overlay: boolean; atRoot: boolean; scrollY: number }): TabPress {
  if (s.overlay || !s.atRoot) return "root";
  return s.scrollY > 4 ? "top" : "none";
}
/** Whether an address is its tab's top level (the Menu tab also needs to be on its first section). */
export function isTabRoot(tab: TabKey, pathname: string, search = "", menuOnFirst = true): boolean {
  const p = pathname.replace(/\/+$/, "") || "/passport";
  const params = new URLSearchParams(search.replace(/^\?/, ""));
  if (tab === "index") return p === INDEX_HREF && !indexPathOf(params).length && !params.get("q");
  if (tab === "menu") return p === MENU_HREF_ && !params.get("s") && menuOnFirst;
  return p === ({ home: "/passport", events: "/passport/events", inbox: "/passport/inbox" } as Record<string, string>)[tab];
}
