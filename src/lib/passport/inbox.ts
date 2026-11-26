/**
 * File 08: the Inbox, shared by the website's routes and screens (no server-only code, so the tests can use it).
 * The Bible checks everything again; these only stop bad input before it leaves the website, and decide what "Needs
 * you" holds and when the Inbox dot lights.
 */
import type { BottleRequest, EventInquiry, InboxData, InboxRef, InboxThread, MemberRequest } from "./types";
import { needsMember } from "./shell";

export const BODY_MAX = 2000;
export const SUBJECT_MAX = 120;
export const DETAILS_MAX = 1000;
export const MAX_GUESTS = 300;
export const POLL_MS = 30_000;

export const REQUEST_KINDS: { id: MemberRequest["kind"]; label: string }[] = [
  { id: "cocktail", label: "A cocktail for my next visit" },
  { id: "celebration", label: "Something for a celebration" },
  { id: "access", label: "An accessibility or seating need" },
  { id: "other", label: "Something else" },
];
export const EVENT_KINDS: { id: EventInquiry["kind"]; label: string }[] = [
  { id: "private_party", label: "Private party" },
  { id: "tasting", label: "Tasting or class" },
  { id: "buyout", label: "Buyout" },
  { id: "other", label: "Something else" },
];
export const TIMES = [
  { id: "afternoon", label: "Afternoon" }, { id: "evening", label: "Evening" }, { id: "late", label: "Late night" }, { id: "flexible", label: "Flexible" },
];
export const BUDGETS = [
  { id: "under_500", label: "Under $500" }, { id: "500_1000", label: "$500 to $1,000" }, { id: "1000_2500", label: "$1,000 to $2,500" },
  { id: "2500_5000", label: "$2,500 to $5,000" }, { id: "over_5000", label: "Over $5,000" }, { id: "unsure", label: "Not sure yet" },
];
const REF_KINDS = ["cocktail", "bottle", "list"] as const;
const has = <T extends { id: string }>(list: T[], v: unknown): v is T["id"] => typeof v === "string" && list.some((x) => x.id === v);

const str = (v: unknown) => (typeof v === "string" ? v : "");
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
const posInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
};

/** "cocktail:12" (from "Ask about this") → { kind, id }, or null. */
export function parseAbout(v: unknown): { kind: InboxRef["kind"]; id: number } | null {
  const m = typeof v === "string" ? v.match(/^(cocktail|bottle|list):(\d{1,9})$/) : null;
  return m ? { kind: m[1] as InboxRef["kind"], id: Number(m[2]) } : null;
}
/** Where an attached item opens in the app. */
export function refHref(r: InboxRef): string | null {
  if (!r.opens || !r.id) return null;
  return r.kind === "cocktail" ? `/passport/library/${r.id}` : r.kind === "bottle" ? `/passport/spirits/${r.id}` : `/passport/house/${r.id}`;
}
/** "Ask about this": the address of a new message about an item. */
export const askHref = (kind: InboxRef["kind"], id: number, name: string) =>
  `/passport/inbox/new?${new URLSearchParams({ kind: "message", about: `${kind}:${id}`, name: name.slice(0, 80) }).toString()}`;

type Built<T> = { body: T } | { error: string };
const tooLong = (s: string, max: number, what: string) => (s.trim().length > max ? `Keep ${what} to ${max.toLocaleString("en-US")} characters` : "");

