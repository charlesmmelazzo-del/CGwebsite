/**
 * File 15, Part G: the public website's events in Passport's Events tab, beside the members-only Passport events.
 *
 * Where they come from (looked at first): the public /events page reads the website's OWN database (Supabase table
 * `events`: title, start_date, end_date, description, location, image_url, visible_from, visible_until, link_url,
 * link_label, recurrence), through getEventsData() (src/lib/eventsdata.ts). That function is the visibility rule:
 * one-off events from today on, weekly series expanded to their next occurrences, and anything outside its
 * visible_from / visible_until window left out. There is no draft or cancelled state in that table: an event is hidden
 * by its window or by being deleted. Whether an event takes table bookings comes from the CG Bible (Reservations keeps
 * a copy of the website's events that take reservations, with holds and booking windows) as a state only: when it is
 * "open" the public page offers "Book a table" for that night. Passport uses the same function and the same state, so an
 * event the public page does not show is never shown here either.
 *
 * Plain functions and types only (shared by the server route, the tab and the tests). The fields a member gets are
 * PUBLIC_EVENT_KEYS: only what the public page already shows to anyone.
 */
import type { PassportEvent } from "./types";

export interface PublicEvent {
  id: string; title: string; date: string; time: string | null; end_date: string | null; description: string; line: string;
  image: string | null; location: string | null; link_url: string | null; link_label: string | null; book: boolean;
}
export const PUBLIC_EVENT_KEYS = ["id", "title", "date", "time", "end_date", "description", "line", "image", "location", "link_url", "link_label", "book"] as const;

/** A website event id (a Supabase id, or "<id>::<date>" for one occurrence of a weekly series). */
export const isPublicEventId = (v: unknown): v is string => typeof v === "string" && /^[A-Za-z0-9_-]{1,64}(::\d{4}-\d{2}-\d{2})?$/.test(v);
const https = (u: string | null | undefined) => { if (!u) return null; try { const x = new URL(u); return x.protocol === "https:" && !x.username && !x.password ? x.toString() : null; } catch { return null; } };
const clean = (s: unknown, max: number) => String(s ?? "").replace(/\s+\n/g, "\n").trim().slice(0, max);
/** "2026-12-05T19:00" → "7:00 PM"; a date with no time → null (the public page shows none). */
export function timeOf(start: string): string | null {
  const m = /T(\d{2}):(\d{2})/.exec(start);
  if (!m) return null;
  const h = Number(m[1]); const min = m[2];
  return `${h % 12 || 12}:${min} ${h < 12 ? "AM" : "PM"}`;
}
/**
 * One website event as a member gets it: exactly what the public page shows (title, date, time, description, image,
 * location, the link and its label, and whether "Book a table" is offered). Never anything else from the row.
 */
export function toPublicEvent(e: { id: string; title: string; start: string; end?: string; description?: string; imageUrl?: string; location?: string; linkUrl?: string; linkLabel?: string }, state?: string | null): PublicEvent | null {
  if (!isPublicEventId(e.id) || !e.title || !/^\d{4}-\d{2}-\d{2}/.test(e.start || "")) return null;
  const description = clean(e.description, 2000);
  return {
    id: e.id, title: clean(e.title, 140), date: e.start.slice(0, 10), time: timeOf(e.start), end_date: e.end && /^\d{4}-\d{2}-\d{2}/.test(e.end) ? e.end.slice(0, 10) : null,
    description, line: description.split(/\n+/)[0]?.slice(0, 160) || "", image: https(e.imageUrl), location: e.location ? clean(e.location, 120) : null,
    link_url: https(e.linkUrl), link_label: e.linkUrl ? clean(e.linkLabel || "More info", 40) : null, book: state === "open",
  };
}
/** Where a public event's booking or ticket action goes: the public booking page for that night, or its own link. */
export const publicBookHref = (e: Pick<PublicEvent, "id" | "book">) => (e.book ? `/events?event=${encodeURIComponent(e.id)}` : null);
export const publicEventHref = (id: string) => `/passport/events/public/${encodeURIComponent(id)}`;

// ── The Events tab's two tabs (file 14's tab style) ─────────────────────────
export type EventsTabId = "all" | "exclusives";
export const EVENTS_TABS: { id: EventsTabId; label: string }[] = [{ id: "all", label: "All events" }, { id: "exclusives", label: "Passport exclusives" }];
export interface EventRow { kind: "passport" | "public"; key: string; date: string; sortTime: string; title: string; passport?: PassportEvent; pub?: PublicEvent; members_only: boolean }
/** "7:00 PM" / "19:00" → "19:00" for ordering on the same day (no time sorts first). */
const sortKey = (t: string | null | undefined) => {
  if (!t) return "00:00";
  const m = /(\d{1,2}):(\d{2})\s*(AM|PM)?/i.exec(t);
  if (!m) return "00:00";
  let h = Number(m[1]) % 12;
  if (!m[3]) h = Number(m[1]);
  else if (/pm/i.test(m[3])) h += 12;
  return `${String(h).padStart(2, "0")}:${m[2]}`;
};
/**
 * "All events": Passport events and the public events in one list by date, soonest first (then by time; a Passport
 * event before a public one on the same day and time). "Passport exclusives": only Passport events.
 */
export function eventRows(passport: PassportEvent[] | null | undefined, pub: PublicEvent[] | null | undefined, tab: EventsTabId = "all"): EventRow[] {
  const rows: EventRow[] = [
    ...(passport || []).map((e) => ({ kind: "passport" as const, key: `p${e.id}`, date: e.date, sortTime: sortKey(e.start), title: e.title, passport: e, members_only: true })),
    ...(tab === "all" ? (pub || []).map((e) => ({ kind: "public" as const, key: `w${e.id}`, date: e.date, sortTime: sortKey(e.time), title: e.title, pub: e, members_only: false })) : []),
  ];
  return rows.sort((a, b) => a.date.localeCompare(b.date) || a.sortTime.localeCompare(b.sortTime) || (a.kind === b.kind ? 0 : a.kind === "passport" ? -1 : 1) || a.title.localeCompare(b.title));
}
