import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getReserveSwitch, setReserveSwitch, reserveForcedOn } from "@/lib/reserve/enabled";

// Protected by the middleware's /api/admin session check.

export const dynamic = "force-dynamic";

// enabled  — the saved switch (what the live site follows)
// forcedOn — this copy of the site has RESERVE_ENABLED=1 (staging), so the
//            Reserve page shows here whatever the switch says
export async function GET() {
  return NextResponse.json({ enabled: await getReserveSwitch(), forcedOn: reserveForcedOn() });
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { enabled?: unknown };
    if (typeof body.enabled !== "boolean") {
      return NextResponse.json({ success: false, error: "Missing 'enabled'." }, { status: 400 });
    }
    await setReserveSwitch(body.enabled);
    // The nav link is part of every page.
    revalidatePath("/", "layout");
    return NextResponse.json({ success: true, enabled: body.enabled, forcedOn: reserveForcedOn() });
  } catch (e) {
    console.error("[POST /api/admin/reserve/enabled]", e);
    const msg = e instanceof Error ? e.message : String(e);
    const missing = /reserve_page/.test(msg) && /(does not exist|schema cache)/i.test(msg);
    return NextResponse.json(
      { success: false, error: missing ? "The reserve_page table doesn't exist yet. Run db/reserve-page.sql in Supabase." : msg },
      { status: 500 },
    );
  }
}
