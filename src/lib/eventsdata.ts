import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import { expandEvents } from "./recurrence";
import type { CalendarEvent } from "@/types";

export async function getEventsData(): Promise<{ events: CalendarEvent[]; hasFutureEvents: boolean }> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const todayStr = new Date().toISOString().split("T")[0];
    // One-off events are only interesting from today onward. Recurring series
    // must come through regardless of their start date — the series began in
    // the past but its next occurrences are still ahead of us.
    const first = await sb
      .from("events")
      .select("*")
      .or(`start_date.gte.${todayStr},recurrence.eq.weekly`)
      .order("start_date");
    let data = first.data;

    // If db/add-recurring-events.sql hasn't been run yet the `recurrence` column
    // is missing and the filter above errors out. Fall back to the plain
    // upcoming-events query so the page keeps working rather than going blank.
    if (first.error) {
      data = (await sb
        .from("events")
        .select("*")
        .gte("start_date", todayStr)
        .order("start_date")).data;
    }

    if (!data || data.length === 0) return { events: [], hasFutureEvents: false };

    const now = new Date();
    const series: CalendarEvent[] = data
      .map((r) => ({
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
        recurrence: (r.recurrence ?? "none") as CalendarEvent["recurrence"],
        recurrenceDay: r.recurrence_day ?? undefined,
        recurrenceCount: r.recurrence_count ?? undefined,
      }))
      .filter((e) => {
        if (e.visibleFrom && new Date(e.visibleFrom + "T00:00:00") > now) return false;
        if (e.visibleUntil && new Date(e.visibleUntil + "T23:59:59") < now) return false;
        return true;
      });

    // Turn each weekly series into its next few occurrences, then sort by date.
    const events = expandEvents(series, now);

    return { events, hasFutureEvents: events.length > 0 };
  } catch {
    return { events: [], hasFutureEvents: false };
  }
}
