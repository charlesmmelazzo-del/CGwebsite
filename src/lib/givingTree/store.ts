// ─── The Giving Tree — storage (server only) ─────────────────────────────────
//
// Thin read/write layer over the four giving_tree_* tables (db/giving-tree.sql).
// The service layer loads whole tables and applies the rules in rules.ts:
// a season is a few hundred rows, so this stays simple and keeps every rule in
// one testable place.
//
// GIVING_TREE_MEMORY=1 (local development only) keeps everything in memory
// instead, so the pop-up can be tried without a database. It is ignored in
// production builds.

import "server-only";
import { getSupabaseAdmin } from "@/lib/supabase";
import { DEFAULT_SETTINGS, type Opportunity, type Org, type Pledge, type Settings } from "./types";

export const TABLES = {
  orgs: "giving_tree_orgs",
  opps: "giving_tree_opportunities",
  pledges: "giving_tree_pledges",
  settings: "giving_tree_settings",
} as const;

type TableKey = "orgs" | "opps" | "pledges";
type RowOf<K extends TableKey> = K extends "orgs" ? Org : K extends "opps" ? Opportunity : Pledge;

export const memoryMode = process.env.NODE_ENV !== "production" && process.env.GIVING_TREE_MEMORY === "1";

/** Thrown when db/giving-tree.sql hasn't been run yet. */
export class TreeNotSetUp extends Error {}

const NUMERIC = new Set(["treeX", "treeY", "hoursFixed", "hoursMin", "hoursMax", "goalAmount", "confirmedRaised", "hours", "amount"]);

const toCamel = (k: string) => k.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
const toSnake = (k: string) => k.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

function fromRow<T>(r: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(r)) {
    const key = toCamel(k);
    out[key] = NUMERIC.has(key) && v != null ? Number(v) : v;
  }
  return out as T;
}

function toRow(o: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(o)) if (v !== undefined) out[toSnake(k)] = v;
  return out;
}

function check(error: { code?: string; message?: string } | null) {
  if (!error) return;
  if (error.code === "42P01" || error.code === "PGRST205" || /giving_tree_/.test(error.message ?? "") && /exist|schema cache/.test(error.message ?? "")) {
    throw new TreeNotSetUp("giving_tree tables missing — run db/giving-tree.sql");
  }
  throw new Error(error.message);
}

// ─── Memory (local development) ──────────────────────────────────────────────

type Mem = { orgs: Org[]; opps: Opportunity[]; pledges: Pledge[]; settings: Partial<Settings> };
const g = globalThis as unknown as { __givingTreeMem?: Mem };
function mem(): Mem {
  if (!g.__givingTreeMem) g.__givingTreeMem = { orgs: [], opps: [], pledges: [], settings: {} };
  return g.__givingTreeMem;
}

const ORG_DEFAULTS = {
  description: null, logoUrl: null, website: null, publicPhone: null, publicEmail: null, publicAddress: null,
  hideAddress: false, socialLinks: [], publicContactNote: null, adminContactName: null, adminContactEmail: null,
  showOnPartners: true, sortOrder: 0, isDemo: false,
};
const OPP_DEFAULTS = {
  description: null, details: null, status: "draft", deadline: null, spots: 1, treeZone: null, treeX: null, treeY: null,
  sortOrder: 0, hoursMode: null, hoursFixed: null, hoursMin: null, hoursMax: null, eventDate: null, startTime: null,
  endTime: null, location: null, requirements: null, dropoffInstructions: null, goalAmount: null, giveUrl: null,
  confirmedRaised: null, confirmedAsOf: null, isDemo: false,
};
const PLEDGE_DEFAULTS = {
  email: null, phone: null, displayMode: "named", displayName: null, note: null, showGift: true, showAmount: true,
  hours: null, amount: null, status: "pledged", hold: "none", hidden: false, dueDate: null, reminderAt: null,
  reminderSentAt: null, guestResponse: null, extendedOnce: false, releasedAt: null, releaseReason: null,
  overdueFlaggedAt: null, receivedAt: null, deliveredAt: null, ornament: "to_write", hungAt: null, source: "web",
  consentShare: false, consentAt: null, ipHash: null, isDemo: false,
};
const DEFAULTS: Record<TableKey, Record<string, unknown>> = { orgs: ORG_DEFAULTS, opps: OPP_DEFAULTS, pledges: PLEDGE_DEFAULTS };

// ─── Generic table access ────────────────────────────────────────────────────

