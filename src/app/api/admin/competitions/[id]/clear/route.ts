import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { bustLiveCache, getEventById } from "@/lib/compete/data";
import { EMPTY_LIVE_STATE } from "@/lib/compete/types";

// Protected by the middleware matcher on /api/admin/:path*.

export const dynamic = "force-dynamic";

/**
 * POST — clear test activity before the real night: every ballot and
 * superlative pick, every phone's hold on a ticket code, and the show itself
 * (back to the lobby, nothing revealed). Content — contestants, brand,
 * recipes, codes and judges' names — is untouched.
 */
export async function POST(_req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const sb = getSupabaseAdmin();
  const steps = await Promise.all([
    sb.from("comp_votes").delete().eq("event_id", ev.id),
    sb.from("comp_superlative_votes").delete().eq("event_id", ev.id),
    sb.from("comp_codes").update({ device_secret: null, claimed_at: null }).eq("event_id", ev.id),
  ]);
  const failed = steps.find((s) => s.error);
  if (failed) {
    console.error("[admin/competitions clear]", failed.error);
    return NextResponse.json({ error: "Couldn’t clear everything — please try again." }, { status: 500 });
  }
  const { error } = await sb
    .from("comp_events")
    .update({
      live_state: EMPTY_LIVE_STATE,
      live_version: ev.liveVersion + 1,
      status: ev.status === "draft" ? "draft" : "published",
      updated_at: new Date().toISOString(),
    })
    .eq("id", ev.id);
  if (error) return NextResponse.json({ error: "Couldn’t reset the show." }, { status: 500 });
  bustLiveCache(ev.slug);
  return NextResponse.json({ ok: true });
}
