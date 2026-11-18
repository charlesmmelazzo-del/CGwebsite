import { NextResponse, type NextRequest } from "next/server";
import { getCalendar, getReservation } from "@/lib/reserve/bible";
import { guard, fromError, badToken } from "@/lib/reserve/route";

export const dynamic = "force-dynamic";

/**
 * The date calendar for a guest's "Request a time change" dialog. Works while
 * new bookings are switched off (it needs a real reservation link), and uses
 * the reservation's own party size.
 */
export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const stop = (await guard(req, "read", "existing")) ?? badToken(params.token);
  if (stop) return stop;
  try {
    const view = await getReservation(params.token);
    if (view.closed) return NextResponse.json([]);
    return NextResponse.json(await getCalendar(view.party_size));
  } catch (e) {
    return fromError(e, { req, bucket: "read" });
  }
}
