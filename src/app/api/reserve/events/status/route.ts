import { NextResponse, type NextRequest } from "next/server";
import { getEventStatuses } from "@/lib/reserve/bible";
import { guard, fromError } from "@/lib/reserve/route";
import { isWebsiteEventId } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

/** GET /api/reserve/events/status?ids=a,b — reservation state per website event. */
export async function GET(req: NextRequest) {
  const stop = guard(req, "read");
  if (stop) return stop;
  const ids = (req.nextUrl.searchParams.get("ids") ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(isWebsiteEventId)
    .slice(0, 200);
  try {
    return NextResponse.json(await getEventStatuses(ids));
  } catch (e) {
    return fromError(e);
  }
}
