// ─── The Giving Tree — admin operations (server only) ────────────────────────
//
// Everything behind Admin → Pop Ups → Giving Tree. The admin routes are
// protected by the existing admin login (middleware.ts guards /api/admin/*).

import "server-only";
import demoSeedJson from "./demo-seed.json";
import { validateImport, type ImportResult } from "./importer";
import { acceptsClaims, isOverdueForReview, lastClaimDay, meter, normalizeCode, spotsLeft, takesSpot } from "./rules";
import { createPledge, gaveText, loadAll, parsePledgeInput, releasePledge, starLabel, sweepQuietly, TreeError, type Data } from "./service";
import * as store from "./store";
import { centralDate, isDate, isTime } from "./time";
import { DEFAULT_SETTINGS, OPP_TYPES, type Opportunity, type Org, type Pledge, type Settings } from "./types";

// ─── Snapshot for the admin screens ──────────────────────────────────────────

export type AdminOpp = Opportunity & {
  orgName: string;
  taken: number;
  left: number | null;
  open: boolean;
  lastDay: string;
  meterValue: number | null;
  meterLabel: string | null;
};

export type AdminPledge = Pledge & {
  oppTitle: string;
  oppType: Opportunity["type"];
  orgId: string;
  orgName: string;
  label: string;
  gave: string | null;
  overdue: boolean;
};

export interface Snapshot {
  orgs: Org[];
  opps: AdminOpp[];
  pledges: AdminPledge[];
  settings: Settings;
  hasDemo: boolean;
  memoryMode: boolean;
}

export async function snapshot(now = Date.now()): Promise<Snapshot> {
  await sweepQuietly();
  const d = await loadAll();
  const orgById = new Map(d.orgs.map((o) => [o.id, o]));
  const oppById = new Map(d.opps.map((o) => [o.id, o]));
  const opps: AdminOpp[] = d.opps
    .slice()
    .sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt))
    .map((o) => {
      const m = o.type === "cash" ? meter(o, d.pledges) : null;
      const left = spotsLeft(o, d.pledges);
      return {
        ...o,
        orgName: orgById.get(o.orgId)?.name ?? "?",
        taken: d.pledges.filter((p) => p.opportunityId === o.id && takesSpot(p)).length,
        left: Number.isFinite(left) ? left : null,
        open: acceptsClaims(o, d.pledges, d.settings, now),
        lastDay: lastClaimDay(o, d.settings),
        meterValue: m?.value ?? null,
        meterLabel: m?.label ?? null,
      };
    });
  const pledges: AdminPledge[] = d.pledges
    .slice()
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .map((p) => {
      const o = oppById.get(p.opportunityId);
      return {
        ...p,
        oppTitle: o?.title ?? "?",
        oppType: o?.type ?? "gift",
        orgId: o?.orgId ?? "",
        orgName: (o && orgById.get(o.orgId)?.name) ?? "?",
        label: starLabel(p),
        gave: o ? gaveText({ ...p, showGift: true, showAmount: true }, o) : null,
        overdue: isOverdueForReview(p, o, now),
      };
    });
  const hasDemo = d.orgs.some((o) => o.isDemo) || d.opps.some((o) => o.isDemo) || d.pledges.some((p) => p.isDemo);
  return { orgs: d.orgs.slice().sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name)), opps, pledges, settings: d.settings, hasDemo, memoryMode: store.memoryMode };
}

// ─── Input cleaning ──────────────────────────────────────────────────────────

type Rec = Record<string, unknown>;
const s = (v: unknown, max = 2000): string | null => (typeof v === "string" && v.trim() ? v.trim().slice(0, max) : null);
const n = (v: unknown): number | null => {
  if (v === null || v === undefined || v === "") return null;
  const x = typeof v === "number" ? v : Number(v);
  return Number.isFinite(x) ? x : null;
};
const date = (v: unknown, field: string): string | null => {
  const t = s(v, 10);
  if (!t) return null;
  if (!isDate(t)) throw new TreeError(`${field} must be a date (YYYY-MM-DD).`);
  return t;
};
const time = (v: unknown, field: string): string | null => {
  const t = s(v, 5);
  if (!t) return null;
  if (!isTime(t)) throw new TreeError(`${field} must be a time (HH:MM).`);
  return t;
};
const url = (v: unknown, field: string): string | null => {
  const t = s(v, 500);
  if (!t) return null;
  if (!/^https?:\/\/\S+$/.test(t)) throw new TreeError(`${field} must be a full web address starting with https://.`);
  return t;
};

// ─── Organizations ───────────────────────────────────────────────────────────

