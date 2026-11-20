// npm run test:giving-tree — the due-date, reminder and release rules from
// section 4 of docs/giving-tree-spec.md, plus counting, codes, caps, the
// moderation filter, the seed import and layout.

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  acceptsClaims, capReached, CODE_ALPHABET, counters, dueDateFor, extendedDueDate, isCode, isCounted,
  isPublicStar, lastClaimDay, makeCode, meter, releaseAtFor, reminderAtFor, spotsLeft, sweepAction,
} from "../rules";
import { addDays, centralDate, centralInstant, endOfDay } from "../time";
import { DEFAULT_SETTINGS, type Opportunity, type Pledge, type Settings } from "../types";
import { needsModeration, pledgeNeedsModeration } from "../filter";
import { validateImport } from "../importer";
import { placeOrnaments, starPosition } from "../layout";

let checks = 0;
function test(name: string, fn: () => void) {
  try {
    fn();
    checks++;
  } catch (e) {
    console.error(`✗ ${name}`);
    throw e;
  }
}

const S: Settings = { ...DEFAULT_SETTINGS, seasonEnd: "2026-12-31" };
const at = (date: string, time = "12:00") => centralInstant(date, time);

function opp(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "o1", orgId: "org", type: "gift", title: "Winter hat", description: null, details: null, status: "live",
    deadline: null, spots: 1, treeZone: null, treeX: null, treeY: null, sortOrder: 0, hoursMode: null, hoursFixed: null,
    hoursMin: null, hoursMax: null, eventDate: null, startTime: null, endTime: null, location: null, requirements: null,
    dropoffInstructions: null, goalAmount: null, giveUrl: null, confirmedRaised: null, confirmedAsOf: null, isDemo: false,
    createdAt: "", updatedAt: "", ...over,
  };
}

function pledge(over: Partial<Pledge> = {}): Pledge {
  return {
    id: "p1", opportunityId: "o1", code: "K7M2QX", manageToken: "t", name: "Ann", email: "ann@example.com", phone: null,
    displayMode: "named", displayName: "Ann", note: null, showGift: true, showAmount: true, hours: null, amount: null,
    status: "pledged", hold: "none", hidden: false, dueDate: null, reminderAt: null, reminderSentAt: null, guestResponse: null,
    extendedOnce: false, releasedAt: null, releaseReason: null, overdueFlaggedAt: null, receivedAt: null, deliveredAt: null,
    ornament: "to_write", hungAt: null, source: "web", consentShare: false, consentAt: null, ipHash: null, isDemo: false,
    createdAt: new Date(at("2026-12-01")).toISOString(), updatedAt: "", ...over,
  };
}

/** A gift pledge set up the way the server creates one. */
function gift(pledgedAt: number, o: Opportunity, over: Partial<Pledge> = {}): Pledge {
  const due = dueDateFor(pledgedAt, o, S);
  const r = reminderAtFor(pledgedAt, due, S);
  return pledge({ dueDate: due, reminderAt: r ? new Date(r).toISOString() : null, createdAt: new Date(pledgedAt).toISOString(), ...over });
}

// ─── Central time ────────────────────────────────────────────────────────────

test("Central dates and DST", () => {
  assert.equal(centralDate(Date.UTC(2026, 11, 2, 5, 30)), "2026-12-01"); // 11:30pm CST
  assert.equal(new Date(centralInstant("2026-12-01", "09:00")).toISOString(), "2026-12-01T15:00:00.000Z"); // CST −6
  assert.equal(new Date(centralInstant("2026-07-01", "09:00")).toISOString(), "2026-07-01T14:00:00.000Z"); // CDT −5
  assert.equal(addDays("2026-12-30", 3), "2027-01-02");
  assert.equal(endOfDay("2026-12-31"), centralInstant("2027-01-01", "00:00"));
});

// ─── Due date ────────────────────────────────────────────────────────────────

