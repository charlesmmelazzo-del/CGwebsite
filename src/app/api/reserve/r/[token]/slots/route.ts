import { NextResponse, type NextRequest } from "next/server";
import { getReservationSlots } from "@/lib/reserve/bible";
import { guard, fromError, badToken, bad, DATE_RE } from "@/lib/reserve/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const stop = guard(req, "read") ?? badToken(params.token);
  if (stop) return stop;
  const date = req.nextUrl.searchParams.get("date") ?? "";
  if (!DATE_RE.test(date)) return bad("Pick a valid date");
  try {
    return NextResponse.json(await getReservationSlots(params.token, date));
  } catch (e) {
    return fromError(e);
  }
}
