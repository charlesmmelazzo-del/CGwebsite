/**
 * File 09: friends, direct messages, sharing, Let's go, I'm here and Passport events. Plain helpers shared by the
 * website's routes, screens and tests (no server-only code). The Bible checks everything again and decides who may see
 * whom; these only stop bad input before it leaves the website and word things for members.
 */
import type { EventNotice, LetsGo, LetsGoAnswer, LetsGoTime, PassportEvent, ShareCard, ShareKind, SocialInbox } from "./types";

export const DM_MAX = 1000;
export const NOTE_MAX = 200;
export const LETSGO_NOTE_MAX = 140;
export const NAME_MAX = 30;
export const MAX_SHARE_TO = 20;
export const POLL_MS = 30_000;
export const PRIVATE_LINE = "Private between you and your friend. If something is reported, our team can review it.";
export const LOOKUP_LINE = "If they have a Passport, they will see your request. Nobody can tell from here who has one.";

const str = (v: unknown) => (typeof v === "string" ? v : "");
const posInt = (v: unknown): number | null => {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,9}$/.test(v) ? Number(v) : NaN;
  return Number.isInteger(n) && n > 0 && n < 1e9 ? n : null;
};
type Built<T> = { body: T } | { error: string };
const tooLong = (s: string, max: number, what: string) => (s.length > max ? `Keep ${what} to ${max.toLocaleString("en-US")} characters` : "");

// ── Finding a friend ─────────────────────────────────────────────────────────
/** A friend code as typed ("abcd 2345", "ABCD-2345") → "ABCD2345", or "" when it isn't one. */
export function cleanCode(v: unknown): string {
  const s = str(v).toUpperCase().replace(/[^A-Z0-9]/g, "");
  return s.length === 8 ? s : "";
}
/** Exactly one of an email, a phone number or a friend code; never a name (there is no member directory). */
export function lookupBody(b: Record<string, unknown>): Built<{ email: string } | { phone: string } | { code: string }> {
  const email = str(b.email).trim();
  const phone = str(b.phone).trim();
  const code = str(b.code).trim();
  if ([email, phone, code].filter(Boolean).length !== 1) return { error: "Enter an email address, a phone number or a friend code" };
  if (email) return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 200 ? { body: { email } } : { error: "Enter an email address" };
  if (phone) { const d = phone.replace(/\D/g, ""); return d.length === 10 || (d.length === 11 && d[0] === "1") ? { body: { phone: d.slice(-10) } } : { error: "Enter a 10-digit phone number" }; }
  const c = cleanCode(code);
  return c ? { body: { code: c } } : { error: "A friend code has 8 letters and numbers" };
}
/** "friend:12" | "ask:3" | "thread:9": someone the member already knows of, for remove, block and report. */
export const isTarget = (v: unknown): v is string => typeof v === "string" && /^(friend|ask|thread):\d{1,9}$/.test(v);
/** The address of the "add me" link a member can show: their friend code fills the form. */
export const friendLink = (origin: string, code: string) => `${origin.replace(/\/+$/, "")}/passport/friends?code=${encodeURIComponent(code.replace(/[^A-Z0-9]/gi, ""))}`;

// ── Messages, shares, plans ──────────────────────────────────────────────────
export function messageBody(b: Record<string, unknown>): Built<{ body: string }> {
  const body = str(b.body).trim();
  if (!body) return { error: "Write your message first" };
  const e = tooLong(body, DM_MAX, "your message");
  return e ? { error: e } : { body: { body } };
}
export const SHARE_KINDS: ShareKind[] = ["cocktail", "bottle", "house_list", "list", "recipe", "event"];
/** A share: what it is, which friends (friendship numbers) and an optional note. Nothing else leaves the website. */
export function shareBody(b: Record<string, unknown>): Built<{ kind: ShareKind; id: number; to: number[]; note: string }> {
  const kind = str(b.kind) as ShareKind;
  if (!SHARE_KINDS.includes(kind)) return { error: "Not found" };
  const id = posInt(b.id);
  if (!id) return { error: "Not found" };
  const to = Array.isArray(b.to) ? Array.from(new Set(b.to.map(posInt).filter((x): x is number => !!x))) : [];
  if (!to.length) return { error: "Choose at least one friend" };
  if (to.length > MAX_SHARE_TO) return { error: `Share with up to ${MAX_SHARE_TO} friends at a time` };
  const note = str(b.note).trim();
  const e = tooLong(note, NOTE_MAX, "the note");
  return e ? { error: e } : { body: { kind, id, to, note } };
}
export const LETSGO_TIMES: { id: LetsGoTime; label: string }[] = [
  { id: "afternoon", label: "In the afternoon" }, { id: "early", label: "Around 5" }, { id: "evening", label: "Around 7" }, { id: "late", label: "Around 9 or later" },
];
export const ANSWERS: { id: LetsGoAnswer; label: string }[] = [{ id: "in", label: "In" }, { id: "maybe", label: "Maybe" }, { id: "cant", label: "Can't" }];
const isDay = (v: unknown) => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);
export function letsgoBody(b: Record<string, unknown>): Built<{ day: string; time: LetsGoTime; note: string; to: number[] | "all" }> {
  if (!isDay(b.day)) return { error: "Choose a day" };
  const time = str(b.time) as LetsGoTime;
  if (!LETSGO_TIMES.some((t) => t.id === time)) return { error: "Choose a rough time" };
  const note = str(b.note).trim();
  const e = tooLong(note, LETSGO_NOTE_MAX, "the note");
  if (e) return { error: e };
  if (b.to === "all") return { body: { day: b.day as string, time, note, to: "all" } };
  const to = Array.isArray(b.to) ? Array.from(new Set(b.to.map(posInt).filter((x): x is number => !!x))) : [];
  return to.length ? { body: { day: b.day as string, time, note, to } } : { error: "Choose at least one friend" };
}
/** Going (with a guest count) or Can't make it; the Bible checks the event's own guest limit. */
export function rsvpBody(b: Record<string, unknown>): Built<{ answer: "going" | "cant"; guests: number }> {
  if (b.answer === "cant") return { body: { answer: "cant", guests: 0 } };
  if (b.answer !== "going") return { error: "Answer Going or Can't make it" };
  const g = typeof b.guests === "number" ? b.guests : Number(str(b.guests) || 0);
  return Number.isInteger(g) && g >= 0 && g <= 10 ? { body: { answer: "going", guests: g } } : { error: "Choose how many guests" };
}

