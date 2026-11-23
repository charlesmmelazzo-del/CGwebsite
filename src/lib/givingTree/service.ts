// ─── The Giving Tree — what the routes call (server only) ────────────────────

import "server-only";
import { createHash, randomBytes, randomInt } from "crypto";
import { COPY } from "./copy";
import { emailsAreTest, siteOrigin } from "./access";
import { notifyAdminRelease, sendConfirmation, sendReleaseThanks, sendReminder, type EmailCtx } from "./email";
import { pledgeNeedsModeration } from "./filter";
import { placeOrnaments, starPosition } from "./layout";
import {
  acceptsClaims, capReached, counters, dueDateFor, extendedDueDate, isPublicStar, makeCode, meter, reminderAtFor,
  spotsLeft, sweepAction, takesSpot,
} from "./rules";
import * as store from "./store";
import { centralDate } from "./time";
import type { Opportunity, Org, Pledge, PublicOpportunity, PublicOrg, PublicStar, Settings, TreeMode, TreeState } from "./types";

export class TreeError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

export interface Data {
  orgs: Org[];
  opps: Opportunity[];
  pledges: Pledge[];
  settings: Settings;
}

export async function loadAll(): Promise<Data> {
  const [orgs, opps, pledges, settings] = await Promise.all([store.list("orgs"), store.list("opps"), store.list("pledges"), store.getSettings()]);
  return { orgs, opps, pledges, settings };
}

/** Outside the sandbox, demo records don't exist. */
export function forMode(d: Data, mode: TreeMode): Data {
  if (mode === "sandbox") return d;
  return { ...d, orgs: d.orgs.filter((o) => !o.isDemo), opps: d.opps.filter((o) => !o.isDemo), pledges: d.pledges.filter((p) => !p.isDemo) };
}

export function hasDemo(d: Data): boolean {
  return d.orgs.some((o) => o.isDemo) || d.opps.some((o) => o.isDemo) || d.pledges.some((p) => p.isDemo);
}

export async function emailCtx(settings: Settings, pledgeIsDemo: boolean): Promise<EmailCtx> {
  return { origin: siteOrigin(), test: pledgeIsDemo || (await emailsAreTest()), settings };
}

// ─── Public view ─────────────────────────────────────────────────────────────

function publicOrg(o: Org): PublicOrg {
  return {
    id: o.id,
    slug: o.slug,
    name: o.name,
    description: o.description,
    logoUrl: o.logoUrl,
    website: o.website,
    phone: o.publicPhone,
    email: o.publicEmail,
    // A confidential address is never sent to the browser at all.
    address: o.hideAddress ? null : o.publicAddress,
    socialLinks: o.socialLinks ?? [],
    showOnPartners: o.showOnPartners,
  };
}

const byOrder = (a: Opportunity, b: Opportunity) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt);

export function gaveText(p: Pledge, o: Opportunity): string | null {
  if (!p.showGift) return null;
  if (o.type === "volunteer") return COPY.gaveVolunteer(o.title, p.hours ?? o.hoursFixed);
  if (o.type === "gift") return COPY.gaveGift(o.title);
  return COPY.gaveCash(o.title, p.showAmount ? p.amount : null);
}

export function starLabel(p: Pledge): string {
  if (p.displayMode === "anonymous") return COPY.anonymous;
  return (p.displayName || p.name || "").trim() || COPY.anonymous;
}

