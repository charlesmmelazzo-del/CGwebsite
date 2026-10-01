import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { bustLiveCache, getCodes, getContestants, getEventById, getSponsors, RESERVED_SLUGS, slugify } from "@/lib/compete/data";
import { cleanUrl } from "@/lib/compete/submissions";
import type { FieldDef, Recipe, ScoreCategory, Superlative, Tier } from "@/lib/compete/types";

// Protected by the middleware matcher on /api/admin/:path*.

export const dynamic = "force-dynamic";

/** GET — one competition with everything the editor needs. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const [sponsors, contestants, codes] = await Promise.all([
    getSponsors(ev.id),
    getContestants(ev.id),
    getCodes(ev.id),
  ]);
  return NextResponse.json({ event: ev, sponsors, contestants, codes });
}

const STATUSES = ["draft", "published", "live", "finished"];
const s = (v: unknown, max = 4000) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const id = (v: unknown, fallback: string) => s(v, 40).replace(/[^a-z0-9_-]/gi, "") || fallback;

function fields(v: unknown, current: FieldDef[]): FieldDef[] {
  if (!Array.isArray(v)) return current;
  const out = v.map((f, i): FieldDef => ({
    id: id(f?.id, `f${i}`),
    label: s(f?.label, 300) || "Untitled question",
    hint: s(f?.hint, 600) || undefined,
    type: f?.type === "text" ? "text" : "textarea",
    role: f?.role === "name" || f?.role === "bar" ? f.role : undefined,
  }));
  // The fields guest screens rely on can be relabelled, never removed.
  for (const keep of current.filter((f) => f.role)) {
    if (!out.some((f) => f.role === keep.role)) out.unshift(keep);
  }
  return out;
}

const labelled = <T extends { id: string; label: string }>(v: unknown, current: T[]): T[] =>
  Array.isArray(v)
    ? (v.map((x, i) => ({ id: id(x?.id, `c${i}`), label: s(x?.label, 120) || "Untitled" })) as T[])
    : current;

function tiers(v: unknown, current: Tier[]): Tier[] {
  if (!Array.isArray(v)) return current;
  return v.map((t, i) => ({
    id: id(t?.id, `tier${i}`),
    label: s(t?.label, 80) || "Tier",
    weight: Math.max(0, Math.min(100, Number(t?.weight) || 0)),
    isJudge: Boolean(t?.isJudge),
    count: Math.max(0, Math.min(2000, Math.round(Number(t?.count) || 0))),
  }));
}

function recipes(v: unknown, current: Recipe[]): Recipe[] {
  if (!Array.isArray(v)) return current;
  return v.slice(0, 40).map((r, i) => ({
    id: id(r?.id, `r${i}`),
    name: s(r?.name, 200),
    description: s(r?.description, 600) || undefined,
    photoUrl: cleanUrl(r?.photoUrl) || undefined,
    ingredients: s(r?.ingredients),
    method: s(r?.method),
  }));
}

/** PATCH — save settings. Only the keys sent are changed. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = (await req.json().catch(() => ({}))) as Record<string, unknown>;
  const u: Record<string, unknown> = {};

  if ("name" in b) u.name = s(b.name, 120) || ev.name;
  if ("slug" in b) {
    const slug = slugify(s(b.slug, 80));
    if (RESERVED_SLUGS.includes(slug)) {
      return NextResponse.json({ error: `“${slug}” is reserved — choose a different link.` }, { status: 400 });
    }
    if (slug && slug !== ev.slug) {
      const { data } = await getSupabaseAdmin().from("comp_events").select("id").eq("slug", slug).maybeSingle();
      if (data) return NextResponse.json({ error: "Another competition already uses that link." }, { status: 409 });
      u.slug = slug;
    }
  }
  if ("featuredSpirit" in b) u.featured_spirit = s(b.featuredSpirit, 120);
  if ("eventDate" in b) u.event_date = s(b.eventDate, 10) || null;
  if ("startTime" in b) u.start_time = s(b.startTime, 40);
  if ("arrivalTime" in b) u.arrival_time = s(b.arrivalTime, 40);
  if ("location" in b) u.location = s(b.location, 200);
  if ("contactEmail" in b) u.contact_email = s(b.contactEmail, 200);
  if ("intro" in b) u.intro = s(b.intro);
  if ("accentColor" in b) u.accent_color = /^#[0-9a-f]{6}$/i.test(s(b.accentColor)) ? s(b.accentColor) : ev.accentColor;
  if ("status" in b && STATUSES.includes(String(b.status))) u.status = b.status;
  if ("contestantDeadline" in b) u.contestant_deadline = s(b.contestantDeadline, 40) || null;
  if ("partnerDeadline" in b) u.partner_deadline = s(b.partnerDeadline, 40) || null;
  if ("rulesText" in b) u.rules_text = s(b.rulesText, 20000);
  if ("bigScreen" in b) u.big_screen = Boolean(b.bigScreen);
  if ("bartenderFields" in b) u.bartender_fields = fields(b.bartenderFields, ev.bartenderFields);
  if ("cocktailFields" in b) u.cocktail_fields = fields(b.cocktailFields, ev.cocktailFields);
  if ("scoreCategories" in b) u.score_categories = labelled<ScoreCategory>(b.scoreCategories, ev.scoreCategories);
  if ("superlatives" in b) u.superlatives = labelled<Superlative>(b.superlatives, ev.superlatives);
  if ("tiers" in b) u.tiers = tiers(b.tiers, ev.tiers);
  if ("recipes" in b) u.recipes = recipes(b.recipes, ev.recipes);

  u.updated_at = new Date().toISOString();
  const { error } = await getSupabaseAdmin().from("comp_events").update(u).eq("id", ev.id);
  if (error) {
    console.error("[admin/competitions PATCH]", error);
    return NextResponse.json({ error: "Couldn’t save." }, { status: 500 });
  }
  bustLiveCache(ev.slug);
  return NextResponse.json({ event: await getEventById(ev.id) });
}

/** DELETE — remove a competition and everything in it. */
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  const { error } = await getSupabaseAdmin().from("comp_events").delete().eq("id", params.id);
  if (error) return NextResponse.json({ error: "Couldn’t delete." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
