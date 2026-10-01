import { NextRequest, NextResponse } from "next/server";
import { computeResults, getContestants, getEventById } from "@/lib/compete/data";

// Protected by the middleware matcher on /api/admin/:path*.

export const dynamic = "force-dynamic";

/** GET — the full tally. Admin only: guests and the host only ever see winners. */
export async function GET(_req: NextRequest, { params }: { params: { id: string } }) {
  const ev = await getEventById(params.id);
  if (!ev) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const results = await computeResults(ev, await getContestants(ev.id));
  return NextResponse.json(results);
}
