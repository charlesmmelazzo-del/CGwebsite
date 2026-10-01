import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventById, newToken } from "@/lib/compete/data";
import { cleanContestant, cleanSponsor } from "@/lib/compete/submissions";

// Protected by the middleware matcher on /api/admin/:path*.
// Contestants and brand partners ("entries") — invite, edit, approve.

export const dynamic = "force-dynamic";

const table = (kind: unknown) => (kind === "partner" ? "comp_sponsors" : kind === "contestant" ? "comp_contestants" : null);

/** POST { kind, label } — create a new private invite link. */
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const t = table(b.kind);
  if (!t) return NextResponse.json({ error: "Invalid kind." }, { status: 400 });
  const sb = getSupabaseAdmin();
  const { count } = await sb.from(t).select("id", { count: "exact", head: true }).eq("event_id", ev.id);
  const row: Record<string, unknown> = {
    event_id: ev.id,
    token: newToken(),
    sort: count ?? 0,
    label: String(b.label ?? "").slice(0, 120),
  };
  if (t === "comp_sponsors") row.is_primary = (count ?? 0) === 0;
  const { data, error } = await sb.from(t).insert(row).select("id").single();
  if (error) return NextResponse.json({ error: "Couldn’t create the link." }, { status: 500 });
  return NextResponse.json({ id: data.id });
}

/**
 * PATCH { kind, id, ... } — any of:
 *   status: "approved" | "changes_requested" | "submitted" | "invited"
 *   adminNote, reopened, label, sort, isPrimary
 *   data: the full submission (admin edits), cleaned like the public form
 */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const b = await req.json().catch(() => ({}));
  const t = table(b.kind);
  if (!t || !b.id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const u: Record<string, unknown> = {};
  const now = new Date().toISOString();

  if (["approved", "changes_requested", "submitted", "invited"].includes(b.status)) {
    u.status = b.status;
    if (b.status === "approved") u.approved_at = now;
  }
  if ("adminNote" in b) u.admin_note = String(b.adminNote ?? "").slice(0, 2000);
  if ("reopened" in b) u.reopened = Boolean(b.reopened);
  if ("label" in b) u.label = String(b.label ?? "").slice(0, 120);
  if ("sort" in b) u.sort = Math.round(Number(b.sort) || 0);
  if ("data" in b) {
    if (t === "comp_contestants") {
      const c = cleanContestant({ ...b.data, agreed: true }, ev);
      Object.assign(u, { contact: c.contact, bartender: c.bartender, cocktail: c.cocktail });
    } else {
      const s = cleanSponsor(b.data);
      Object.assign(u, { contact: s.contact, profile: s.profile });
    }
  }

  const sb = getSupabaseAdmin();
  if (t === "comp_sponsors" && b.isPrimary === true) {
    await sb.from("comp_sponsors").update({ is_primary: false }).eq("event_id", ev.id);
    u.is_primary = true;
  }
  const { error } = await sb.from(t).update(u).eq("id", b.id).eq("event_id", ev.id);
  if (error) {
    console.error("[admin/competitions entries PATCH]", error);
    return NextResponse.json({ error: "Couldn’t save." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

/** DELETE { kind, id } */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  const t = table(b.kind);
  if (!t || !b.id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await getSupabaseAdmin().from(t).delete().eq("id", b.id).eq("event_id", params.id);
  if (error) return NextResponse.json({ error: "Couldn’t delete." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