export async function list<K extends TableKey>(table: K): Promise<RowOf<K>[]> {
  if (memoryMode) return structuredClone(mem()[table]) as RowOf<K>[];
  const sb = getSupabaseAdmin();
  const out: RowOf<K>[] = [];
  // Page through so a big season never hits the API's row limit.
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(TABLES[table]).select("*").order("created_at", { ascending: true }).range(from, from + 999);
    check(error);
    out.push(...(data ?? []).map((r) => fromRow<RowOf<K>>(r)));
    if (!data || data.length < 1000) break;
  }
  return out;
}

export async function insert<K extends TableKey>(table: K, rows: Partial<RowOf<K>>[]): Promise<RowOf<K>[]> {
  if (!rows.length) return [];
  if (memoryMode) {
    const now = new Date().toISOString();
    const made = rows.map((r) => ({ ...DEFAULTS[table], id: crypto.randomUUID(), createdAt: now, updatedAt: now, ...r }) as unknown as RowOf<K>);
    for (const m of made) {
      if (table === "pledges") {
        const p = m as Pledge;
        if (mem().pledges.some((x) => x.code === p.code || x.manageToken === p.manageToken)) throw new Error("duplicate key value violates unique constraint");
      }
      if (table === "orgs" && mem().orgs.some((x) => x.slug === (m as Org).slug)) throw new Error("duplicate key value violates unique constraint");
    }
    (mem()[table] as RowOf<K>[]).push(...made);
    return structuredClone(made);
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES[table]).insert(rows.map((r) => toRow(r as Record<string, unknown>))).select("*");
  check(error);
  return (data ?? []).map((r) => fromRow<RowOf<K>>(r));
}

export async function update<K extends TableKey>(table: K, ids: string[], patch: Partial<RowOf<K>>): Promise<void> {
  if (!ids.length) return;
  const stamped = { ...patch, updatedAt: new Date().toISOString() };
  if (memoryMode) {
    for (const r of mem()[table] as RowOf<K>[]) if (ids.includes(r.id)) Object.assign(r, stamped);
    return;
  }
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb.from(TABLES[table]).update(toRow(stamped as Record<string, unknown>)).in("id", ids.slice(i, i + 200));
    check(error);
  }
}

export async function remove(table: TableKey, ids: string[]): Promise<void> {
  if (!ids.length) return;
  if (memoryMode) {
    const m = mem();
    if (table === "orgs") {
      const opps = m.opps.filter((o) => ids.includes(o.orgId)).map((o) => o.id);
      m.pledges = m.pledges.filter((p) => !opps.includes(p.opportunityId));
      m.opps = m.opps.filter((o) => !ids.includes(o.orgId));
      m.orgs = m.orgs.filter((o) => !ids.includes(o.id));
    } else if (table === "opps") {
      m.pledges = m.pledges.filter((p) => !ids.includes(p.opportunityId));
      m.opps = m.opps.filter((o) => !ids.includes(o.id));
    } else {
      m.pledges = m.pledges.filter((p) => !ids.includes(p.id));
    }
    return;
  }
  const sb = getSupabaseAdmin();
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb.from(TABLES[table]).delete().in("id", ids.slice(i, i + 200));
    check(error);
  }
}

/**
 * Set a column back to null for every row where it is set — used at season
 * close to delete every phone number.
 */
export async function clearPhones(): Promise<number> {
  if (memoryMode) {
    let n = 0;
    for (const p of mem().pledges) if (p.phone) (p.phone = null), n++;
    return n;
  }
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.pledges).update({ phone: null, updated_at: new Date().toISOString() }).not("phone", "is", null).select("id");
  check(error);
  return data?.length ?? 0;
}

// ─── Settings ────────────────────────────────────────────────────────────────

export async function getSettings(): Promise<Settings> {
  if (memoryMode) return { ...DEFAULT_SETTINGS, ...mem().settings };
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from(TABLES.settings).select("data").eq("id", 1).maybeSingle();
  check(error);
  return { ...DEFAULT_SETTINGS, ...((data?.data as Partial<Settings>) ?? {}) };
}

export async function saveSettings(s: Settings): Promise<void> {
  if (memoryMode) {
    mem().settings = { ...s };
    return;
  }
  const sb = getSupabaseAdmin();
  const { error } = await sb.from(TABLES.settings).upsert({ id: 1, data: s, updated_at: new Date().toISOString() });
  check(error);
}
