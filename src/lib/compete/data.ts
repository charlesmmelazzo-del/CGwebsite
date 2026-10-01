// ─── Cocktail Competitions — database access (server only) ───────────────────
//
// Every read and write goes through the service-role client; the comp_* tables
// have RLS on with no policies, so nothing is reachable from the browser.

import { randomBytes, randomInt } from "node:crypto";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getSiteConfig } from "@/lib/siteconfig";
import {
  DEFAULT_ACCENT,
  DEFAULT_BARTENDER_FIELDS,
  DEFAULT_COCKTAIL_FIELDS,
  DEFAULT_CONTACT_EMAIL,
  DEFAULT_LOCATION,
  DEFAULT_RULES_TEXT,
  DEFAULT_SCORE_CATEGORIES,
  DEFAULT_SUPERLATIVES,
  DEFAULT_TIERS,
} from "./defaults";
import { contestantScore, leaders, resolveWinner, superlativeLeaders, type Ballot } from "./scoring";
import {
  EMPTY_LIVE_STATE,
  type CompCode,
  type CompEvent,
  type Contestant,
  type LiveState,
  type PublicEvent,
  type Sponsor,
} from "./types";

type Row = Record<string, unknown>;

const arr = <T,>(v: unknown, fallback: T[]): T[] => (Array.isArray(v) ? (v as T[]) : fallback);
const obj = <T,>(v: unknown): T => (v && typeof v === "object" && !Array.isArray(v) ? (v as T) : ({} as T));
const str = (v: unknown) => (typeof v === "string" ? v : "");

export function mapEvent(r: Row): CompEvent {
  return {
    id: str(r.id),
    slug: str(r.slug),
    name: str(r.name),
    featuredSpirit: str(r.featured_spirit),
    eventDate: (r.event_date as string | null) ?? null,
    startTime: str(r.start_time),
    arrivalTime: str(r.arrival_time),
    location: str(r.location) || DEFAULT_LOCATION,
    contactEmail: str(r.contact_email) || DEFAULT_CONTACT_EMAIL,
    intro: str(r.intro),
    accentColor: str(r.accent_color) || DEFAULT_ACCENT,
    status: (str(r.status) || "draft") as CompEvent["status"],
    isDemo: Boolean(r.is_demo),
    contestantDeadline: (r.contestant_deadline as string | null) ?? null,
    partnerDeadline: (r.partner_deadline as string | null) ?? null,
    rulesText: str(r.rules_text) || DEFAULT_RULES_TEXT,
    bartenderFields: arr(r.bartender_fields, DEFAULT_BARTENDER_FIELDS),
    cocktailFields: arr(r.cocktail_fields, DEFAULT_COCKTAIL_FIELDS),
    scoreCategories: arr(r.score_categories, DEFAULT_SCORE_CATEGORIES),
    superlatives: arr(r.superlatives, DEFAULT_SUPERLATIVES),
    tiers: arr(r.tiers, DEFAULT_TIERS),
    recipes: arr(r.recipes, []),
    bigScreen: Boolean(r.big_screen),
    hostToken: str(r.host_token),
    liveState: { ...EMPTY_LIVE_STATE, ...obj<LiveState>(r.live_state) },
    liveVersion: Number(r.live_version) || 0,
  };
}

