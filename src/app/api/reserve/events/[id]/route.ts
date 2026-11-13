import { NextResponse, type NextRequest } from "next/server";
import { getEventBooking } from "@/lib/reserve/bible";
import { guard, fromError, notFound } from "@/lib/reserve/route";
import { isWebsiteEventId } from "@/lib/reserve/format";

export const dynamic = "force-dynamic";

/** GET /api/reserve/events/:websiteEventId — state, plus rules, party range, policies and spaces once set up. */
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
  const stop = guard(req, "read");
  if (stop) return stop;
  if (!isWebsiteEventId(params.id)) return notFound();
  try {
    return NextResponse.json(await getEventBooking(params.id));
  } catch (e) {
    return fromError(e);
  }
}
