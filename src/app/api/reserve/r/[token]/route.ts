import { NextResponse, type NextRequest } from "next/server";
import { getReservation } from "@/lib/reserve/bible";
import { guard, fromError, badToken } from "@/lib/reserve/route";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest, { params }: { params: { token: string } }) {
  const stop = guard(req, "read") ?? badToken(params.token);
  if (stop) return stop;
  try {
    return NextResponse.json(await getReservation(params.token), { headers: { "Referrer-Policy": "no-referrer" } });
  } catch (e) {
    return fromError(e);
  }
}