function mapSponsor(r: Row): Sponsor {
  return {
    id: str(r.id),
    eventId: str(r.event_id),
    token: str(r.token),
    sort: Number(r.sort) || 0,
    isPrimary: Boolean(r.is_primary),
    label: str(r.label),
    status: (str(r.status) || "invited") as Sponsor["status"],
    adminNote: str(r.admin_note),
    contact: obj(r.contact),
    profile: obj(r.profile),
    reopened: Boolean(r.reopened),
    submittedAt: (r.submitted_at as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
  };
}

function mapContestant(r: Row): Contestant {
  return {
    id: str(r.id),
    eventId: str(r.event_id),
    token: str(r.token),
    sort: Number(r.sort) || 0,
    label: str(r.label),
    status: (str(r.status) || "invited") as Contestant["status"],
    adminNote: str(r.admin_note),
    contact: obj(r.contact),
    bartender: obj(r.bartender),
    cocktail: obj(r.cocktail),
    agreedAt: (r.agreed_at as string | null) ?? null,
    reopened: Boolean(r.reopened),
    submittedAt: (r.submitted_at as string | null) ?? null,
    approvedAt: (r.approved_at as string | null) ?? null,
  };
}

function mapCode(r: Row): CompCode {
  return {
    id: str(r.id),
    code: str(r.code),
    tierId: str(r.tier_id),
    name: str(r.name),
    claimed: Boolean(r.device_secret),
    claimedAt: (r.claimed_at as string | null) ?? null,
  };
}

// ─── Tokens & codes ──────────────────────────────────────────────────────────

/** Unguessable link token for contestant / partner / host links. */
export function newToken(): string {
  return randomBytes(18).toString("base64url");
}

/** No 0/O, 1/I/L — codes get read off paper in a dim bar. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function newTicketCode(): string {
  let s = "";
  for (let i = 0; i < 6; i++) s += CODE_ALPHABET[randomInt(CODE_ALPHABET.length)];
  return s;
}

/** Codes are typed off a paper ticket — ignore case, spaces and dashes. */
export function normalizeCode(input: string): string {
  return input.toUpperCase().replace(/[^A-Z0-9]/g, "");
}

/** Addresses under /compete that belong to the site, not to an event. */
export const RESERVED_SLUGS = ["showcase", "contestant", "partner"];

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

// ─── Events ──────────────────────────────────────────────────────────────────

export async function listEvents(): Promise<CompEvent[]> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb.from("comp_events").select("*").order("event_date", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(mapEvent);
}

export async function getEventById(id: string): Promise<CompEvent | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("comp_events").select("*").eq("id", id).maybeSingle();
  return data ? mapEvent(data) : null;
}

export async function getEventBySlug(slug: string): Promise<CompEvent | null> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("comp_events").select("*").eq("slug", slug).maybeSingle();
  return data ? mapEvent(data) : null;
}

export async function createEvent(input: { name: string; isDemo?: boolean }): Promise<CompEvent> {
  const sb = getSupabaseAdmin();
  const base = slugify(input.name) || "competition";
  let slug = RESERVED_SLUGS.includes(base) ? `${base}-event` : base;
  for (let i = 2; i < 50; i++) {
    const { data } = await sb.from("comp_events").select("id").eq("slug", slug).maybeSingle();
    if (!data) break;
    slug = `${base}-${i}`;
  }
  const { data, error } = await sb
    .from("comp_events")
    .insert({
      slug,
      name: input.name,
      is_demo: Boolean(input.isDemo),
      rules_text: DEFAULT_RULES_TEXT,
      bartender_fields: DEFAULT_BARTENDER_FIELDS,
      cocktail_fields: DEFAULT_COCKTAIL_FIELDS,
      score_categories: DEFAULT_SCORE_CATEGORIES,
      superlatives: DEFAULT_SUPERLATIVES,
      tiers: DEFAULT_TIERS,
      host_token: newToken(),
      live_state: EMPTY_LIVE_STATE,
    })
    .select("*")
    .single();
  if (error) throw error;
  return mapEvent(data);
}

// ─── Sponsors & contestants ──────────────────────────────────────────────────

export async function getSponsors(eventId: string): Promise<Sponsor[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("comp_sponsors").select("*").eq("event_id", eventId).order("sort");
  return (data ?? []).map(mapSponsor);
}

export async function getContestants(eventId: string): Promise<Contestant[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("comp_contestants").select("*").eq("event_id", eventId).order("sort");
  return (data ?? []).map(mapContestant);
}

export async function getSponsorByToken(token: string): Promise<Sponsor | null> {
  if (!token) return null;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("comp_sponsors").select("*").eq("token", token).maybeSingle();
  return data ? mapSponsor(data) : null;
}