export async function saveOrg(b: Rec): Promise<Org> {
  const name = s(b.name, 120);
  if (!name) throw new TreeError("Name is required.");
  const slug = (s(b.slug, 60) ?? name).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const social = Array.isArray(b.socialLinks) ? b.socialLinks : typeof b.socialLinks === "string" ? b.socialLinks.split(/\s+/) : [];
  const fields: Partial<Org> = {
    name,
    slug,
    description: s(b.description, 2000),
    logoUrl: s(b.logoUrl, 500),
    website: url(b.website, "Website"),
    publicPhone: s(b.publicPhone, 40),
    publicEmail: s(b.publicEmail, 200),
    publicAddress: s(b.publicAddress, 300),
    hideAddress: b.hideAddress === true,
    socialLinks: social.map((x) => String(x).trim()).filter(Boolean).map((x) => url(x, "Social link")!),
    publicContactNote: s(b.publicContactNote, 1000),
    adminContactName: s(b.adminContactName, 120),
    adminContactEmail: s(b.adminContactEmail, 200),
    showOnPartners: b.showOnPartners !== false,
  };
  const all = await store.list("orgs");
  if (all.some((o) => o.slug === slug && o.id !== b.id)) throw new TreeError(`Another organization already uses the slug "${slug}".`);
  if (b.id) {
    await store.update("orgs", [String(b.id)], fields);
    return (await store.list("orgs")).find((o) => o.id === b.id)!;
  }
  const [made] = await store.insert("orgs", [{ ...fields, sortOrder: all.length, isDemo: false }]);
  return made;
}

// ─── Opportunities ───────────────────────────────────────────────────────────

export async function saveOpp(b: Rec): Promise<void> {
  const type = b.type as Opportunity["type"];
  if (!OPP_TYPES.includes(type)) throw new TreeError("Pick a type.");
  const title = s(b.title, 80);
  if (!title) throw new TreeError("Title is required (it goes on the front of the ornament).");
  const orgs = await store.list("orgs");
  if (!orgs.some((o) => o.id === b.orgId)) throw new TreeError("Pick an organization.");
  const status = ["draft", "live", "closed"].includes(String(b.status)) ? (b.status as Opportunity["status"]) : "draft";
  const spots = type === "cash" ? 1 : Math.max(1, Math.round(n(b.spots) ?? 1));
  const hoursMode = type === "volunteer" ? (b.hoursMode === "choose" ? "choose" : "fixed") : null;
  const fields: Partial<Opportunity> = {
    orgId: String(b.orgId),
    type,
    title,
    description: s(b.description),
    details: s(b.details),
    status,
    deadline: date(b.deadline, "Deadline"),
    spots,
    treeZone: OPP_TYPES.includes(b.treeZone as Opportunity["type"]) ? (b.treeZone as Opportunity["type"]) : null,
    treeX: n(b.treeX),
    treeY: n(b.treeY),
    hoursMode,
    hoursFixed: hoursMode === "fixed" ? n(b.hoursFixed) : null,
    hoursMin: hoursMode === "choose" ? n(b.hoursMin) : null,
    hoursMax: hoursMode === "choose" ? n(b.hoursMax) : null,
    eventDate: type === "volunteer" ? date(b.eventDate, "Event date") : null,
    startTime: type === "volunteer" ? time(b.startTime, "Start time") : null,
    endTime: type === "volunteer" ? time(b.endTime, "End time") : null,
    location: type === "volunteer" ? s(b.location, 300) : null,
    requirements: type === "volunteer" ? s(b.requirements) : null,
    dropoffInstructions: type === "gift" ? s(b.dropoffInstructions) : null,
    goalAmount: type === "cash" ? n(b.goalAmount) : null,
    giveUrl: type === "cash" ? url(b.giveUrl, "Give URL") : null,
    confirmedRaised: type === "cash" ? n(b.confirmedRaised) : null,
    confirmedAsOf: type === "cash" ? date(b.confirmedAsOf, "Confirmed as-of date") : null,
  };
  if (type === "volunteer" && hoursMode === "fixed" && !fields.hoursFixed) throw new TreeError("Hours are required for a fixed shift.");
  if (type === "volunteer" && hoursMode === "choose" && (!fields.hoursMin || !fields.hoursMax || fields.hoursMax < fields.hoursMin)) {
    throw new TreeError("Set the fewest and most hours a volunteer can choose.");
  }
  if (type === "cash" && (!fields.goalAmount || !fields.giveUrl)) throw new TreeError("Cash opportunities need a goal amount and the organization's giving link.");
  if (fields.treeX != null && (fields.treeX < 0 || fields.treeX > 100)) throw new TreeError("Tree position must be between 0 and 100.");
  if (fields.treeY != null && (fields.treeY < 0 || fields.treeY > 100)) throw new TreeError("Tree position must be between 0 and 100.");

  if (b.id) {
    await store.update("opps", [String(b.id)], fields);
    return;
  }
  const org = orgs.find((o) => o.id === b.orgId)!;
  const count = (await store.list("opps")).length;
  await store.insert("opps", [{ ...fields, sortOrder: count, isDemo: org.isDemo }]);
}