/** A new thread: only these fields leave the website (never a status, a staff name or a member number). */
export function threadBody(b: Record<string, unknown>): Built<{ subject: string; body: string; ref_kind?: string; ref_id?: number }> {
  const subject = str(b.subject).replace(/\s+/g, " ").trim();
  const body = str(b.body).trim();
  if (!body) return { error: "Write your message first" };
  const e = tooLong(subject, SUBJECT_MAX, "the subject") || tooLong(body, BODY_MAX, "your message");
  if (e) return { error: e };
  const kind = str(b.ref_kind);
  if (!kind) return { body: { subject, body } };
  const id = posInt(b.ref_id);
  if (!(REF_KINDS as readonly string[]).includes(kind) || !id) return { error: "Not found" };
  return { body: { subject, body, ref_kind: kind, ref_id: id } };
}
/** A reply, an answer, or a message about an event: just the words. */
export function textBody(b: Record<string, unknown>, max = BODY_MAX): Built<{ body: string }> {
  const body = str(b.body).trim();
  if (!body) return { error: "Write your message first" };
  const e = tooLong(body, max, "your message");
  return e ? { error: e } : { body: { body } };
}
export function requestBody(b: Record<string, unknown>): Built<{ kind: string; date: string; details: string }> {
  if (!has(REQUEST_KINDS, b.kind)) return { error: "Choose what kind of request it is" };
  const date = str(b.date);
  if (date && !isDay(date)) return { error: "The date isn't a date" };
  const details = str(b.details).trim();
  if (!details) return { error: "Tell us a little about it" };
  const e = tooLong(details, DETAILS_MAX, "the details");
  return e ? { error: e } : { body: { kind: b.kind as string, date, details } };
}
export function eventBody(b: Record<string, unknown>): Built<{ kind: string; preferred_date: string; backup_date: string; time_of_day: string; guests: number; budget: string; details: string }> {
  if (!has(EVENT_KINDS, b.kind)) return { error: "Choose what kind of event it is" };
  const preferred = str(b.preferred_date);
  if (!isDay(preferred)) return { error: "Choose the preferred date" };
  const backup = str(b.backup_date);
  if (backup && !isDay(backup)) return { error: "The backup date isn't a date" };
  if (!has(TIMES, b.time_of_day)) return { error: "Choose a time of day" };
  const guests = typeof b.guests === "number" ? b.guests : posInt(b.guests);
  if (!guests || !Number.isInteger(guests) || guests < 1 || guests > MAX_GUESTS) return { error: `Tell us how many guests, from 1 to ${MAX_GUESTS}` };
  const budget = str(b.budget);
  if (budget && !has(BUDGETS, budget)) return { error: "Choose a budget from the list, or leave it empty" };
  const details = str(b.details).trim();
  const e = tooLong(details, DETAILS_MAX, "the notes");
  return e ? { error: e } : { body: { kind: b.kind as string, preferred_date: preferred, backup_date: backup, time_of_day: b.time_of_day as string, guests, budget, details } };
}

// ── What needs the member ─────────────────────────────────────────────────────
export type NeedsItem =
  | { key: string; kind: "reply"; thread: InboxThread; href: string }
  | { key: string; kind: "question" | "note"; request: MemberRequest; href: string }
  | { key: string; kind: "event"; inquiry: EventInquiry; href: string }
  | { key: string; kind: "price" | "ready"; bottle: BottleRequest; href: string };

/** Everything waiting on the member: a price to answer, a bottle ready, an unread reply, a question on a request. */
export function needsYou(inbox: Pick<InboxData, "threads" | "member_requests" | "inquiries"> | null | undefined, bottles: BottleRequest[] | null | undefined): NeedsItem[] {
  const out: NeedsItem[] = [];
  for (const r of inbox?.member_requests || []) if (r.question) out.push({ key: `q${r.id}`, kind: "question", request: r, href: `/passport/inbox/requests/${r.id}` });
  for (const b of bottles || []) {
    if (b.can_answer) out.push({ key: `p${b.id}`, kind: "price", bottle: b, href: "/passport/inbox?tab=bottles" });
    else if (b.status === "ready") out.push({ key: `b${b.id}`, kind: "ready", bottle: b, href: "/passport/inbox?tab=bottles" });
  }
  for (const t of inbox?.threads || []) if (t.unread) out.push({ key: `t${t.id}`, kind: "reply", thread: t, href: `/passport/inbox/messages/${t.id}` });
  for (const q of inbox?.inquiries || []) if (q.unread) out.push({ key: `e${q.id}`, kind: "event", inquiry: q, href: `/passport/inbox/events/${q.id}` });
  for (const r of inbox?.member_requests || []) if (r.unread && !r.question) out.push({ key: `r${r.id}`, kind: "note", request: r, href: `/passport/inbox/requests/${r.id}` });
  return out;
}
/** The Inbox dot: lit while anything needs the member (file 06's bottles, and now replies and questions). */
export const inboxLit = (inbox: Pick<InboxData, "threads" | "member_requests" | "inquiries"> | null | undefined, bottles: BottleRequest[] | null | undefined) =>
  !!bottles?.some(needsMember) || needsYou(inbox, []).length > 0;

/** "2026-11-25T18:03:00Z" → "Today, 12:03 PM" / "Yesterday, …" / "Nov 21, …", in bar time. */
export function whenShort(iso: string | null | undefined, now = new Date()): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const tz = "America/Chicago";
  const day = (x: Date) => x.toLocaleDateString("en-CA", { timeZone: tz });
  const time = d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: tz });
  if (day(d) === day(now)) return `Today, ${time}`;
  if (day(d) === day(new Date(now.getTime() - 86400000))) return `Yesterday, ${time}`;
  return `${d.toLocaleDateString("en-US", { month: "short", day: "numeric", timeZone: tz })}, ${time}`;
}
/** Open conversations first (newest activity first), then closed ones. */
export const OPEN_REQUEST = new Set(["submitted", "seen", "in_progress"]);
export const OPEN_EVENT = new Set(["submitted", "in_conversation", "proposal_sent", "confirmed"]);
