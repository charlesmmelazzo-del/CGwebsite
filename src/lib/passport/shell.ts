/**
 * File 06: the new shell. Plain helpers shared by the app frame, the tabs and the tests (no server-only code, no React).
 */
import type { BottleRequest, IndexBottle, IndexCocktail, Reservation } from "./types";

// ── The five tabs ─────────────────────────────────────────────────────────────
export type TabId = "menu" | "index" | "home" | "events" | "inbox";
export interface TabDef { id: TabId; label: string; href: string }
/** Left to right along the bottom: Menu · Index · CG (Home) · Events · Inbox. */
export const TABS: TabDef[] = [
  { id: "menu", label: "Menu", href: "/passport/menu" },
  // The Index keeps the Library's address, so every old Library link still lands on it.
  { id: "index", label: "Index", href: "/passport/library" },
  { id: "home", label: "Home", href: "/passport" },
  { id: "events", label: "Events", href: "/passport/events" },
  { id: "inbox", label: "Inbox", href: "/passport/inbox" },
];
const BY_PATH = new Map(TABS.map((t) => [t.href, t.id]));
export const tabHref = (id: TabId) => TABS.find((t) => t.id === id)!.href;

/** The tab an address IS (a tab screen), or null when it is a page that opens over a tab (an item, a list, account). */
export function tabOfPath(pathname: string | null | undefined): TabId | null {
  if (!pathname) return null;
  const p = pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname;
  return BY_PATH.get(p) ?? null;
}

/** For a page opened straight from a link (no tab behind it yet): the tab it belongs under. */
export function homeTabOf(pathname: string): TabId {
  if (/^\/passport\/(bottles|messages|inbox)(\/|$)/.test(pathname)) return "inbox";
  if (/^\/passport\/(account|friends|letsgo|shared)(\/|$)/.test(pathname)) return "home";
  if (/^\/passport\/events\/./.test(pathname)) return "events";
  if (/^\/passport\/spirits\/?$/.test(pathname)) return "menu";
  return "index";
}

/**
 * Every Passport address from before file 06 and where it goes now. "same" means the address still opens the same
 * screen (now over the tab it belongs to); anything else is a redirect to that address.
 */
export const OLD_ADDRESSES: { path: string; goes: string; note: string }[] = [
  { path: "/passport", goes: "same", note: "Home (the CG button), or sign-in when signed out" },
  { path: "/passport/menu", goes: "same", note: "the Menu tab" },
  { path: "/passport/library", goes: "same", note: "the Index tab (a ?q= or ?spirit= from an old link fills the search or filter)" },
  { path: "/passport/library/[id]", goes: "same", note: "a cocktail page, over the tab it was opened from" },
  { path: "/passport/library/[id]/home-recipe", goes: "same", note: "the at-home recipe PDF" },
  { path: "/passport/spirits", goes: "/passport/menu#spirits", note: "the spirits list now lives on the Menu tab" },
  { path: "/passport/spirits/[id]", goes: "same", note: "a bottle page" },
  { path: "/passport/producers/[id]", goes: "same", note: "a producer page" },
  { path: "/passport/lists", goes: "/passport/library#lists", note: "lists now live at the top of the Index tab" },
  { path: "/passport/lists/[id]", goes: "same", note: "one list, over the Index" },
  { path: "/passport/favorites", goes: "same", note: "Favorites, from the Index" },
  { path: "/passport/notes", goes: "same", note: "My notes, from the Index" },
  { path: "/passport/bespoke", goes: "same", note: "My Cocktails (the recipe book), from the Index" },
  { path: "/passport/history", goes: "same", note: "Your history, from the Index" },
  { path: "/passport/bottles", goes: "/passport/inbox", note: "My bottles now lives in the Inbox tab" },
  { path: "/passport/messages", goes: "/passport/inbox", note: "the old Messages tab is the Inbox" },
  { path: "/passport/account", goes: "same", note: "your account (the round button at the top)" },
  { path: "/passport/inbox/new", goes: "same", note: "file 08: Message the bar, Make a request, Plan an event (over the Inbox)" },
  { path: "/passport/inbox/messages/[id]", goes: "same", note: "file 08: one conversation with the bar" },
  { path: "/passport/inbox/requests/[id]", goes: "same", note: "file 08: one request" },
  { path: "/passport/inbox/events/[id]", goes: "same", note: "file 08: one event inquiry" },
  { path: "/passport/friends", goes: "same", note: "file 09: Friends (requests, add a friend, friends, blocked); ?code= fills in a friend code" },
  { path: "/passport/inbox/friends/[id]", goes: "same", note: "file 09: a conversation with a friend (over the Inbox)" },
  { path: "/passport/events/[id]", goes: "same", note: "file 09: one Passport event (over the Events tab)" },
  { path: "/passport/letsgo", goes: "same", note: "file 09: Let's go, plan a visit with friends (over Home)" },
  { path: "/passport/shared/[id]", goes: "same", note: "file 09: a friend's list or recipe shared with the member" },
  { path: "/passport/forgot", goes: "same", note: "forgot password" },
  { path: "/passport/set-password", goes: "same", note: "set-password links" },
  { path: "/passport/confirm", goes: "same", note: "confirm-email links" },
  { path: "/passport/signup", goes: "same", note: "sign-up" },
  { path: "/passport/manifest.webmanifest", goes: "same", note: "home-screen install" },
];