export async function duplicateOpp(id: string): Promise<void> {
  const opps = await store.list("opps");
  const o = opps.find((x) => x.id === id);
  if (!o) throw new TreeError("Not found.", 404);
  const { id: _id, createdAt: _c, updatedAt: _u, ...rest } = o;
  void _id; void _c; void _u;
  await store.insert("opps", [{ ...rest, title: `${o.title} (copy)`.slice(0, 80), status: "draft", treeX: null, treeY: null, sortOrder: opps.length }]);
}

export async function reorderOpps(ids: string[]): Promise<void> {
  for (let i = 0; i < ids.length; i++) await store.update("opps", [ids[i]], { sortOrder: i });
}

// ─── Pledges ─────────────────────────────────────────────────────────────────

async function pledgeById(id: string): Promise<{ p: Pledge; d: Data }> {
  const d = await loadAll();
  const p = d.pledges.find((x) => x.id === id);
  if (!p) throw new TreeError("Pledge not found.", 404);
  return { p, d };
}

export async function pledgeAction(id: string, action: string, b: Rec): Promise<void> {
  const { p, d } = await pledgeById(id);
  const now = new Date().toISOString();
  switch (action) {
    case "edit": {
      const displayMode = b.displayMode === "anonymous" ? "anonymous" : "named";
      const note = typeof b.note === "string" ? b.note.trim().slice(0, 200) : p.note;
      await store.update("pledges", [id], {
        name: s(b.name, 80) ?? p.name,
        email: b.email === undefined ? p.email : s(b.email, 200)?.toLowerCase() ?? null,
        phone: b.phone === undefined ? p.phone : s(b.phone, 40),
        displayMode,
        displayName: displayMode === "anonymous" ? null : s(b.displayName, 40) ?? p.name,
        note: note || null,
      });
      return;
    }
    case "hide":
      return store.update("pledges", [id], { hidden: true });
    case "unhide":
      return store.update("pledges", [id], { hidden: false });
    case "approve":
      return store.update("pledges", [id], { hold: "none" });
    case "deny":
      // No email is sent on deny (5.2).
      return store.update("pledges", [id], { hold: "denied" });
    case "release":
      return releasePledge(p, "admin", d);
    case "received":
      // Works on a released pledge too: two gifts for one need is fine (4).
      return store.update("pledges", [id], { status: "received", receivedAt: now });
    case "delivered":
      return store.update("pledges", [id], { status: "delivered", deliveredAt: now, receivedAt: p.receivedAt ?? now });
    case "restore":
      return store.update("pledges", [id], { status: "pledged", releasedAt: null, releaseReason: null, hidden: false, hold: p.hold === "denied" ? "none" : p.hold, overdueFlaggedAt: null });
    case "hung":
      return store.update("pledges", [id], { ornament: "hung", hungAt: now });
    case "unhung":
      return store.update("pledges", [id], { ornament: "to_write", hungAt: null });
    case "dismiss_overdue":
      // Mike has seen it; keep waiting.
      return store.update("pledges", [id], { overdueFlaggedAt: now, guestResponse: "still_on_it", dueDate: s(b.dueDate, 10) ?? p.dueDate });
    default:
      throw new TreeError("Unknown action.");
  }
}

export async function manualPledge(b: Rec): Promise<Pledge> {
  const input = parsePledgeInput({ ...b, consent: true });
  const { pledge } = await createPledge(input, { mode: "sandbox", source: "manual" });
  if (b.markReceived === true) await store.update("pledges", [pledge.id], { status: "received", receivedAt: new Date().toISOString() });
  return pledge;
}

export async function findByCode(raw: string): Promise<string | null> {
  const code = normalizeCode(raw);
  const p = (await store.list("pledges")).find((x) => x.code === code);
  return p?.id ?? null;
}

// ─── Import and demo data (9.3, 10) ──────────────────────────────────────────

