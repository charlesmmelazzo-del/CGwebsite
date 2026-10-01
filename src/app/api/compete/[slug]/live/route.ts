import { NextRequest, NextResponse } from "next/server";
import { getEventCached } from "@/lib/compete/data";
import { publicLiveState } from "@/lib/compete/types";

export const dynamic = "force-dynamic";

/**
 * GET — the live state every guest phone (and the big screen) polls.
 * Small, public, and served from a sub-second cache. Never includes tie
 * breaks or any scores beyond the judges' reveal the host chose to show.
 */
export async function GET(_req: NextRequest, { params }: { params: { slug: string } }) {
  const ev = await getEventCached(params.slug);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(
    { version: ev.liveVersion, status: ev.status, state: publicLiveState(ev.liveState) },
    { headers: { "Cache-Control": "no-store" } }
  );
}
