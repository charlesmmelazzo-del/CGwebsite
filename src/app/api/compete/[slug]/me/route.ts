import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventBySlug } from "@/lib/compete/data";
import { getViewer, guestCookieName } from "@/lib/compete/session";

export const dynamic = "force-dynamic";

/** GET — the signed-in guest, with their own ballots and superlative picks. */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const viewer = await getViewer(ev);
  if (!viewer) return NextResponse.json({ viewer: null }, { status: 401 });

  const sb = getSupabaseAdmin();
  const [{ data: votes }, { data: picks }] = await Promise.all([
    sb.from("comp_votes").select("contestant_id, scores").eq("code_id", viewer.codeId),
    sb.from("comp_superlative_votes").select("superlative_id, contestant_id").eq("code_id", viewer.codeId),
  ]);
  return NextResponse.json({
    viewer,
    votes: Object.fromEntries((votes ?? []).map((v) => [v.contestant_id, v.scores])),
    picks: Object.fromEntries((picks ?? []).map((p) => [p.superlative_id, p.contestant_id])),
  });
}

/**
 * DELETE — sign this phone out and release the code, so the guest can sign
 * back in (here or on another phone). Their ballots stay with the code.
 */
export async function DELETE(_req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  const res = NextResponse.json({ ok: true });
  if (!ev) return res;
  const viewer = await getViewer(ev);
  if (viewer) {
    await getSupabaseAdmin().from("comp_codes").update({ device_secret: null, claimed_at: null }).eq("id", viewer.codeId);
  }
  res.cookies.delete(guestCookieName(ev.id));
  return res;
}
