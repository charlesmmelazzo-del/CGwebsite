// ─── Bulk import (9.3) ───────────────────────────────────────────────────────
//
// Takes JSON in the format of src/lib/givingTree/demo-seed.json and checks
// every row before anything is written. Errors name the row and the field, so
// whoever prepared the file can fix it quickly. Pure: committing is done by
// the server (service.ts) after the admin has seen the preview.

import { isDate, isTime } from "./time";
import { OPP_TYPES, type Opportunity, type Org, type OppType } from "./types";

export type ImportOrg = Omit<Org, "id" | "createdAt" | "updatedAt" | "sortOrder">;
export type ImportOpp = Omit<Opportunity, "id" | "orgId" | "createdAt" | "updatedAt" | "treeX" | "treeY" | "treeZone" | "sortOrder"> & {
  orgSlug: string;
  row: number;
};

export interface ImportResult {
  errors: string[];
  orgs: ImportOrg[];
  opportunities: ImportOpp[];
}

type Rec = Record<string, unknown>;

const SLUG = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t ? t : null;
}

function isUrl(v: string): boolean {
  try {
    const u = new URL(v);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

export function validateImport(raw: unknown, opts: { forceDemo?: boolean; knownOrgSlugs?: string[] }): ImportResult {
  const errors: string[] = [];
  const orgs: ImportOrg[] = [];
  const opportunities: ImportOpp[] = [];

  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { errors: ["The file must be a JSON object with \"organizations\" and \"opportunities\" lists."], orgs, opportunities };
  }
  const root = raw as Rec;
  const orgList = root.organizations ?? [];
  const oppList = root.opportunities ?? [];
  if (!Array.isArray(orgList)) errors.push("\"organizations\" must be a list.");
  if (!Array.isArray(oppList)) errors.push("\"opportunities\" must be a list.");
  if (errors.length) return { errors, orgs, opportunities };

  const slugs = new Set<string>(opts.knownOrgSlugs ?? []);

  (orgList as unknown[]).forEach((item, i) => {
    const r = (item ?? {}) as Rec;
    const where = `organizations[${i}]${typeof r.name === "string" ? ` ("${r.name}")` : ""}`;
    const err = (field: string, msg: string) => errors.push(`${where}: ${field} ${msg}`);
    const slug = str(r.slug);
    const name = str(r.name);
    if (!slug) err("slug", "is required.");
    else if (!SLUG.test(slug)) err("slug", "must be lower-case letters, numbers and dashes.");
    if (!name) err("name", "is required.");
    const website = str(r.website);
    if (website && !isUrl(website)) err("website", "must be a full web address starting with https://.");
    const logo = str(r.logo);
    if (logo && !isUrl(logo) && !logo.startsWith("/")) err("logo", "must be a web address.");
    const email = str(r.public_email);
    if (email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) err("public_email", "doesn't look like an email address.");
    const adminEmail = str(r.admin_contact_email);
    if (adminEmail && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(adminEmail)) err("admin_contact_email", "doesn't look like an email address.");
    const social = r.social_links ?? [];
    if (!Array.isArray(social) || social.some((s) => typeof s !== "string" || !isUrl(s))) err("social_links", "must be a list of web addresses.");
    if (slug && orgs.some((o) => o.slug === slug)) err("slug", `"${slug}" appears twice in this file.`);
    if (slug) slugs.add(slug);
    if (slug && name) {
      orgs.push({
        slug,
        name,
        description: str(r.description),
        logoUrl: logo,
        website,
        publicPhone: str(r.public_phone),
        publicEmail: email,
        publicAddress: str(r.public_address),
        hideAddress: r.hide_address === true,
        socialLinks: Array.isArray(social) ? (social as string[]) : [],
        publicContactNote: str(r.public_contact_note),
        adminContactName: str(r.admin_contact_name),
        adminContactEmail: adminEmail,
        showOnPartners: r.show_on_partners !== false,
        isDemo: opts.forceDemo ? true : r.is_demo === true,
      });
    }
  });

  (oppList as unknown[]).forEach((item, i) => {
    const r = (item ?? {}) as Rec;
    const where = `opportunities[${i}]${typeof r.title === "string" ? ` ("${r.title}")` : ""}`;
    const before = errors.length;
    const err = (field: string, msg: string) => errors.push(`${where}: ${field} ${msg}`);

    const orgSlug = str(r.org);
    if (!orgSlug) err("org", "is required (the organization's slug).");
    else if (!slugs.has(orgSlug)) err("org", `"${orgSlug}" isn't an organization in this file or on the site.`);
    const type = r.type as OppType;
    if (!OPP_TYPES.includes(type)) err("type", "must be volunteer, gift or cash.");
    const title = str(r.title);
    if (!title) err("title", "is required.");
    else if (title.length > 80) err("title", "is longer than 80 characters (it goes on the front of an ornament).");

    const status = (str(r.status) ?? "live") as Opportunity["status"];
    if (!["draft", "live", "closed"].includes(status)) err("status", "must be draft, live or closed.");

    const date = (field: string): string | null => {
      const v = r[field];
      if (v == null || v === "") return null;
      if (!isDate(v)) {
        err(field, "must be a date written YYYY-MM-DD.");
        return null;
      }
      return v;
    };
    const time = (field: string): string | null => {
      const v = r[field];
      if (v == null || v === "") return null;
      if (!isTime(v)) {
        err(field, "must be a time written HH:MM (24-hour).");
        return null;
      }
      return v;
    };
    const num = (field: string, { min = 0, required = false } = {}): number | null => {
      const v = r[field];
      if (v == null || v === "") {
        if (required) err(field, "is required.");
        return null;
      }
      if (typeof v !== "number" || !Number.isFinite(v) || v < min) {
        err(field, `must be a number${min > 0 ? ` of at least ${min}` : ""}.`);
        return null;
      }
      return v;
    };

    const deadline = date("deadline");
    const spotsRaw = r.spots == null ? 1 : r.spots;
    let spots = 1;
    if (type !== "cash") {
      if (typeof spotsRaw !== "number" || !Number.isInteger(spotsRaw) || spotsRaw < 1) err("spots", "must be a whole number of at least 1.");
      else spots = spotsRaw;
    }

    let hoursMode: Opportunity["hoursMode"] = null;
    let hoursFixed: number | null = null, hoursMin: number | null = null, hoursMax: number | null = null;
    let eventDate: string | null = null, startTime: string | null = null, endTime: string | null = null;
    if (type === "volunteer") {
      hoursMode = (str(r.hours_mode) ?? "fixed") as "fixed" | "choose";
      if (hoursMode !== "fixed" && hoursMode !== "choose") err("hours_mode", "must be fixed or choose.");
      if (hoursMode === "fixed") hoursFixed = num("hours_fixed", { min: 0.25, required: true });
      if (hoursMode === "choose") {
        hoursMin = num("hours_min", { min: 0.25, required: true });
        hoursMax = num("hours_max", { min: 0.25, required: true });
        if (hoursMin != null && hoursMax != null && hoursMax < hoursMin) err("hours_max", "must be at least hours_min.");
      }
      eventDate = date("event_date");
      startTime = time("start_time");
      endTime = time("end_time");
    }

    let goalAmount: number | null = null;
    let giveUrl: string | null = null;
    let confirmedRaised: number | null = null;
    let confirmedAsOf: string | null = null;
    if (type === "cash") {
      goalAmount = num("goal_amount", { min: 1, required: true });
      giveUrl = str(r.give_url);
      if (!giveUrl) err("give_url", "is required (the organization's own giving page).");
      else if (!isUrl(giveUrl)) err("give_url", "must be a full web address starting with https://.");
      confirmedRaised = num("confirmed_raised");
      confirmedAsOf = date("confirmed_as_of");
    }

    if (errors.length > before || !orgSlug || !title) return;
    opportunities.push({
      row: i,
      orgSlug,
      type,
      title,
      description: str(r.description),
      details: str(r.details),
      status,
      deadline,
      spots,
      hoursMode,
      hoursFixed,
      hoursMin,
      hoursMax,
      eventDate,
      startTime,
      endTime,
      location: type === "volunteer" ? str(r.location) : null,
      requirements: type === "volunteer" ? str(r.requirements) : null,
      dropoffInstructions: type === "gift" ? str(r.dropoff_instructions) : null,
      goalAmount,
      giveUrl,
      confirmedRaised,
      confirmedAsOf,
      isDemo: opts.forceDemo ? true : r.is_demo === true,
    });
  });

  return { errors, orgs, opportunities };
}
