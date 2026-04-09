import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { CalendarEvent } from "@/types";

export async function getEventsData(): Promise<{ events: CalendarEvent[]; hasFutureEvents: boolean }> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const todayStr = new Date().toISOString().split("T")[0];
    const { data } = await sb
      .from("events")
      .select("*")
      .gte("start_date", todayStr)
      .order("start_date");

    if (!data || data.length === 0) return { events: [], hasFutureEvents: false };

    const now = new Date();
    const events: CalendarEvent[] = data
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
      }))
      .filter((e) => {
        if (e.visibleFrom && new Date(e.visibleFrom + "T00:00:00") > now) return false;
        if (e.visibleUntil && new Date(e.visibleUntil + "T23:59:59") < now) return false;
        return true;
      });

    return { events, hasFutureEvents: events.length > 0 };
  } catch {
    return { events: [], hasFutureEvents: false };
  }
}