export function buildState(all: Data, mode: TreeMode, now = Date.now()): TreeState {
  const d = forMode(all, mode);
  const oppById = new Map(d.opps.map((o) => [o.id, o]));
  const orgIds = new Set(d.orgs.map((o) => o.id));

  // Positions are worked out over every live opportunity (claimed or not), so
  // one being claimed never shuffles the others around.
  const placed = d.opps.filter((o) => o.status === "live" && orgIds.has(o.orgId)).sort(byOrder);
  const positions = placeOrnaments(placed.map((o) => ({ id: o.id, zone: o.treeZone ?? o.type, x: o.treeX, y: o.treeY })));

  const opportunities: PublicOpportunity[] =
    mode === "closed"
      ? []
      : placed
          .filter((o) => acceptsClaims(o, d.pledges, d.settings, now))
          .map((o) => {
            const pos = positions.get(o.id)!;
            const m = o.type === "cash" ? meter(o, d.pledges) : null;
            const left = spotsLeft(o, d.pledges);
            return {
              id: o.id,
              orgId: o.orgId,
              type: o.type,
              zone: o.treeZone ?? o.type,
              title: o.title,
              description: o.description,
              details: o.details,
              deadline: o.deadline,
              spots: o.type === "cash" ? 0 : o.spots,
              spotsLeft: Number.isFinite(left) ? left : 0,
              x: pos.x,
              y: pos.y,
              size: pos.size,
              hoursMode: o.hoursMode,
              hoursFixed: o.hoursFixed,
              hoursMin: o.hoursMin,
              hoursMax: o.hoursMax,
              eventDate: o.eventDate,
              startTime: o.startTime,
              endTime: o.endTime,
              location: o.location,
              requirements: o.requirements,
              dropoff: o.type === "gift" ? o.dropoffInstructions || d.settings.defaultDropoff : null,
              dueIfClaimedNow: o.type === "gift" ? dueDateFor(now, o, d.settings) : null,
              goalAmount: o.goalAmount,
              meterValue: m?.value ?? null,
              meterLabel: m?.label ?? null,
              meterAsOf: m?.asOf ?? null,
              isDemo: o.isDemo,
            };
          });

  const stars: PublicStar[] = d.pledges
    .filter((p) => isPublicStar(p) && oppById.has(p.opportunityId))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    .map((p, i) => {
      const o = oppById.get(p.opportunityId)!;
      return { id: p.id, type: o.type, label: starLabel(p), note: p.note, gave: gaveText(p, o), ...starPosition(i), createdAt: p.createdAt };
    });

  return {
    mode,
    hasDemo: hasDemo(all) && mode === "sandbox",
    orgs: d.orgs.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)).map(publicOrg),
    opportunities,
    stars,
    counters: counters(d.pledges, oppById),
    defaultDropoff: d.settings.defaultDropoff,
    contactEmail: d.settings.contactEmail,
    seasonEnd: d.settings.seasonEnd,
    today: centralDate(now),
  };
}

// ─── Making a pledge (3.3–3.6, 7) ────────────────────────────────────────────

export interface PledgeInput {
  opportunityId: string;
  name: string;
  email: string | null;
  phone: string | null;
  displayMode: "named" | "anonymous";
  displayName: string | null;
  note: string | null;
  showGift: boolean;
  showAmount: boolean;
  hours: number | null;
  amount: number | null;
  consent: boolean;
}

export const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/;

function clean(s: unknown, max: number): string | null {
  if (typeof s !== "string") return null;
  const t = s.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
}

export function parsePledgeInput(body: Record<string, unknown>): PledgeInput {
  const num = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() ? Number(v) : null);
  const note = typeof body.note === "string" ? body.note.trim() : "";
  if (note.length > 200) throw new TreeError(COPY.errNote);
  return {
    opportunityId: String(body.opportunityId ?? ""),
    name: clean(body.name, 80) ?? "",
    email: clean(body.email, 200)?.toLowerCase() ?? null,
    phone: clean(body.phone, 40),
    displayMode: body.displayMode === "anonymous" ? "anonymous" : "named",
    displayName: clean(body.displayName, 40),
    note: note ? note.replace(/\s+/g, " ") : null,
    showGift: body.showGift !== false,
    showAmount: body.showAmount !== false,
    hours: num(body.hours),
    amount: num(body.amount),
    consent: body.consent === true,
  };
}

function hashIp(ip: string): string {
  const salt = process.env.SESSION_SECRET || process.env.ADMIN_PASSWORD || "giving-tree";
  return createHash("sha256").update(`${salt}:${ip}`).digest("hex").slice(0, 32);
}

const newToken = () => randomBytes(24).toString("base64url");

