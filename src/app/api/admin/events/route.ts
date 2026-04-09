import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";

// GET — return all events sorted by start date
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("events").select("*").order("start_date");
    return NextResponse.json(
      (data ?? []).map((r) => ({
        id: r.id,
        title: r.title,
        start: r.start_date,
        end: r.end_date ?? undefined,
        description: r.description ?? undefined,
        location: r.location ?? undefined,
        imageUrl: r.image_url ?? undefined,
        visibleFrom: r.visible_from ?? undefined,
        visibleUntil: r.visible_until ?? undefined,
      }))
    );
  } catch (e) {
    console.error("[GET /api/admin/events]", e);
    return NextResponse.json([]);
  }
}

// POST — upsert a single event
export async function POST(req: NextRequest) {
  try {
    const event = await req.json();
    if (!event.id || !event.title || !event.start) {
      return NextResponse.json({ success: false, error: "id, title, and start are required" }, { status: 400 });
    }
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("events").upsert(
      {
        id: event.id,
        title: event.title,
        start_date: event.start,
        end_date: event.end ?? null,
        description: event.description ?? null,
        location: event.location ?? null,
        image_url: event.imageUrl ?? null,
        visible_from: event.visibleFrom ?? null,
        visible_until: event.visibleUntil ?? null,
      },
      { onConflict: "id" }
    );
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[POST /api/admin/events]", e);
    const msg = e instanceof Error ? e.message : (e as { message?: string })?.message ?? JSON.stringify(e);
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}

// DELETE — remove an event by id
export async function DELETE(req: NextRequest) {
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ success: false, error: "id required" }, { status: 400 });
    const sb = getSupabaseAdmin();
    const { error } = await sb.from("events").delete().eq("id", id);
    if (error) throw error;
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/admin/events]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
