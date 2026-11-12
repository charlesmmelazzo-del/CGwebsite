import { NextResponse, type NextRequest } from "next/server";
import { getSlots } from "@/lib/reserve/bible";
import { guard, fromError, intParam, bad, DATE_RE } from "@/lib/reserve/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stop = guard(req, "read");
  if (stop) return stop;
  const sp = req.nextUrl.searchParams;
  const date = sp.get("date") ?? "";
  const party = intParam(sp.get("party"), 1, 500);
  const eventRaw = sp.get("event");
  const event = eventRaw ? intParam(eventRaw, 1, Number.MAX_SAFE_INTEGER) : null;
  if (!DATE_RE.test(date)) return bad("Pick a valid date");
  if (party === null) return bad("Pick a party size");
  try {
    return NextResponse.json(await getSlots(date, party, event));
  } catch (e) {
    return fromError(e);
  }
}