export interface PledgeResult {
  code: string;
  type: Opportunity["type"];
  orgName: string;
  giveUrl: string | null;
  dueDate: string | null;
  dropoff: string | null;
  star: PublicStar;
}

/**
 * Validate and record a pledge. `source` is "web" for the guest form and
 * "manual" for the admin's add-a-pledge (email optional, no caps or IP limit,
 * no moderation hold: a person typed it in).
 */
export async function createPledge(
  input: PledgeInput,
  ctx: { mode: TreeMode; source: "web" | "manual"; ip?: string; skipIpLimit?: boolean; now?: number }
): Promise<{ pledge: Pledge; result: PledgeResult }> {
  const now = ctx.now ?? Date.now();
  const all = await loadAll();
  const d = forMode(all, ctx.mode);
  const s = d.settings;
  const manual = ctx.source === "manual";

  const opp = d.opps.find((o) => o.id === input.opportunityId);
  const org = opp && d.orgs.find((o) => o.id === opp.orgId);
  if (!opp || !org) throw new TreeError(COPY.errClosed, 404);
  if (!manual && ctx.mode === "closed") throw new TreeError(COPY.errClosed, 409);
  if (!manual && !acceptsClaims(opp, d.pledges, s, now)) {
    throw new TreeError(opp.type !== "cash" && spotsLeft(opp, d.pledges) <= 0 ? COPY.errTaken : COPY.errClosed, 409);
  }
  if (manual && opp.type !== "cash" && spotsLeft(opp, d.pledges) <= 0) throw new TreeError(COPY.errTaken, 409);

  if (!input.name) throw new TreeError(COPY.errName);
  if (!manual || input.email) {
    if (!input.email || !EMAIL_RE.test(input.email)) throw new TreeError(COPY.errEmail);
  }
  let hours: number | null = null;
  let amount: number | null = null;
  if (opp.type === "volunteer") {
    const digits = (input.phone ?? "").replace(/\D/g, "");
    if (!manual && digits.length < 10) throw new TreeError(COPY.errPhone);
    if (!manual && !input.consent) throw new TreeError(COPY.errConsent);
    if (opp.hoursMode === "choose") {
      const h = input.hours;
      if (h == null || !Number.isFinite(h) || h < (opp.hoursMin ?? 0) || h > (opp.hoursMax ?? 24)) throw new TreeError(COPY.errHours);
      hours = Math.round(h * 4) / 4;
    } else {
      hours = opp.hoursFixed;
    }
  }
  if (opp.type === "cash") {
    const a = input.amount;
    if (a == null || !Number.isFinite(a) || a < 0.01 || a > 1_000_000) throw new TreeError(COPY.errAmount);
    amount = Math.round(a * 100) / 100;
  }

  const ipHash = ctx.ip ? hashIp(ctx.ip) : null;
  if (!manual) {
    const oppById = new Map(d.opps.map((o) => [o.id, o]));
    if (capReached(input.email!, opp.type, d.pledges, oppById, s, now)) throw new TreeError(COPY.errCap(s.contactEmail), 429);
    if (ipHash && !ctx.skipIpLimit) {
      const recent = all.pledges.filter((p) => p.ipHash === ipHash && now - Date.parse(p.createdAt) < 3600_000).length;
      if (recent >= s.ipPerHour) throw new TreeError(COPY.errRate(s.contactEmail), 429);
    }
  }

  const displayName = input.displayMode === "anonymous" ? null : input.displayName || input.name;
  let hold: Pledge["hold"] = "none";
  if (!manual && pledgeNeedsModeration(displayName, input.note)) hold = "held_moderation";
  else if (!manual && opp.type === "cash" && amount != null && amount > s.amountThreshold) hold = "held_amount";

  let dueDate: string | null = null;
  let reminderAt: string | null = null;
  if (opp.type === "gift") {
    dueDate = dueDateFor(now, opp, s);
    const r = reminderAtFor(now, dueDate, s);
    reminderAt = r ? new Date(r).toISOString() : null;
  }

  const nowIso = new Date(now).toISOString();
  const base: Partial<Pledge> = {
    opportunityId: opp.id,
    name: input.name,
    email: input.email,
    phone: opp.type === "volunteer" ? input.phone : null,
    displayMode: input.displayMode,
    displayName,
    note: input.note,
    showGift: input.showGift,
    showAmount: opp.type === "cash" ? input.showAmount : true,
    hours,
    amount,
    hold,
    dueDate,
    reminderAt,
    source: ctx.source,
    consentShare: opp.type === "volunteer" ? input.consent || manual : false,
    consentAt: opp.type === "volunteer" && input.consent ? nowIso : null,
    ipHash,
    // Everything a guest makes in the sandbox is test data, wiped with the
    // demo data. A manual pledge is a real person unless its opportunity is demo.
    isDemo: opp.isDemo || (ctx.mode === "sandbox" && !manual),
    createdAt: nowIso,
  };

  // A unique code, retrying on the (rare) clash.
  const taken = new Set(all.pledges.map((p) => p.code));
  let pledge: Pledge | null = null;
  for (let attempt = 0; attempt < 6 && !pledge; attempt++) {
    let code = makeCode(randomInt);
    while (taken.has(code)) code = makeCode(randomInt);
    try {
      [pledge] = await store.insert("pledges", [{ ...base, code, manageToken: newToken() }]);
    } catch (e) {
      if (!/duplicate|unique/i.test(String((e as Error).message))) throw e;
      taken.add(code);
    }
  }
  if (!pledge) throw new TreeError(COPY.errGeneric, 500);

  // Two people tapping the last spot at the same moment: the earlier pledge
  // keeps it, the later one is undone.
  if (opp.type !== "cash") {
    const fresh = (await store.list("pledges")).filter((p) => p.opportunityId === opp.id && takesSpot(p));
    fresh.sort((a, b) => a.createdAt.localeCompare(b.createdAt) || a.id.localeCompare(b.id));
    const mine = fresh.findIndex((p) => p.id === pledge!.id);
    if (mine >= (opp.spots || 1)) {
      await store.remove("pledges", [pledge.id]);
      throw new TreeError(COPY.errTaken, 409);
    }
  }

  await sendConfirmation(pledge, opp, org, await emailCtx(s, pledge.isDemo));

  return {
    pledge,
    result: {
      code: pledge.code,
      type: opp.type,
      orgName: org.name,
      giveUrl: opp.type === "cash" ? opp.giveUrl : null,
      dueDate,
      dropoff: opp.type === "gift" ? opp.dropoffInstructions || s.defaultDropoff : null,
      star: { id: pledge.id, type: opp.type, label: starLabel(pledge), note: pledge.note, gave: gaveText(pledge, opp), x: 0, y: 0, createdAt: nowIso },
    },
  };
}

