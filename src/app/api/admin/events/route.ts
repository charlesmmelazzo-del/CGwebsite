import { NextRequest, NextResponse } from "next/server";
import { getSupabaseAdmin } from "@/lib/supabase";
import { getEventStatuses, upsertEventReservations, removeEventReservations, BibleError } from "@/lib/reserve/bible";
import type { EventReservationInfo, EventStatus } from "@/lib/reserve/types";
import { BAR_TIME_ZONE } from "@/lib/reserve/format";

/** Today at the bar, YYYY-MM-DD. */
function barToday(): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BAR_TIME_ZONE }).format(new Date());
}

/**
 * An event "has reservations on" when the Bible knows it and hasn't closed it,
 * or when it has passed (a past event shows as Closed but was on).
 * The Bible reports a website-cancelled future event as closed.
 */
function toInfo(st: EventStatus | undefined): EventReservationInfo {
  if (!st) return { enabled: false, state: null, opens_at: null };
  const enabled = st.state !== "closed" || st.date < barToday();
  return { enabled, state: st.state, opens_at: st.opens_at };
}

function bibleMessage(e: unknown): string {
  return e instanceof BibleError ? e.message : "The CG Bible didn't respond.";
}

// GET — return all events sorted by start date
export async function GET() {
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("events").select("*").order("start_date");

    // Reservation state lives in the Bible, keyed by the website event id.
    // null = the Bible couldn't be reached (the editor then locks the checkbox
    // so a save can't silently turn reservations off).
    let statuses: Record<string, EventStatus> | null = null;
    try {
      statuses = await getEventStatuses((data ?? []).filter((r) => r.recurrence !== "weekly").map((r) => String(r.id)));
    } catch (e) {
      console.error("[GET /api/admin/events] reservation status:", bibleMessage(e));
    }

    return NextResponse.json(
      (data ?? []).map((r) => ({
        reservations: statuses === null ? null : toInfo(statuses[String(r.id)]),
        id: r.id,
        title: r.title,
        start: r.start_date,
        end: r.end_date ?? undefined,
        description: r.description ?? undefined,
        location: r.location ?? undefined,
        imageUrl: r.image_url ?? undefined,
        visibleFrom: r.visible_from ?? undefined,
        visibleUntil: r.visible_until ?? undefined,
        linkUrl: r.link_url ?? undefined,
        linkLabel: r.link_label ?? undefined,
        linkNewTab: r.link_new_tab ?? true,
        recurrence: r.recurrence ?? "none",
        recurrenceDay: r.recurrence_day ?? undefined,
        recurrenceCount: r.recurrence_count ?? undefined,
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
    const isWeekly = event.recurrence === "weekly";
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
        link_url: event.linkUrl ?? null,
        link_label: event.linkLabel ?? null,
        link_new_tab: event.linkNewTab ?? true,
        recurrence: isWeekly ? "weekly" : "none",
        recurrence_day: isWeekly ? event.recurrenceDay ?? null : null,
        recurrence_count: isWeekly ? event.recurrenceCount ?? 2 : null,
      },
      { onConflict: "id" }
    );
    if (error) throw error;

    // ── Reservations (the event itself is saved either way) ──
    // reservationsEnabled is undefined when the editor couldn't read the Bible:
    // leave reservations alone then.
    const wants: boolean | undefined = typeof event.reservationsEnabled === "boolean" ? event.reservationsEnabled : undefined;
    if (wants === undefined) return NextResponse.json({ success: true });
    if (wants && isWeekly) {
      return NextResponse.json({ success: true, reservationsWarning: "Reservations can be turned on for one-time events only." });
    }
    const id = String(event.id);
    try {
      if (wants) {
        // Also carries a new title or date (a date change sends the Bible setup back to "needs setup").
        const st = await upsertEventReservations(id, { title: String(event.title), date: String(event.start), enabled: true });
        return NextResponse.json({ success: true, reservations: toInfo(st) });
      }
      const current = (await getEventStatuses([id]))[id];
      if (current && toInfo(current).enabled) {
        const st = await upsertEventReservations(id, { title: String(event.title), date: String(event.start), enabled: false });
        return NextResponse.json({ success: true, reservations: { ...toInfo(st), enabled: false } });
      }
      return NextResponse.json({ success: true, reservations: toInfo(current) });
    } catch (e) {
      console.error("[POST /api/admin/events] reservations:", bibleMessage(e));
      return NextResponse.json({
        success: true,
        reservationsWarning: `The event was saved, but the CG Bible wasn't updated (${bibleMessage(e)}). Save again to retry.`,
      });
    }
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
    // Stop reservations for it in the Bible (no-op for events it never knew).
    await removeEventReservations(String(id)).catch((e) => {
      if (!(e instanceof BibleError && e.status === 404)) {
        console.error("[DELETE /api/admin/events] reservations:", bibleMessage(e));
      }
    });
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[DELETE /api/admin/events]", e);
    return NextResponse.json({ success: false, error: String(e) }, { status: 500 });
  }
}
