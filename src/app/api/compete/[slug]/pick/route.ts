import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getContestants, getEventBySlug } from "@/lib/compete/data";
import { getViewer } from "@/lib/compete/session";

export const dynamic = "force-dynamic";

/** POST { superlativeId, contestantId } — one pick per person per superlative, changeable while open. */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const viewer = await getViewer(ev);
  if (!viewer) return NextResponse.json({ error: "Sign in with your ticket code to vote." }, { status: 401 });
  if (ev.liveState.phase !== "superlatives" || !ev.liveState.superlativesOpen) {
    return NextResponse.json({ error: "Superlative voting is closed." }, { status: 409 });
  }

  let body: { superlativeId?: string; contestantId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (!ev.superlatives.some((s) => s.id === body.superlativeId)) {
    return NextResponse.json({ error: "Unknown category." }, { status: 400 });
  }
  const contestants = await getContestants(ev.id);
  if (!contestants.some((c) => c.id === body.contestantId && c.status === "approved")) {
    return NextResponse.json({ error: "Unknown contestant." }, { status: 400 });
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("comp_superlative_votes").upsert(
    {
      event_id: ev.id,
      code_id: viewer.codeId,
      superlative_id: body.superlativeId,
      contestant_id: body.contestantId,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "code_id,superlative_id" }
  );
  if (error) {
    console.error("[compete/pick]", error);
    return NextResponse.json({ error: "Your pick didn’t save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
