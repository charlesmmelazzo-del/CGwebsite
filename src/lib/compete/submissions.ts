// ─── Cocktail Competitions — cleaning what the private-link forms send ───────
//
// Shared by the public submission endpoint and the admin editor, so both store
// exactly the same shape: known keys only, trimmed strings with sane lengths,
// and photo URLs that point at our own storage or the bundled demo art.

import type {
  Answers,
  CompEvent,
  ContestantContact,
  SponsorContact,
  SponsorProduct,
  SponsorProfile,
} from "./types";

const MAX_TEXT = 4000;

function text(v: unknown, max = MAX_TEXT): string {
  return typeof v === "string" ? v.trim().slice(0, max) : "";
}

/** Our Supabase storage, or a path inside this site. Anything else is dropped. */
export function cleanUrl(v: unknown): string {
  const s = text(v, 1000);
  if (!s) return "";
  if (s.startsWith("/compete/") || s.startsWith("/images/")) return s;
  try {
    const u = new URL(s);
    if (u.protocol === "https:" && u.hostname.endsWith(".supabase.co") && u.pathname.includes("/storage/v1/object/public/")) {
      return s;
    }
  } catch {
    // not a URL
  }
  return "";
}

/** A link a partner wants on their profile — any http(s) URL, or a bare handle. */
function cleanLink(v: unknown): string {
  const s = text(v, 300);
  if (!s) return "";
  if (/^https?:\/\//i.test(s)) return s;
  if (s.startsWith("@")) return s;
  if (/^[\w.-]+\.[a-z]{2,}(\/.*)?$/i.test(s)) return `https://${s}`;
  return s.replace(/[^\w.@-]/g, "");
}

function obj(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

function answers(v: unknown, fieldIds: string[]): Answers {
  const o = obj(v);
  const out: Answers = {};
  for (const id of fieldIds) {
    const val = text(o[id]);
    if (val) out[id] = val;
  }
  const photo = cleanUrl(o.photoUrl);
  if (photo) out.photoUrl = photo;
  return out;
}

export function cleanContestant(data: unknown, ev: Pick<CompEvent, "bartenderFields" | "cocktailFields">) {
  const d = obj(data);
  const c = obj(d.contact);
  const contact: ContestantContact = { email: text(c.email, 200), phone: text(c.phone, 40) };
  return {
    contact,
    bartender: answers(d.bartender, ev.bartenderFields.map((f) => f.id)),
    cocktail: answers(d.cocktail, ev.cocktailFields.map((f) => f.id)),
    agreed: d.agreed === true,
  };
}

export function missingContestant(
  c: ReturnType<typeof cleanContestant>,
  ev: Pick<CompEvent, "bartenderFields" | "cocktailFields">
): string[] {
  const missing: string[] = [];
  if (!c.agreed) missing.push("agreement to the rules");
  if (!c.contact.email || !c.contact.email.includes("@")) missing.push("Email Address");
  if (!c.contact.phone) missing.push("Phone Number");
  for (const f of ev.bartenderFields) if (!c.bartender[f.id]) missing.push(f.label);
  for (const f of ev.cocktailFields) if (!c.cocktail[f.id]) missing.push(f.label);
  return missing;
}

function product(v: unknown, i: number): SponsorProduct {
  const p = obj(v);
  return {
    id: text(p.id, 40) || `p${i + 1}`,
    name: text(p.name, 200),
    category: text(p.category, 200),
    origin: text(p.origin, 200),
    abv: text(p.abv, 60),
    howMade: text(p.howMade),
    tastingNotes: text(p.tastingNotes),
    photoUrl: cleanUrl(p.photoUrl),
  };
}

export function cleanSponsor(data: unknown) {
  const d = obj(data);
  const c = obj(d.contact);
  const p = obj(d.profile);
  const l = obj(p.links);
  const contact: SponsorContact = { name: text(c.name, 200), email: text(c.email, 200), phone: text(c.phone, 40) };
  const profile: SponsorProfile = {
    brandName: text(p.brandName, 200),
    logoUrl: cleanUrl(p.logoUrl),
    logoDarkUrl: cleanUrl(p.logoDarkUrl),
    tagline: text(p.tagline, 300),
    story: text(p.story),
    photos: (Array.isArray(p.photos) ? p.photos : []).map(cleanUrl).filter(Boolean).slice(0, 8),
    products: (Array.isArray(p.products) ? p.products : []).slice(0, 8).map(product).filter((x) => x.name || x.photoUrl),
    links: {
      website: cleanLink(l.website),
      instagram: cleanLink(l.instagram),
      facebook: cleanLink(l.facebook),
      tiktok: cleanLink(l.tiktok),
      whereToBuy: cleanLink(l.whereToBuy),
    },
  };
  return { contact, profile };
}

export function missingSponsor(s: ReturnType<typeof cleanSponsor>): string[] {
  const missing: string[] = [];
  if (!s.contact.name) missing.push("Contact Name");
  if (!s.contact.email || !s.contact.email.includes("@")) missing.push("Email Address");
  if (!s.profile.brandName) missing.push("Brand Name");
  if (!s.profile.logoUrl) missing.push("Logo");
  if (!s.profile.story) missing.push("Your Story");
  if (!s.profile.products?.[0]?.name) missing.push("Product Name");
  return missing;
}
