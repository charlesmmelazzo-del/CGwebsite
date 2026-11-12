import { NextResponse, type NextRequest } from "next/server";
import { getConfig } from "@/lib/reserve/bible";
import { getReserveContent } from "@/lib/reserve/content";
import { getSiteSettings } from "@/lib/siteconfig";
import { guard, fromError } from "@/lib/reserve/route";
import type { ReservePageConfig } from "@/lib/reserve/types";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const stop = guard(req, "read");
  if (stop) return stop;
  try {
    const [bible, content, settings] = await Promise.all([getConfig(), getReserveContent(), getSiteSettings()]);
    const out: ReservePageConfig = { bible, content, phone: settings.phone };
    return NextResponse.json(out);
  } catch (e) {
    return fromError(e);
  }
}