// ── Words ────────────────────────────────────────────────────────────────────
/** "Sam is going" / "Sam and Ana are going" / "Sam and 2 friends are going". */
export function friendsGoingLine(f: PassportEvent["friends_going"]): string {
  if (!f || !f.count) return "";
  if (f.count === 1) return `${f.names[0]} is going`;
  if (f.count === 2 && f.names.length === 2) return `${f.names[0]} and ${f.names[1]} are going`;
  return `${f.names[0]} and ${f.count - 1} friends are going`;
}
/** The outside ticket link, only when it is a plain https address (the Bible checks this too). */
export function ticketHref(url: string | null | undefined): string | null {
  if (!url) return null;
  try { const u = new URL(url); return u.protocol === "https:" && !u.username && !u.password ? u.toString() : null; } catch { return null; }
}
export const answerWord = (a: LetsGoAnswer | null | undefined) => (a ? ANSWERS.find((x) => x.id === a)?.label || "" : "No answer yet");
/** Where a shared thing opens for the receiver, or null (shown by name only). A copy of a list or recipe opens as a share. */
export function shareHref(s: Pick<ShareCard, "id" | "kind" | "ref_id" | "opens">): string | null {
  if (!s.opens) return null;
  if (s.kind === "list" || s.kind === "recipe") return `/passport/shared/${s.id}`;
  if (!s.ref_id) return null;
  return s.kind === "cocktail" ? `/passport/library/${s.ref_id}` : s.kind === "bottle" ? `/passport/spirits/${s.ref_id}` : s.kind === "house_list" ? `/passport/house/${s.ref_id}` : `/passport/events/${s.ref_id}`;
}
export const SHARE_WORDS: Record<ShareKind, string> = { cocktail: "Cocktail", bottle: "Bottle", house_list: "List from Common Good", list: "List", recipe: "Recipe", event: "Event" };
/** The next fourteen days for Let's go, with "Tonight" and "Tomorrow" in bar time. */
export function nextDays(now = new Date(), n = 14): { day: string; label: string }[] {
  const tz = "America/Chicago";
  const out: { day: string; label: string }[] = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getTime() + i * 86400000);
    const day = d.toLocaleDateString("en-CA", { timeZone: tz });
    const label = i === 0 ? "Tonight" : i === 1 ? "Tomorrow" : d.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric", timeZone: tz });
    out.push({ day, label });
  }
  return out;
}
/** The Inbox dot also lights for a friend request, an unread message from a friend, and an unread notice from the bar. */
export const socialLit = (s: Pick<SocialInbox, "conversations" | "incoming" | "notices" | "comment_replies"> | null | undefined) =>
  !!s && (s.incoming.length > 0 || s.conversations.some((c) => c.unread) || s.notices.some((n) => n.unread) || (s.comment_replies || []).some((n) => n.unread));
/** Home's "Right now" for events: a held place, or a cancellation. */
export const eventNoticeWords = (n: EventNotice) => (n.kind === "offer"
  ? { kicker: "A place opened up for you", line: "Held for 24 hours. Tap to take it." }
  : { kicker: "Cancelled", line: "Tap for a note from the bar." });
/** Plans: those from friends first (soonest first), then the member's own. */
export const sortPlans = (l: LetsGo[]) => [...l].sort((a, b) => Number(a.mine) - Number(b.mine) || a.day.localeCompare(b.day));