test("due date: pledge date + 7 days when nothing is sooner", () => {
  assert.equal(dueDateFor(at("2026-12-01"), opp(), S), "2026-12-08");
});
test("due date: the opportunity's deadline when sooner", () => {
  assert.equal(dueDateFor(at("2026-12-01"), opp({ deadline: "2026-12-05" }), S), "2026-12-05");
});
test("due date: the season end when sooner", () => {
  assert.equal(dueDateFor(at("2026-12-28"), opp(), S), "2026-12-31");
});
test("due date uses the Central date of the pledge, not UTC", () => {
  // 11pm Central on Dec 1 is already Dec 2 in UTC.
  assert.equal(dueDateFor(at("2026-12-01", "23:00"), opp(), S), "2026-12-08");
});

// ─── Reminder ────────────────────────────────────────────────────────────────

test("reminder: 9:00 two days before the due date", () => {
  const r = reminderAtFor(at("2026-12-01"), "2026-12-08", S);
  assert.equal(r, at("2026-12-06", "09:00"));
});
test("reminder: deadline 2 days away → next morning at 9:00", () => {
  // Done-when: pledged Dec 10 at noon, deadline Dec 12.
  const o = opp({ deadline: "2026-12-12" });
  const p = gift(at("2026-12-10"), o);
  assert.equal(p.dueDate, "2026-12-12");
  assert.equal(Date.parse(p.reminderAt!), at("2026-12-11", "09:00"));
});
test("reminder: pledged early on the lead day still gets that day's 9:00", () => {
  assert.equal(reminderAtFor(at("2026-12-10", "07:00"), "2026-12-12", S), at("2026-12-10", "09:00"));
});
test("reminder: none when even next morning isn't before the due date", () => {
  assert.equal(reminderAtFor(at("2026-12-10"), "2026-12-11", S), null);
  assert.equal(reminderAtFor(at("2026-12-10"), "2026-12-10", S), null);
});

// ─── Sweep: reminders, auto-release, not_received ────────────────────────────

test("sweep sends the reminder at its time, once", () => {
  const o = opp();
  const p = gift(at("2026-12-01"), o);
  assert.equal(sweepAction(p, o, S, at("2026-12-06", "08:59")), null);
  assert.deepEqual(sweepAction(p, o, S, at("2026-12-06", "09:00")), { kind: "remind" });
  assert.equal(sweepAction({ ...p, reminderSentAt: "x" }, o, S, at("2026-12-06", "10:00")), null);
});
test("auto-release: unanswered, not checked in, 3 days after the due date", () => {
  const o = opp();
  const p = gift(at("2026-12-01"), o, { reminderSentAt: "x" }); // due Dec 8
  assert.equal(releaseAtFor("2026-12-08", S), endOfDay("2026-12-11"));
  assert.equal(sweepAction(p, o, S, at("2026-12-11", "23:59")), null);
  assert.deepEqual(sweepAction(p, o, S, endOfDay("2026-12-11")), { kind: "release" });
});
test("auto-release: never for a received gift", () => {
  const o = opp();
  const p = gift(at("2026-12-01"), o, { status: "received" });
  assert.equal(sweepAction(p, o, S, at("2026-12-20")), null);
});
test("'Still on it' is never auto-released and is flagged once overdue", () => {
  const o = opp();
  const p = gift(at("2026-12-01"), o, { guestResponse: "still_on_it", reminderSentAt: "x" });
  assert.equal(sweepAction(p, o, S, at("2026-12-08", "20:00")), null);
  assert.deepEqual(sweepAction(p, o, S, endOfDay("2026-12-08")), { kind: "flag_overdue" });
  assert.equal(sweepAction({ ...p, overdueFlaggedAt: "x" }, o, S, at("2026-12-20")), null);
});
test("release moment after the deadline: nothing released, not_received at the deadline", () => {
  const o = opp({ deadline: "2026-12-10" });
  const p = gift(at("2026-12-05"), o, { reminderSentAt: "x" }); // due Dec 10 (deadline), release would be Dec 14
  assert.equal(p.dueDate, "2026-12-10");
  assert.equal(sweepAction(p, o, S, at("2026-12-10", "18:00")), null);
  assert.deepEqual(sweepAction(p, o, S, endOfDay("2026-12-10")), { kind: "not_received" });
});
test("release moment after the season end: not_received at the season end", () => {
  const o = opp();
  const p = gift(at("2026-12-28"), o, { reminderSentAt: "x" }); // due Dec 31
  assert.deepEqual(sweepAction(p, o, S, endOfDay("2026-12-31")), { kind: "not_received" });
});
test("'Still on it' past the deadline is also not_received", () => {
  const o = opp({ deadline: "2026-12-10" });
  const p = gift(at("2026-12-05"), o, { guestResponse: "still_on_it" });
  assert.deepEqual(sweepAction(p, o, S, endOfDay("2026-12-10")), { kind: "not_received" });
});
test("volunteer and cash pledges are never swept", () => {
  assert.equal(sweepAction(pledge(), opp({ type: "volunteer" }), S, at("2027-02-01")), null);
  assert.equal(sweepAction(pledge(), opp({ type: "cash" }), S, at("2027-02-01")), null);
});

