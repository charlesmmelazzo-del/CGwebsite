import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventBySlug } from "@/lib/compete/data";
import { getViewer } from "@/lib/compete/session";

export const dynamic = "force-dynamic";

/**
 * POST { contestantId, scores } — cast or change a ballot.
 *
 * Only for the contestant on stage, only while the host has voting open for
 * this guest's tier (judges and guests open separately), and only until the
 * host closes it. Late arrivals can't score cocktails they never tasted.
 */
export async function POST(req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventBySlug(params.slug);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const viewer = await getViewer(ev);
  if (!viewer) return NextResponse.json({ error: "Sign in with your ticket code to vote." }, { status: 401 });

  let body: { contestantId?: string; scores?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const s = ev.liveState;
  const open = viewer.isJudge ? s.judgeVoting : s.guestVoting;
  if (
    s.phase !== "contestant" ||
    !body.contestantId ||
    s.contestantId !== body.contestantId ||
    (s.closed ?? []).includes(body.contestantId) ||
    !open
  ) {
    return NextResponse.json({ error: "Voting for this cocktail is closed." }, { status: 409 });
  }

  const scores: Record<string, number> = {};
  for (const c of ev.scoreCategories) {
    const v = Math.round(Number(body.scores?.[c.id]));
    if (!(v >= 1 && v <= 5)) {
      return NextResponse.json({ error: `Give ${c.label} a score from 1 to 5.` }, { status: 400 });
    }
    scores[c.id] = v;
  }

  const sb = getSupabaseAdmin();
  const { error } = await sb.from("comp_votes").upsert(
    {
      event_id: ev.id,
      code_id: viewer.codeId,
      contestant_id: body.contestantId,
      scores,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "code_id,contestant_id" }
  );
  if (error) {
    console.error("[compete/vote]", error);
    return NextResponse.json({ error: "Your vote didn’t save. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true, scores });
}