// ─── After a pledge (5, 6) ───────────────────────────────────────────────────

export async function releasePledge(p: Pledge, reason: "guest" | "auto" | "admin", d?: Data): Promise<void> {
  if (p.status === "released") return;
  const data = d ?? (await loadAll());
  await store.update("pledges", [p.id], { status: "released", releasedAt: new Date().toISOString(), releaseReason: reason });
  const opp = data.opps.find((o) => o.id === p.opportunityId);
  const org = opp && data.orgs.find((o) => o.id === opp.orgId);
  if (!opp || !org) return;
  const ctx = await emailCtx(data.settings, p.isDemo);
  if (reason !== "admin") {
    await sendReleaseThanks(p, opp, ctx);
    await notifyAdminRelease(p, opp, org, reason, ctx);
  }
}

export async function findByToken(token: string): Promise<{ pledge: Pledge; opp: Opportunity; org: Org; data: Data } | null> {
  if (!/^[A-Za-z0-9_-]{20,64}$/.test(token)) return null;
  const data = await loadAll();
  const pledge = data.pledges.find((p) => p.manageToken === token);
  const opp = pledge && data.opps.find((o) => o.id === pledge.opportunityId);
  const org = opp && data.orgs.find((o) => o.id === opp.orgId);
  return pledge && opp && org ? { pledge, opp, org, data } : null;
}