// ─── More time ───────────────────────────────────────────────────────────────

test("need a few more days: +3, once", () => {
  const o = opp();
  const p = gift(at("2026-12-01"), o);
  const r = extendedDueDate(p, o, S);
  assert.deepEqual(r, { ok: true, dueDate: "2026-12-11" });
  assert.deepEqual(extendedDueDate({ ...p, extendedOnce: true }, o, S), { ok: false, reason: "already" });
});
test("need a few more days: never past the deadline or season end", () => {
  const o = opp({ deadline: "2026-12-09" });
  const p = gift(at("2026-12-01"), o); // due Dec 8
  assert.deepEqual(extendedDueDate(p, o, S), { ok: true, dueDate: "2026-12-09" });
  const p2 = gift(at("2026-12-05"), o); // due Dec 9 = deadline
  assert.deepEqual(extendedDueDate(p2, o, S), { ok: false, reason: "no_room" });
  const p3 = gift(at("2026-12-28"), opp()); // due Dec 31 = season end
  assert.deepEqual(extendedDueDate(p3, opp(), S), { ok: false, reason: "no_room" });
});
test("'more time' then overdue: flagged, not released", () => {
  const o = opp();
  const p = gift(at("2026-12-01"), o, { guestResponse: "more_time", dueDate: "2026-12-11", extendedOnce: true });
  assert.deepEqual(sweepAction(p, o, S, endOfDay("2026-12-11")), { kind: "flag_overdue" });
  assert.deepEqual(sweepAction({ ...p, overdueFlaggedAt: "x" }, o, S, endOfDay("2026-12-20")), null);
});

// ─── Claims open / close ─────────────────────────────────────────────────────

test("claims stop after the deadline; no deadline stops at season end", () => {
  const o = opp({ deadline: "2026-12-10" });
  assert.equal(acceptsClaims(o, [], S, at("2026-12-10", "23:00")), true);
  assert.equal(acceptsClaims(o, [], S, endOfDay("2026-12-10")), false);
  assert.equal(acceptsClaims(opp(), [], S, endOfDay("2026-12-31")), false);
});
test("volunteer closes at its event date; a January shift runs past season end", () => {
  const v = opp({ type: "volunteer", eventDate: "2027-01-09", deadline: "2027-01-09" });
  assert.equal(lastClaimDay(v, S), "2027-01-09");
  assert.equal(acceptsClaims(v, [], S, at("2027-01-05")), true);
  assert.equal(lastClaimDay(opp({ type: "volunteer", eventDate: "2026-12-19" }), S), "2026-12-19");
});
test("drafts and closed opportunities take no claims", () => {
  assert.equal(acceptsClaims(opp({ status: "draft" }), [], S, at("2026-12-01")), false);
  assert.equal(acceptsClaims(opp({ status: "closed" }), [], S, at("2026-12-01")), false);
});

// ─── Spots, counting, meter ──────────────────────────────────────────────────

