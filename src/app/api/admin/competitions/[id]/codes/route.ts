import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { generateCodes, getEventById } from "@/lib/compete/data";

// Protected by the middleware matcher on /api/admin/:path*.

export const dynamic = "force-dynamic";

/** POST — top every tier up to its configured number of codes. */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  try {
    const added = await generateCodes(ev);
    return NextResponse.json({ added });
  } catch (e) {
    console.error("[admin/competitions codes]", e);
    return NextResponse.json({ error: "Couldn’t generate codes." }, { status: 500 });
  }
}

/** PATCH { id, name?, reset? } — name a judge, or free a code from its phone. */
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  if (!b.id) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const u: Record<string, unknown> = {};
  if ("name" in b) u.name = String(b.name ?? "").slice(0, 80);
  if (b.reset) Object.assign(u, { device_secret: null, claimed_at: null });
  const { error } = await getSupabaseAdmin().from("comp_codes").update(u).eq("id", b.id).eq("event_id", params.id);
  if (error) return NextResponse.json({ error: "Couldn’t save." }, { status: 500 });
  return NextResponse.json({ ok: true });
}

/** DELETE { id } or { tierId } — remove a code, or a tier's unused codes. */
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const b = await req.json().catch(() => ({}));
  const sb = getSupabaseAdmin();
  let q = sb.from("comp_codes").delete().eq("event_id", params.id);
  if (b.id) q = q.eq("id", b.id);
  else if (b.tierId) q = q.eq("tier_id", b.tierId).is("device_secret", null);
  else return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Couldn’t delete." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