export async function getContestantByToken(token: string): Promise<Contestant | null> {
  if (!token) return null;
  const sb = getSupabaseAdmin();
  const { data } = await sb.from("comp_contestants").select("*").eq("token", token).maybeSingle();
  return data ? mapContestant(data) : null;
}

/** Is a submission link still open for edits? */
export function submissionLocked(
  s: { status: Contestant["status"]; reopened: boolean },
  deadline: string | null
): "approved" | "closed" | null {
  if (s.status === "approved") return "approved";
  // A note sent back after the deadline keeps the link open until they resubmit.
  if (s.status === "changes_requested" || s.reopened) return null;
  if (deadline && new Date(deadline).getTime() < Date.now()) return "closed";
  return null;
}

// ─── Codes ───────────────────────────────────────────────────────────────────

export async function getCodes(eventId: string): Promise<CompCode[]> {
  const sb = getSupabaseAdmin();
  // Codes generated together share a timestamp, so add the code as a
  // tie-breaker — otherwise judges reshuffle between host refreshes.
  const { data } = await sb.from("comp_codes").select("*").eq("event_id", eventId).order("created_at").order("code");
  return (data ?? []).map(mapCode);
}

/** Top each tier up to its configured count. Never deletes existing codes. */
export async function generateCodes(ev: CompEvent): Promise<number> {
  const sb = getSupabaseAdmin();
  const existing = await getCodes(ev.id);
  const taken = new Set(existing.map((c) => c.code));
  const rows: Row[] = [];
  for (const tier of ev.tiers) {
    const have = existing.filter((c) => c.tierId === tier.id).length;
    for (let i = have; i < tier.count; i++) {
      let code = newTicketCode();
      while (taken.has(code)) code = newTicketCode();
      taken.add(code);
      rows.push({ event_id: ev.id, code, tier_id: tier.id });
    }
  }
  if (rows.length) {
    const { error } = await sb.from("comp_codes").insert(rows);
    if (error) throw error;
  }
  return rows.length;
}

// ─── Public (guest-facing) event ─────────────────────────────────────────────

export async function getCommonGoodLogo(): Promise<string> {
  try {
    const cfg = await getSiteConfig();
    return cfg.header.logoUrl || "/images/logo/logo.svg";
  } catch {
    return "/images/logo/logo.svg";
  }
}

/** Only approved sponsors and contestants ever reach guests. */
export async function getPublicEvent(ev: CompEvent): Promise<PublicEvent> {
  const [sponsors, contestants, logo] = await Promise.all([
    getSponsors(ev.id),
    getContestants(ev.id),
    getCommonGoodLogo(),
  ]);
  return {
    id: ev.id,
    slug: ev.slug,
    name: ev.name,
    featuredSpirit: ev.featuredSpirit,
    eventDate: ev.eventDate,
    startTime: ev.startTime,
    location: ev.location,
    intro: ev.intro,
    accentColor: ev.accentColor,
    status: ev.status,
    bartenderFields: ev.bartenderFields,
    cocktailFields: ev.cocktailFields,
    scoreCategories: ev.scoreCategories,
    superlatives: ev.superlatives,
    recipes: ev.recipes,
    bigScreen: ev.bigScreen,
    sponsors: sponsors
      .filter((s) => s.status === "approved")
      .sort((a, b) => Number(b.isPrimary) - Number(a.isPrimary) || a.sort - b.sort)
      .map((s) => ({ id: s.id, isPrimary: s.isPrimary, profile: s.profile })),
    contestants: contestants
      .filter((c) => c.status === "approved")
      .map((c) => ({ id: c.id, sort: c.sort, bartender: c.bartender, cocktail: c.cocktail })),
    commonGoodLogo: logo,
  };
}