// ── What needs the member (the Inbox dot and Home's "Right now") ─────────────
/** A price waiting for their answer, or a bottle ready for pickup. */
export const needsMember = (r: Pick<BottleRequest, "can_answer" | "status">) => r.can_answer || r.status === "ready";
export const inboxDot = (requests: Pick<BottleRequest, "can_answer" | "status">[] | null | undefined) => !!requests?.some(needsMember);

// ── Reservations, in the member's words ──────────────────────────────────────
const RES_WORDS: Record<Reservation["status"], string> = { requested: "Request received", approved: "Booked", guest_confirmed: "Confirmed" };
export const reservationWord = (s: string) => RES_WORDS[s as Reservation["status"]] || "Booked";
/** "2026-12-04" → "Friday, December 4". */
export function dayLong(d: string): string {
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  if (!y || !m || !day) return d;
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}
export const partyOf = (n: number) => (n === 1 ? "Just you" : `Party of ${n}`);

// ── Lists of things ──────────────────────────────────────────────────────────
/** Bottles grouped by category, keeping the order the Bible sent (the spirits list's own order first). */
export function byCategory<T extends { category: string }>(items: T[]): { name: string; items: T[] }[] {
  const out: { name: string; items: T[] }[] = [];
  const at = new Map<string, number>();
  for (const it of items) {
    const name = it.category || "Other";
    if (!at.has(name)) { at.set(name, out.length); out.push({ name, items: [] }); }
    out[at.get(name)!].items.push(it);
  }
  return out;
}

/** The Index's base-spirit filter: "" is everything. */
export const withSpirit = (cocktails: IndexCocktail[], key: string) => (key ? cocktails.filter((c) => c.spirits?.includes(key)) : cocktails);

/** How many search results, for the screen reader's "N results" line. */
export const resultCount = (r: { cocktails: unknown[]; bottles: unknown[]; producers: unknown[] } | null) => (r ? r.cocktails.length + r.bottles.length + r.producers.length : 0);

/** A search worth sending: at least two letters once trimmed (the Bible answers nothing for less). */
export const searchable = (q: string) => q.trim().replace(/\s+/g, "").length >= 2;

/** "Available now" is a small marker, never a whole row: what a row needs to know. */
export const isAvailable = (x: Pick<IndexCocktail, "available"> | Pick<IndexBottle, "available"> | null | undefined) => !!x?.available;

// ── Instant search from the Index data already in the browser ─────────────────
// The Bible's /find matches cocktails by name or published ingredient words and bottles by name or producer, names
// first; producers by name. With the Index tab's data loaded, the browser can answer the name matches at once, in the
// Bible's own order (so the server's answer, when it arrives, only adds to the end: ingredient and producer matches, and
// the producers). The Index holds only what the member may open, so nothing here can open what the Bible wouldn't.
const FIND_LIMITS = { cocktails: 20, bottles: 25 };
const plainWords = (s: string) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
export function findWords(q: string): string[] {
  return plainWords(q).split(/\s+/).filter(Boolean).slice(0, 6);
}
/** Cocktails and bottles from the Index whose names hold every word, in the Bible's order and limits. */
export function localFind(index: { cocktails: IndexCocktail[]; bottles: IndexBottle[] } | null | undefined, q: string): { cocktails: IndexCocktail[]; bottles: IndexBottle[] } | null {
  if (!index) return null;
  const words = findWords(q);
  if (!words.length || words.join("").length < 2) return { cocktails: [], bottles: [] };
  const has = (text: string) => { const t = plainWords(text); return words.every((w) => t.includes(w)); };
  const cocktails = index.cocktails.filter((c) => has(c.name))
    .sort((a, b) => (a.menu_status === b.menu_status ? 0 : a.menu_status === "current" ? -1 : 1) || a.name.localeCompare(b.name))
    .slice(0, FIND_LIMITS.cocktails);
  const bottles = index.bottles.filter((b) => has(b.name)).sort((a, b) => a.name.localeCompare(b.name)).slice(0, FIND_LIMITS.bottles);
  return { cocktails, bottles };
}
