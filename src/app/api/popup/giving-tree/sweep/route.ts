import { NextResponse, type NextRequest } from "next/server";
import { fail } from "@/lib/givingTree/http";
import { sweep } from "@/lib/givingTree/service";

export const dynamic = "force-dynamic";

/**
 * Runs the gift reminders / auto-release sweep on demand, for an outside timer
 * (none is set up yet; page loads run the same sweep). Needs the
 * GIVING_TREE_SWEEP_SECRET environment variable, sent as the
 * "x-sweep-secret" header. Without the variable set, this endpoint is off.
 */
export async function POST(req: NextRequest) {
  const secret = process.env.GIVING_TREE_SWEEP_SECRET;
  if (!secret || req.headers.get("x-sweep-secret") !== secret) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  try {
    return NextResponse.json({ ok: true, report: await sweep({ force: true }) });
  } catch (e) {
    return fail(e);
  }
}