/** Competitions for the public events page. */
export async function getEventsPageCompetitions(): Promise<{
  current: Array<Pick<CompEvent, "slug" | "name" | "featuredSpirit" | "eventDate" | "startTime" | "status" | "accentColor"> & { logoUrl?: string }>;
  past: Array<Pick<CompEvent, "slug" | "name" | "featuredSpirit" | "eventDate" | "accentColor"> & { logoUrl?: string; winner?: string }>;
}> {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb
      .from("comp_events")
      .select("*")
      .in("status", ["published", "live", "finished"])
      // Demo events work by link but never appear to customers — staging and
      // the live site share one database.
      .eq("is_demo", false)
      .order("event_date", { ascending: false });
    const events = (data ?? []).map(mapEvent);
    const ids = events.map((e) => e.id);
    const { data: sp } = ids.length
      ? await sb.from("comp_sponsors").select("event_id, profile, is_primary, status").in("event_id", ids)
      : { data: [] as Row[] };
    const logoFor = (id: string) => {
      const rows = (sp ?? []).filter((r) => r.event_id === id && r.status === "approved");
      const primary = rows.find((r) => r.is_primary) ?? rows[0];
      return (primary?.profile as { logoUrl?: string } | undefined)?.logoUrl;
    };
    const { data: cs } = ids.length
      ? await sb.from("comp_contestants").select("id, bartender, cocktail").in("event_id", ids)
      : { data: [] as Row[] };
    const winnerName = (ev: CompEvent) => {
      const w = ev.liveState.revealed?.find((r) => r.key === "overall");
      if (!w) return undefined;
      const c = (cs ?? []).find((r) => r.id === w.contestantId);
      const b = obj<Record<string, string>>(c?.bartender);
      return b.name ? `${b.name}${b.bar ? ` · ${b.bar}` : ""}` : undefined;
    };
    return {
      current: events
        .filter((e) => e.status === "published" || e.status === "live")
        .reverse()
        .map((e) => ({
          slug: e.slug,
          name: e.name,
          featuredSpirit: e.featuredSpirit,
          eventDate: e.eventDate,
          startTime: e.startTime,
          status: e.status,
          accentColor: e.accentColor,
          logoUrl: logoFor(e.id),
        })),
      past: events
        .filter((e) => e.status === "finished")
        .map((e) => ({
          slug: e.slug,
          name: e.name,
          featuredSpirit: e.featuredSpirit,
          eventDate: e.eventDate,
          accentColor: e.accentColor,
          logoUrl: logoFor(e.id),
          winner: winnerName(e),
        })),
    };
  } catch {
    return { current: [], past: [] };
  }
}

// ─── Live state ──────────────────────────────────────────────────────────────
//
// Every guest phone polls the live state every ~1.5s. A short in-process cache
// means a room of 150 phones costs the database one read a second, not 100.

type CacheEntry = { at: number; ev: CompEvent };
const liveCache = new Map<string, CacheEntry>();
const LIVE_TTL_MS = 900;

export async function getEventCached(slug: string): Promise<CompEvent | null> {
  const hit = liveCache.get(slug);
  if (hit && Date.now() - hit.at < LIVE_TTL_MS) return hit.ev;
  const ev = await getEventBySlug(slug);
  if (ev) liveCache.set(slug, { at: Date.now(), ev });
  return ev;
}

/** Thrown when someone else changed the live state between our read and write. */
export class LiveConflict extends Error {}

/**
 * Save the host's change — but only if nobody else changed the show since we
 * read it. Two taps landing together (a double-tap, or host links open on two
 * devices) used to overwrite each other and silently drop one action; now the
 * loser gets a LiveConflict and applyHostAction re-applies it on fresh state.
 */
export async function saveLiveState(ev: CompEvent, next: LiveState, extra: Row = {}): Promise<CompEvent> {
  const sb = getSupabaseAdmin();
  const { data, error } = await sb
    .from("comp_events")
    .update({ live_state: next, live_version: ev.liveVersion + 1, updated_at: new Date().toISOString(), ...extra })
    .eq("id", ev.id)
    .eq("live_version", ev.liveVersion)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new LiveConflict();
  const saved = mapEvent(data);
  liveCache.set(saved.slug, { at: Date.now(), ev: saved });
  return saved;
}

export function bustLiveCache(slug: string) {
  liveCache.delete(slug);
}

// ─── Votes & results ─────────────────────────────────────────────────────────

