import { unstable_noStore as noStore } from "next/cache";
import { getSupabaseAdmin } from "./supabase";
import type { CalendarEvent } from "@/types";

export async function getEventsData(): Promise<CalendarEvent[]> {
  noStore();
  try {
    const sb = getSupabaseAdmin();
    const { data } = await sb.from("events").select("*").order("start_date");
    if (!data || data.length === 0) return [];
    return data.map((r) => ({
      id: r.id,
      title: r.title,
      start: r.start_date,
      end: r.end_date ?? undefined,
      description: r.description ?? undefined,
      location: r.location ?? undefined,
      imageUrl: r.image_url ?? undefined,
    }));
  } catch {
    return [];
  }
}