export async function previewImport(raw: unknown, forceDemo = false): Promise<ImportResult & { existingOrgSlugs: string[]; duplicates: number[] }> {
  const [orgs, opps] = await Promise.all([store.list("orgs"), store.list("opps")]);
  const r = validateImport(raw, { forceDemo, knownOrgSlugs: orgs.map((o) => o.slug) });
  const slugToId = new Map(orgs.map((o) => [o.slug, o.id]));
  // Already on the site (same organization, type, title and date): skipped.
  const duplicates = r.opportunities
    .filter((o) => opps.some((x) => x.orgId === slugToId.get(o.orgSlug) && x.type === o.type && x.title === o.title && x.eventDate === o.eventDate && x.deadline === o.deadline))
    .map((o) => o.row);
  return { ...r, existingOrgSlugs: r.orgs.filter((o) => slugToId.has(o.slug)).map((o) => o.slug), duplicates };
}

export async function commitImport(raw: unknown, forceDemo = false): Promise<{ orgsCreated: number; orgsUpdated: number; oppsCreated: number; skipped: number }> {
  const preview = await previewImport(raw, forceDemo);
  if (preview.errors.length) throw new TreeError(`Fix these first: ${preview.errors.slice(0, 5).join(" ")}`);
  const existing = await store.list("orgs");
  const slugToId = new Map(existing.map((o) => [o.slug, o.id]));
  let orgsCreated = 0, orgsUpdated = 0;
  for (const o of preview.orgs) {
    const id = slugToId.get(o.slug);
    if (id) {
      await store.update("orgs", [id], o);
      orgsUpdated++;
    } else {
      const [made] = await store.insert("orgs", [{ ...o, sortOrder: existing.length + orgsCreated }]);
      slugToId.set(o.slug, made.id);
      orgsCreated++;
    }
  }
  const skip = new Set(preview.duplicates);
  const base = (await store.list("opps")).length;
  const rows = preview.opportunities
    .filter((o) => !skip.has(o.row))
    .map((o, i) => {
      const { orgSlug, row: _row, ...rest } = o;
      void _row;
      return { ...rest, orgId: slugToId.get(orgSlug)!, sortOrder: base + i };
    });
  for (let i = 0; i < rows.length; i += 100) await store.insert("opps", rows.slice(i, i + 100));
  return { orgsCreated, orgsUpdated, oppsCreated: rows.length, skipped: skip.size };
}

export function demoSeed(): unknown {
  return structuredClone(demoSeedJson);
}

/** Delete demo organizations, their opportunities, and every pledge made against them or in the sandbox. */
export async function wipeDemo(): Promise<{ orgs: number; opps: number; pledges: number }> {
  const d = await loadAll();
  const demoOrgs = d.orgs.filter((o) => o.isDemo).map((o) => o.id);
  const demoOpps = d.opps.filter((o) => o.isDemo || demoOrgs.includes(o.orgId)).map((o) => o.id);
  const demoPledges = d.pledges.filter((p) => p.isDemo || demoOpps.includes(p.opportunityId)).map((p) => p.id);
  await store.remove("pledges", demoPledges);
  await store.remove("opps", demoOpps);
  await store.remove("orgs", demoOrgs);
  return { orgs: demoOrgs.length, opps: demoOpps.length, pledges: demoPledges.length };
}

