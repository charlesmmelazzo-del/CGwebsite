import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { createEvent, listEvents } from "@/lib/compete/data";

// Protected by the middleware matcher on /api/admin/:path*.

export const dynamic = "force-dynamic";

/** GET — every competition, with submission counts for the list view. */
export async function GET() {
  try {
    const events = await listEvents();
    const sb = getSupabaseAdmin();
    const { data: cs } = await sb.from("comp_contestants").select("event_id, status");
    return NextResponse.json({
      events: events.map((e) => {
        const mine = (cs ?? []).filter((c) => c.event_id === e.id);
        return {
          id: e.id,
          slug: e.slug,
          name: e.name,
          featuredSpirit: e.featuredSpirit,
          eventDate: e.eventDate,
          status: e.status,
          isDemo: e.isDemo,
          contestants: mine.length,
          approved: mine.filter((c) => c.status === "approved").length,
        };
      }),
    });
  } catch (e) {
    console.error("[admin/competitions]", e);
    return NextResponse.json(
      { error: "Couldn’t load competitions. Has db/competitions.sql been run in Supabase?", events: [] },
      { status: 500 }
    );
  }
}

/** POST { name } — create a competition with the default fields, rules and tiers. */
export async function POST(req: NextRequest) {
  const { name } = await req.json().catch(() => ({ name: "" }));
  if (!String(name ?? "").trim()) return NextResponse.json({ error: "Give the competition a name." }, { status: 400 });
  try {
    const ev = await createEvent({ name: String(name).trim().slice(0, 120) });
    return NextResponse.json({ id: ev.id });
  } catch (e) {
    console.error("[admin/competitions POST]", e);
    return NextResponse.json({ error: "Couldn’t create the competition." }, { status: 500 });
  }
}
