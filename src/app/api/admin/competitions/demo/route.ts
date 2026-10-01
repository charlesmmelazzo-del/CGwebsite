import { NextResponse } from "next/server";
import { createDemoEvent } from "@/lib/compete/demo";

// Protected by the middleware matcher on /api/admin/:path*.

export const dynamic = "force-dynamic";

/** POST — create (or reset) the Cascahuín demo competition. */
export async function POST() {
  try {
    return NextResponse.json(await createDemoEvent());
  } catch (e) {
    console.error("[admin/competitions/demo]", e);
    return NextResponse.json(
      { error: "Couldn’t create the demo. Has db/competitions.sql been run in Supabase?" },
      { status: 500 }
    );
  }
}