type VoteRow = { code_id: string; contestant_id: string; scores: Record<string, number> };
type PickRow = { code_id: string; superlative_id: string; contestant_id: string };

export async function getVotes(eventId: string, contestantId?: string): Promise<VoteRow[]> {
  const sb = getSupabaseAdmin();
  let q = sb.from("comp_votes").select("code_id, contestant_id, scores").eq("event_id", eventId);
  if (contestantId) q = q.eq("contestant_id", contestantId);
  const { data } = await q;
  return (data ?? []) as VoteRow[];
}

export async function getSuperlativePicks(eventId: string): Promise<PickRow[]> {
  const sb = getSupabaseAdmin();
  const { data } = await sb
    .from("comp_superlative_votes")
    .select("code_id, superlative_id, contestant_id")
    .eq("event_id", eventId);
  return (data ?? []) as PickRow[];
}

export type ResultItem = {
  key: string;
  label: string;
  /** Contestants tied for the lead (one = clear winner, none = no votes). */
  leaders: string[];
  winner: string | null;
};

export type FullResults = {
  items: ResultItem[];
  /** Admin-only detail. Never sent to guests or the host. */
  scores: Array<{ contestantId: string; overall: number | null; tiers: { tierId: string; ballots: number; average: number | null }[] }>;
  superlativeCounts: Record<string, Record<string, number>>;
};

/** Compute every result. Reveal order: superlatives first, overall winner last. */
export async function computeResults(ev: CompEvent, contestants: Contestant[]): Promise<FullResults> {
  const approved = contestants.filter((c) => c.status === "approved");
  const [votes, picks, codes] = await Promise.all([getVotes(ev.id), getSuperlativePicks(ev.id), getCodes(ev.id)]);
  const tierOf = new Map(codes.map((c) => [c.id, c.tierId]));

  const scores = approved.map((c) => {
    const ballots: Ballot[] = votes
      .filter((v) => v.contestant_id === c.id && tierOf.has(v.code_id))
      .map((v) => ({ tierId: tierOf.get(v.code_id)!, scores: v.scores ?? {} }));
    return { contestantId: c.id, ...contestantScore(ballots, ev.tiers, ev.scoreCategories) };
  });

  const tieBreaks = ev.liveState.tieBreaks ?? {};
  const items: ResultItem[] = [];
  const superlativeCounts: FullResults["superlativeCounts"] = {};
  const approvedIds = new Set(approved.map((c) => c.id));

  for (const s of ev.superlatives) {
    const list = picks.filter((p) => p.superlative_id === s.id && approvedIds.has(p.contestant_id)).map((p) => p.contestant_id);
    const counts: Record<string, number> = {};
    for (const id of list) counts[id] = (counts[id] ?? 0) + 1;
    superlativeCounts[s.id] = counts;
    const lead = superlativeLeaders(list);
    items.push({ key: s.id, label: s.label, leaders: lead, winner: resolveWinner(lead, tieBreaks[s.id]) });
  }

  const overallLead = leaders(new Map(scores.map((s) => [s.contestantId, s.overall])));
  items.push({
    key: "overall",
    label: "Overall Winner",
    leaders: overallLead,
    winner: resolveWinner(overallLead, tieBreaks.overall),
  });

  return { items, scores, superlativeCounts };
}

/** Judges' ballots for one contestant, by name, for the big reveal. */
export async function judgeCards(ev: CompEvent, contestantId: string) {
  const judgeTiers = new Set(ev.tiers.filter((t) => t.isJudge).map((t) => t.id));
  const [codes, votes] = await Promise.all([getCodes(ev.id), getVotes(ev.id, contestantId)]);
  const judges = codes.filter((c) => judgeTiers.has(c.tierId));
  return judges
    .map((j, i) => {
      const v = votes.find((x) => x.code_id === j.id);
      return v ? { name: j.name || `Judge ${i + 1}`, scores: v.scores ?? {} } : null;
    })
    .filter((x): x is { name: string; scores: Record<string, number> } => x !== null);
}
