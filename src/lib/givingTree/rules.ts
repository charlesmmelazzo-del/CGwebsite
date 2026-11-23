// ─── The Giving Tree — rules ─────────────────────────────────────────────────
//
// Every decision about dates, spots, counting and the scheduled sweep lives
// here as plain functions with no I/O, so it can be tested directly
// (npm run test:giving-tree) and reasoned about in one place. Section numbers
// refer to docs/giving-tree-spec.md.

import { addDays, centralDate, centralInstant, endOfDay, minDate } from "./time";
import type { Counters, Opportunity, Pledge, Settings } from "./types";

// ─── Pledge codes (2.1) ──────────────────────────────────────────────────────

/** No 0, O, 1, I or L, so a code written on a gift tag can't be misread. */
export const CODE_ALPHABET = "23456789ABCDEFGHJKMNPQRSTUVWXYZ";
export const CODE_LENGTH = 6;

export function makeCode(randomInt: (max: number) => number): string {
  let s = "";
  for (let i = 0; i < CODE_LENGTH; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Tidy what someone typed: upper case, spaces and dashes dropped. */
export function normalizeCode(raw: string): string {
  return raw.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, CODE_LENGTH);
}

export function isCode(v: string): boolean {
  return v.length === CODE_LENGTH && v.split("").every((c) => CODE_ALPHABET.includes(c));
}

// ─── Counting (3.2, 5.1, 5.2) ────────────────────────────────────────────────

/** Holds a spot on the tree. A released or denied pledge gives its spot back. */
export function takesSpot(p: Pledge): boolean {
  return p.status !== "released" && p.hold !== "denied";
}

/** Counts toward counters and meters: not released, not held, not denied. */
export function isCounted(p: Pledge): boolean {
  return p.status !== "released" && p.hold === "none";
}

/** A star in the sky. Released pledges stay; held, denied and hidden ones don't. */
export function isPublicStar(p: Pledge): boolean {
  return p.hold === "none" && !p.hidden;
}

export function spotsLeft(opp: Opportunity, pledges: Pledge[]): number {
  if (opp.type === "cash") return Number.POSITIVE_INFINITY;
  const taken = pledges.filter((p) => p.opportunityId === opp.id && takesSpot(p)).length;
  return Math.max(0, (opp.spots || 1) - taken);
}

/** Cash meter (5.3): the confirmed figure when there is one, else counted pledges. */
export function meter(opp: Opportunity, pledges: Pledge[]): { value: number; label: "pledged" | "raised"; asOf: string | null } {
  if (opp.confirmedRaised != null) {
    return { value: opp.confirmedRaised, label: "raised", asOf: opp.confirmedAsOf };
  }
  const value = pledges
    .filter((p) => p.opportunityId === opp.id && isCounted(p))
    .reduce((sum, p) => sum + (p.amount ?? 0), 0);
  return { value: Math.round(value * 100) / 100, label: "pledged", asOf: null };
}

export function pledgeHours(p: Pledge, opp: Opportunity | undefined): number {
  if (p.hours != null) return p.hours;
  return opp?.hoursFixed ?? 0;
}

export function counters(pledges: Pledge[], oppById: Map<string, Opportunity>): Counters {
  const out: Counters = { hours: 0, dollars: 0, giftsPromised: 0, giftsReceived: 0, neighbors: 0 };
  const people = new Set<string>();
  for (const p of pledges) {
    if (!isCounted(p)) continue;
    const opp = oppById.get(p.opportunityId);
    if (!opp) continue;
    if (opp.type === "volunteer") out.hours += pledgeHours(p, opp);
    if (opp.type === "cash") out.dollars += p.amount ?? 0;
    if (opp.type === "gift") {
      out.giftsPromised++;
      if (p.status === "received" || p.status === "delivered") out.giftsReceived++;
    }
    people.add(p.email ? p.email.trim().toLowerCase() : `pledge:${p.id}`);
  }
  out.neighbors = people.size;
  out.hours = Math.round(out.hours * 10) / 10;
  out.dollars = Math.round(out.dollars * 100) / 100;
  return out;
}

// ─── When an opportunity takes claims (4) ───────────────────────────────────

/**
 * The last Central day an opportunity takes claims.
 *  - Gifts: their deadline, never past the season end (a gift is due by then).
 *  - Volunteer: the event date or deadline, whichever is first; the season
 *    end only when it has neither. A January shift keeps taking sign-ups.
 *  - Cash: the deadline, else the whole season.
 */
export function lastClaimDay(opp: Opportunity, s: Settings): string {
  if (opp.type === "gift") return minDate(opp.deadline, s.seasonEnd)!;
  if (opp.type === "volunteer") return minDate(opp.deadline, opp.eventDate) ?? s.seasonEnd;
  return opp.deadline ?? s.seasonEnd;
}

export function acceptsClaims(opp: Opportunity, pledges: Pledge[], s: Settings, now: number): boolean {
  if (opp.status !== "live") return false;
  if (now >= endOfDay(lastClaimDay(opp, s))) return false;
  return spotsLeft(opp, pledges) > 0;
}

// ─── Gift timing (4) ─────────────────────────────────────────────────────────

/** Gifts can't be due, extended or kept open past this day. */
export function giftCloseDay(opp: Opportunity, s: Settings): string {
  return minDate(opp.deadline, s.seasonEnd)!;
}

/** Due date = earliest of: pledge date + due window, the opportunity's deadline, the season end. */
export function dueDateFor(pledgedAt: number, opp: Opportunity, s: Settings): string {
  return minDate(addDays(centralDate(pledgedAt), s.dueWindowDays), opp.deadline, s.seasonEnd)!;
}

export const REMINDER_TIME = "09:00";

/**
 * When to send the reminder, or null for none.
 *
 * Normally 9:00 on the day `reminderLeadDays` before the due date. If that
 * moment has already passed when the pledge is made, 9:00 the next morning,
 * but only if that morning is still before the due date (an earlier calendar
 * day). Otherwise no reminder: the confirmation already states the short
 * deadline.
 */
export function reminderAtFor(pledgedAt: number, dueDate: string, s: Settings): number | null {
  const standard = centralInstant(addDays(dueDate, -s.reminderLeadDays), REMINDER_TIME);
  if (standard > pledgedAt) return standard;
  const nextMorningDay = addDays(centralDate(pledgedAt), 1);
  if (nextMorningDay < dueDate) return centralInstant(nextMorningDay, REMINDER_TIME);
  return null;
}

/** Auto-release happens once the grace days after the due date have fully passed. */
export function releaseAtFor(dueDate: string, s: Settings): number {
  return endOfDay(addDays(dueDate, s.graceDays));
}

export const EXTEND_DAYS = 3;

/** "Need a few more days": +3 days, once, never past the deadline or season end. */
export function extendedDueDate(p: Pledge, opp: Opportunity, s: Settings): { ok: true; dueDate: string } | { ok: false; reason: "already" | "not_gift" | "closed" | "no_room" } {
  if (opp.type !== "gift") return { ok: false, reason: "not_gift" };
  if (p.extendedOnce) return { ok: false, reason: "already" };
  if (p.status !== "pledged") return { ok: false, reason: "closed" };
  const current = p.dueDate ?? giftCloseDay(opp, s);
  const next = minDate(addDays(current, EXTEND_DAYS), giftCloseDay(opp, s))!;
  if (next <= current) return { ok: false, reason: "no_room" };
  return { ok: true, dueDate: next };
}

export type SweepAction =
  | { kind: "remind" }
  | { kind: "release" }
  | { kind: "not_received" }
  | { kind: "flag_overdue" };

/**
 * What the scheduled sweep should do to one pledge right now, if anything.
 * Only open gift pledges are ever touched: volunteer and cash pledges have no
 * reminders or auto-release.
 */
export function sweepAction(p: Pledge, opp: Opportunity, s: Settings, now: number): SweepAction | null {
  if (opp.type !== "gift") return null;
  if (p.status !== "pledged" || p.hold === "denied") return null;

  // The opportunity has closed at its deadline / the season end: anything not
  // checked in by then is not_received (nothing is released past this point).
  if (now >= endOfDay(giftCloseDay(opp, s))) return { kind: "not_received" };

  const due = p.dueDate;
  if (!due) return null;

  if (p.guestResponse === "still_on_it") {
    if (now >= endOfDay(due) && !p.overdueFlaggedAt) return { kind: "flag_overdue" };
    return null;
  }

  if (!p.guestResponse && now >= releaseAtFor(due, s)) return { kind: "release" };

  // Overdue after "more time" is handled by the release rule above (the guest
  // answered, so it is never auto-released) — flag it for Mike instead.
  if (p.guestResponse === "more_time" && now >= endOfDay(due) && !p.overdueFlaggedAt) {
    return { kind: "flag_overdue" };
  }

  if (!p.guestResponse && p.reminderAt && !p.reminderSentAt && now >= Date.parse(p.reminderAt) && now < endOfDay(due)) {
    return { kind: "remind" };
  }
  return null;
}

/** Overdue and answered "still on it" (or took more time): Mike decides. */
export function isOverdueForReview(p: Pledge, opp: Opportunity | undefined, now: number): boolean {
  if (!opp || opp.type !== "gift" || p.status !== "pledged" || !p.dueDate) return false;
  return p.guestResponse != null && now >= endOfDay(p.dueDate);
}

// ─── Caps per email (7) ──────────────────────────────────────────────────────

export function capReached(
  email: string,
  type: Opportunity["type"],
  pledges: Pledge[],
  oppById: Map<string, Opportunity>,
  s: Settings,
  now: number
): boolean {
  const mine = pledges.filter(
    (p) => p.email && p.email.trim().toLowerCase() === email.trim().toLowerCase() && oppById.get(p.opportunityId)?.type === type
  );
  if (type === "gift") return mine.filter((p) => p.status === "pledged").length >= s.capOpenGift;
  if (type === "volunteer") return mine.filter((p) => p.status === "pledged").length >= s.capOpenVolunteer;
  const today = centralDate(now);
  return mine.filter((p) => centralDate(Date.parse(p.createdAt)) === today).length >= s.capCashPerDay;
}

// ─── Small formatting shared by server and browser ───────────────────────────

export function money(n: number): string {
  const cents = Math.round(n * 100) % 100 !== 0;
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: cents ? 2 : 0, maximumFractionDigits: 2 });
}

export function hoursLabel(h: number): string {
  return `${h % 1 === 0 ? h : h.toFixed(1)} hour${h === 1 ? "" : "s"}`;
}