test("a release returns the spot; the star stays; counters drop it", () => {
  const o = opp({ spots: 1 });
  const p = pledge();
  assert.equal(spotsLeft(o, [p]), 0);
  assert.equal(acceptsClaims(o, [p], S, at("2026-12-01")), false);
  const released = { ...p, status: "released" as const };
  assert.equal(spotsLeft(o, [released]), 1);
  assert.equal(isPublicStar(released), true);
  assert.equal(isCounted(released), false);
});
test("held pledges keep the spot but aren't public or counted; denied frees it", () => {
  const o = opp({ spots: 2 });
  const held = pledge({ hold: "held_moderation" });
  assert.equal(spotsLeft(o, [held]), 1);
  assert.equal(isPublicStar(held), false);
  assert.equal(isCounted(held), false);
  assert.equal(spotsLeft(o, [pledge({ hold: "denied" })]), 2);
});
test("cash meter: pledged sum, held excluded, confirmed figure overrides", () => {
  const c = opp({ id: "c", type: "cash", goalAmount: 1000 });
  const ps = [
    pledge({ id: "a", opportunityId: "c", amount: 50 }),
    pledge({ id: "b", opportunityId: "c", amount: 500, hold: "held_amount" }),
    pledge({ id: "d", opportunityId: "c", amount: 25, status: "released" }),
  ];
  assert.deepEqual(meter(c, ps), { value: 50, label: "pledged", asOf: null });
  assert.deepEqual(meter({ ...c, confirmedRaised: 420, confirmedAsOf: "2026-12-15" }, ps), { value: 420, label: "raised", asOf: "2026-12-15" });
  assert.equal(spotsLeft(c, ps), Infinity);
});
test("counters", () => {
  const v = opp({ id: "v", type: "volunteer", hoursFixed: 3 });
  const g = opp({ id: "g", type: "gift" });
  const c = opp({ id: "c", type: "cash" });
  const byId = new Map([v, g, c].map((o) => [o.id, o]));
  const ps = [
    pledge({ id: "1", opportunityId: "v" }),
    pledge({ id: "2", opportunityId: "v", hours: 2, email: "b@x.com" }),
    pledge({ id: "3", opportunityId: "g", status: "received" }),
    pledge({ id: "4", opportunityId: "g", email: "c@x.com" }),
    pledge({ id: "5", opportunityId: "c", amount: 40.5, email: "C@x.com" }),
    pledge({ id: "6", opportunityId: "c", amount: 999, hold: "held_amount", email: "d@x.com" }),
    pledge({ id: "7", opportunityId: "g", status: "released", email: "e@x.com" }),
  ];
  assert.deepEqual(counters(ps, byId), { hours: 5, dollars: 40.5, giftsPromised: 2, giftsReceived: 1, neighbors: 3 });
});

// ─── Caps ────────────────────────────────────────────────────────────────────

test("the fourth open gift pledge from one email is refused", () => {
  const g = opp({ id: "g" });
  const byId = new Map([[g.id, g]]);
  const three = [1, 2, 3].map((i) => pledge({ id: String(i), opportunityId: "g", email: "Ann@Example.com " }));
  assert.equal(capReached("ann@example.com", "gift", three.slice(0, 2), byId, S, at("2026-12-01")), false);
  assert.equal(capReached("ann@example.com", "gift", three, byId, S, at("2026-12-01")), true);
  three[0].status = "released";
  assert.equal(capReached("ann@example.com", "gift", three, byId, S, at("2026-12-01")), false);
});
test("cash cap is per Central day", () => {
  const c = opp({ id: "c", type: "cash" });
  const byId = new Map([[c.id, c]]);
  const five = [1, 2, 3, 4, 5].map((i) => pledge({ id: String(i), opportunityId: "c", createdAt: new Date(at("2026-12-01", "10:00")).toISOString() }));
  assert.equal(capReached("ann@example.com", "cash", five, byId, S, at("2026-12-01", "20:00")), true);
  assert.equal(capReached("ann@example.com", "cash", five, byId, S, at("2026-12-02", "08:00")), false);
});

// ─── Codes ───────────────────────────────────────────────────────────────────

test("codes: 6 characters, no look-alikes", () => {
  for (const bad of "0O1IL") assert.equal(CODE_ALPHABET.includes(bad), false);
  let seed = 7;
  const rand = (max: number) => (seed = (seed * 9301 + 49297) % 233280) % max;
  for (let i = 0; i < 200; i++) assert.equal(isCode(makeCode(rand)), true);
  assert.equal(isCode("K7M2QX"), true);
  assert.equal(isCode("K7M2Q0"), false);
});

// ─── Moderation ──────────────────────────────────────────────────────────────

