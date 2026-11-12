import { NextResponse, type NextRequest } from "next/server";
import { getCalendar } from "@/lib/reserve/bible";
import { guard, fromError, intParam, bad } from "@/lib/reserve/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stop = guard(req, "read");
  if (stop) return stop;
  const raw = req.nextUrl.searchParams.get("party");
  const party = raw ? intParam(raw, 1, 500) : null;
  if (raw && party === null) return bad("Pick a party size");
  try {
    return NextResponse.json(await getCalendar(party));
  } catch (e) {
    return fromError(e);
  }
}
