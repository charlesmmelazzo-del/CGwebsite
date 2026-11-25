/**
 * File 07: From the bar. Plain helpers shared by Home, the Index, the list pages and the tests (no server-only code,
 * no React). Everything they word comes from the Bible's approved list; nothing here adds a number the Bible didn't send.
 */
import type { BarMessage, FeedCard, HouseList } from "./types";

export const houseHref = (id: number) => `/passport/house/${id}`;
export const chartHref = (key: string) => `/passport/house/charts/${encodeURIComponent(key)}`;
export const PAST_HREF = "/passport/house/past";

/** Where a message's link goes: only ever inside Passport (the Bible sends a kind and a number, never an address). */
export function messageHref(m: Pick<BarMessage, "link_kind" | "link_id">): string | null {
  const id = typeof m.link_id === "number" && Number.isInteger(m.link_id) && m.link_id > 0 ? m.link_id : null;
  switch (m.link_kind) {
    case "list": return id ? houseHref(id) : null;
    case "cocktail": return id ? `/passport/library/${id}` : null;
    case "bottle": return id ? `/passport/spirits/${id}` : null;
    case "events": return "/passport/events";
    default: return null;
  }
}

/** Where a What's new card goes. A kind this app doesn't know yet (a later file's) opens Home's own tab: never a dead link. */
export function feedHref(c: Pick<FeedCard, "link_kind" | "link_id">): string {
  if (c.link_kind === "list" && typeof c.link_id === "number") return houseHref(c.link_id);
  if (c.link_kind === "chart" && (c.link_id === "top" || c.link_id === "critics")) return chartHref(c.link_id);
  if (c.link_kind === "menu") return "/passport/menu";
  return "/passport";
}
const KICKERS: Record<string, string> = { list: "A new list", season: "New menu", exclusives: "New Passport exclusives", chart: "On the charts" };
export const feedKicker = (kind: string) => KICKERS[kind] || "New at the bar";

/** "Flight · $28" (whole dollars; tax is never included, so the page says "plus tax"). */
export const flightLine = (price: number | null | undefined) => (price ? `Flight · $${price}` : null);
export const TAX_LINE = "plus tax";
/** "10% off for members today", or nothing at 0. */
export const discountLine = (pct: number | null | undefined) => (pct && pct > 0 ? `${pct}% off for members today` : null);
/** A flight's pour, "1 oz" or "0.75 oz". */
export const pourLabel = (oz: number | null | undefined) => (oz ? `${oz} oz` : null);

/** The small line above a list's title. */
export function listKicker(l: Pick<HouseList, "chart" | "season_name" | "staff_pick" | "by" | "ranked" | "past">): string {
  if (l.chart) return l.season_name ? `Final chart · ${l.season_name}` : "Final chart";
  if (l.staff_pick && l.by) return `Staff pick · by ${l.by}`;
  return l.ranked ? "Ranked" : "House list";
}

/** A dismiss the website will pass on: a message number, or a card key the Bible made ("list:12"). */
export function dismissBody(what: unknown, key: unknown): { what: "message" | "feed"; key: string | number } | null {
  if (what === "message") {
    const n = typeof key === "number" ? key : typeof key === "string" && /^\d{1,9}$/.test(key) ? Number(key) : NaN;
    return Number.isInteger(n) && n > 0 ? { what, key: n } : null;
  }
  if (what === "feed" && typeof key === "string" && /^[a-z]+:[A-Za-z0-9:_-]{1,190}$/.test(key)) return { what, key };
  return null;
}