export async function guestAction(token: string, action: "release" | "more" | "still"): Promise<{ ok: true; message: string; dueDate?: string }> {
  const found = await findByToken(token);
  if (!found) throw new TreeError(COPY.manageNotFound, 404);
  const { pledge, opp, data } = found;

  if (action === "release") {
    if (pledge.status !== "pledged") throw new TreeError(COPY.errClosed, 409);
    await releasePledge(pledge, "guest", data);
    return { ok: true, message: COPY.manageReleasedBody };
  }
  if (action === "more") {
    const r = extendedDueDate(pledge, opp, data.settings);
    if (!r.ok) throw new TreeError(r.reason === "already" ? COPY.manageAlreadyExtended : COPY.errClosed, 409);
    await store.update("pledges", [pledge.id], { dueDate: r.dueDate, extendedOnce: true, guestResponse: "more_time" });
    return { ok: true, message: COPY.manageExtended(r.dueDate), dueDate: r.dueDate };
  }
  if (opp.type !== "gift" || pledge.status !== "pledged") throw new TreeError(COPY.errClosed, 409);
  await store.update("pledges", [pledge.id], { guestResponse: "still_on_it" });
  return { ok: true, message: COPY.manageStillOnItDone };
}

// ─── The sweep: reminders, auto-release, closing (4) ─────────────────────────
//
// The site has no scheduler (Railway, no cron). Like pop-up launches, gift
// timing is resolved when pages are loaded: every tree, sky, admin and manage
// page load runs the sweep (at most once a minute per server). The
// /api/giving-tree/sweep endpoint does the same for an outside timer, if one
// is ever added, so reminders go out on time on a quiet day.

const g = globalThis as unknown as { __givingTreeSweptAt?: number; __givingTreeSweeping?: Promise<SweepReport> };

export interface SweepReport {
  reminded: number;
  released: number;
  notReceived: number;
  flagged: number;
}

export async function sweep(opts: { force?: boolean; now?: number } = {}): Promise<SweepReport | null> {
  const now = opts.now ?? Date.now();
  if (!opts.force && g.__givingTreeSweptAt && now - g.__givingTreeSweptAt < 60_000) return null;
  if (g.__givingTreeSweeping) return g.__givingTreeSweeping;
  g.__givingTreeSweptAt = now;
  g.__givingTreeSweeping = (async () => {
    const report: SweepReport = { reminded: 0, released: 0, notReceived: 0, flagged: 0 };
    const data = await loadAll();
    const oppById = new Map(data.opps.map((o) => [o.id, o]));
    for (const p of data.pledges) {
      const opp = oppById.get(p.opportunityId);
      if (!opp) continue;
      const action = sweepAction(p, opp, data.settings, now);
      if (!action) continue;
      try {
        if (action.kind === "remind") {
          // Mark first, so a slow email can never send twice.
          await store.update("pledges", [p.id], { reminderSentAt: new Date(now).toISOString() });
          await sendReminder(p, opp, await emailCtx(data.settings, p.isDemo));
          report.reminded++;
        } else if (action.kind === "release") {
          await releasePledge(p, "auto", data);
          report.released++;
        } else if (action.kind === "not_received") {
          await store.update("pledges", [p.id], { status: "not_received" });
          report.notReceived++;
        } else if (action.kind === "flag_overdue") {
          await store.update("pledges", [p.id], { overdueFlaggedAt: new Date(now).toISOString() });
          report.flagged++;
        }
      } catch (e) {
        console.error("[giving-tree sweep]", p.code, action.kind, e);
      }
    }
    return report;
  })();
  try {
    return await g.__givingTreeSweeping;
  } finally {
    g.__givingTreeSweeping = undefined;
  }
}

/** Run the sweep without ever failing the page that triggered it. */
export async function sweepQuietly(): Promise<void> {
  try {
    await sweep();
  } catch (e) {
    if (!(e instanceof store.TreeNotSetUp)) console.error("[giving-tree sweep]", e);
  }
}