test("moderation: profanity, links, emails and phone numbers are held", () => {
  assert.equal(needsModeration("Merry Christmas to all!", { contactInfo: true }), false);
  assert.equal(needsModeration("For my mom, who taught me this hit song", { contactInfo: true }), false);
  assert.equal(needsModeration("Classic cocktails and Cassidy", { contactInfo: true }), false);
  assert.equal(pledgeNeedsModeration("Ann", "what the fuck"), true);
  assert.equal(pledgeNeedsModeration("sh1t", null), true);
  assert.equal(pledgeNeedsModeration("Ann", "visit www.spam.com"), true);
  assert.equal(pledgeNeedsModeration("Ann", "see example.org for more"), true);
  assert.equal(pledgeNeedsModeration("Ann", "email me ann@example.com"), true);
  assert.equal(pledgeNeedsModeration("Ann", "call 630-555-0199"), true);
  assert.equal(pledgeNeedsModeration("Ann", "Happy 2026 everyone"), false);
});

// ─── Import and layout ───────────────────────────────────────────────────────

test("the demo seed validates: 3 organizations, 78 opportunities", () => {
  const raw = JSON.parse(readFileSync(join(__dirname, "../demo-seed.json"), "utf8"));
  const r = validateImport(raw, { forceDemo: true });
  assert.deepEqual(r.errors, []);
  assert.equal(r.orgs.length, 3);
  assert.equal(r.opportunities.length, 78);
  assert.equal(r.opportunities.filter((o) => o.type === "cash").length, 25);
  assert.equal(r.opportunities.filter((o) => o.type === "gift").length, 28);
  assert.equal(r.opportunities.filter((o) => o.type === "volunteer").length, 25);
  assert.ok(r.orgs.every((o) => o.isDemo) && r.opportunities.every((o) => o.isDemo));
});
test("import errors name the row and the field", () => {
  const r = validateImport({
    organizations: [{ slug: "a", name: "A" }],
    opportunities: [
      { org: "a", type: "gift", title: "Ok" },
      { org: "nope", type: "gift", title: "Bad org" },
      { org: "a", type: "cash", title: "No goal", goal_amount: "lots", give_url: "https://example.org/give" },
      { org: "a", type: "volunteer", title: "Bad date", hours_fixed: 2, event_date: "2026-13-01" },
    ],
  }, {});
  assert.ok(r.errors.some((e) => e.includes("opportunities[1]") && e.includes("org")));
  assert.ok(r.errors.some((e) => e.includes("opportunities[2]") && e.includes("goal_amount")));
  assert.ok(r.errors.some((e) => e.includes("opportunities[3]") && e.includes("event_date")));
  assert.equal(r.errors.length, 3);
});
test("auto-placed ornaments sit inside the tree, in their zone, without overlapping", () => {
  const items = [
    ...Array.from({ length: 25 }, (_, i) => ({ id: `v${i}`, zone: "volunteer" as const, x: null, y: null })),
    ...Array.from({ length: 28 }, (_, i) => ({ id: `g${i}`, zone: "gift" as const, x: null, y: null })),
    ...Array.from({ length: 25 }, (_, i) => ({ id: `c${i}`, zone: "cash" as const, x: null, y: null })),
  ];
  const pos = placeOrnaments(items);
  assert.equal(pos.size, 78);
  const all = Array.from(pos.values());
  for (const p of all) assert.ok(p.x > 0 && p.x < 100 && p.y > 0 && p.y < 100);
  for (let i = 0; i < all.length; i++)
    for (let j = i + 1; j < all.length; j++) {
      const d = Math.hypot(all[i].x - all[j].x, all[i].y - all[j].y);
      assert.ok(d >= Math.min(all[i].size, all[j].size) * 0.9, `ornaments ${i} and ${j} overlap`);
    }
});
test("stars never overlap, even at 600", () => {
  const pts = Array.from({ length: 600 }, (_, i) => starPosition(i));
  let min = Infinity;
  for (let i = 0; i < pts.length; i++)
    for (let j = i + 1; j < pts.length; j++) min = Math.min(min, Math.hypot(pts[i].x - pts[j].x, pts[i].y - pts[j].y));
  assert.ok(min > 3, `closest stars ${min}`);
});

console.log(`✓ giving tree: ${checks} checks passed`);