export async function demoExists(): Promise<boolean> {
  const d = await loadAll();
  return d.orgs.some((o) => o.isDemo) || d.opps.some((o) => o.isDemo) || d.pledges.some((p) => p.isDemo);
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function saveSettings(b: Rec): Promise<Settings> {
  const cur = await store.getSettings();
  const int = (v: unknown, min: number, max: number, fallback: number) => {
    const x = n(v);
    return x == null ? fallback : Math.min(max, Math.max(min, Math.round(x)));
  };
  const next: Settings = {
    seasonEnd: date(b.seasonEnd, "Season end") ?? cur.seasonEnd,
    dueWindowDays: int(b.dueWindowDays, 1, 60, cur.dueWindowDays),
    reminderLeadDays: int(b.reminderLeadDays, 0, 30, cur.reminderLeadDays),
    graceDays: int(b.graceDays, 0, 30, cur.graceDays),
    amountThreshold: Math.max(0, n(b.amountThreshold) ?? cur.amountThreshold),
    capOpenGift: int(b.capOpenGift, 1, 100, cur.capOpenGift),
    capOpenVolunteer: int(b.capOpenVolunteer, 1, 100, cur.capOpenVolunteer),
    capCashPerDay: int(b.capCashPerDay, 1, 100, cur.capCashPerDay),
    ipPerHour: int(b.ipPerHour, 1, 10000, cur.ipPerHour),
    defaultDropoff: s(b.defaultDropoff) ?? DEFAULT_SETTINGS.defaultDropoff,
    contactEmail: s(b.contactEmail, 200) ?? DEFAULT_SETTINGS.contactEmail,
  };
  await store.saveSettings(next);
  return next;
}

// ─── Exports (9.10) ──────────────────────────────────────────────────────────

/** "2026-12-01 14:05" in Central time, for spreadsheets. */
function central(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const date = centralDate(d);
  const t = d.toLocaleTimeString("en-US", { timeZone: "America/Chicago", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  return `${date} ${t}`;
}

function csv(rows: (string | number | null | undefined)[][]): string {
  const cell = (v: string | number | null | undefined) => {
    let t = v == null ? "" : String(v);
    // Never let a spreadsheet run a cell as a formula.
    if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`;
    return /[",\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  return "﻿" + rows.map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export async function exportCsv(kind: string, opts: { orgId?: string; includeDemo?: boolean }): Promise<{ filename: string; body: string }> {
  const d = await loadAll();
  const oppById = new Map(d.opps.map((o) => [o.id, o]));
  const orgById = new Map(d.orgs.map((o) => [o.id, o]));
  const keep = (p: Pledge) => opts.includeDemo || !p.isDemo;

  if (kind === "volunteers") {
    const org = opts.orgId ? orgById.get(opts.orgId) : undefined;
    if (!org) throw new TreeError("Pick an organization.");
    const rows: (string | number | null)[][] = [
      ["organization", "opportunity title", "description", "event date", "start", "end", "location", "hours", "volunteer name", "email", "phone", "code", "pledged at", "status"],
    ];
    for (const p of d.pledges) {
      const o = oppById.get(p.opportunityId);
      if (!o || o.orgId !== org.id || o.type !== "volunteer" || p.hold === "denied") continue;
      rows.push([org.name, o.title, o.description, o.eventDate, o.startTime, o.endTime, o.location, p.hours ?? o.hoursFixed, p.name, p.email, p.phone, p.code, central(p.createdAt), p.status]);
    }
    return { filename: `volunteers-${org.slug}.csv`, body: csv(rows) };
  }

  if (kind === "pledges") {
    const rows: (string | number | null | undefined)[][] = [
      ["code", "created at", "source", "organization", "type", "opportunity", "name", "email", "phone", "display", "display name", "note", "hours", "amount", "status", "hold", "hidden", "due date", "reminder sent", "guest response", "released at", "release reason", "received at", "delivered at", "ornament", "demo"],
    ];
    for (const p of d.pledges.filter(keep)) {
      const o = oppById.get(p.opportunityId);
      rows.push([p.code, central(p.createdAt), p.source, o ? orgById.get(o.orgId)?.name : "", o?.type, o?.title, p.name, p.email, p.phone, p.displayMode, p.displayName, p.note, p.hours, p.amount, p.status, p.hold, p.hidden ? "yes" : "", p.dueDate, central(p.reminderSentAt), p.guestResponse, central(p.releasedAt), p.releaseReason, central(p.receivedAt), central(p.deliveredAt), p.ornament, p.isDemo ? "yes" : ""]);
    }
    return { filename: "giving-tree-pledges.csv", body: csv(rows) };
  }

  if (kind === "recap") {
    const people = new Map<string, { name: string; email: string; gave: string[] }>();
    for (const p of d.pledges.filter(keep)) {
      if (!p.email || p.hold === "denied") continue;
      const o = oppById.get(p.opportunityId);
      if (!o) continue;
      const key = p.email.trim().toLowerCase();
      const entry = people.get(key) ?? { name: p.name, email: key, gave: [] };
      const what = gaveText({ ...p, showGift: true, showAmount: true }, o) ?? o.title;
      entry.gave.push(p.status === "released" ? `${what} (released)` : what);
      people.set(key, entry);
    }
    const rows: string[][] = [["name", "email", "what they gave"]];
    people.forEach((v) => rows.push([v.name, v.email, v.gave.join("; ")]));
    return { filename: "giving-tree-recap.csv", body: csv(rows) };
  }

  throw new TreeError("Unknown export.");
}

/** Season close (9.13): every phone number deleted, permanently. */
export async function closeOutSeason(): Promise<number> {
  return store.clearPhones();
}

export async function seedLoaded(): Promise<boolean> {
  const slugs = new Set((await store.list("orgs")).map((o) => o.slug));
  const seed = demoSeed() as { organizations: { slug: string }[] };
  return seed.organizations.every((o) => slugs.has(o.slug));
}

