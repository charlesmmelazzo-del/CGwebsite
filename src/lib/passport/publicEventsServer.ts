import "server-only";
import { getEventsData } from "@/lib/eventsdata";
import { reserveEnabled } from "@/lib/reserve/enabled";
import { getEventStatuses } from "@/lib/reserve/bible";
import { toPublicEvent, type PublicEvent } from "./publicEvents";

/**
 * File 15, Part G: the public website's events for Passport, read on the server with the public page's own function
 * (getEventsData: the same visibility rule) and the same booking state from the Bible, kept for a few minutes. If
 * either source can't be reached, Passport shows its own events and says nothing.
 */
const TTL_MS = 5 * 60 * 1000;
let cache: { at: number; events: PublicEvent[] } | null = null;
export async function getPublicEvents(): Promise<PublicEvent[]> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.events;
  try {
    const { events } = await getEventsData();
    let states: Record<string, { state?: string }> = {};
    try {
      if (await reserveEnabled()) states = await getEventStatuses(events.filter((e) => !e.seriesId && e.recurrence !== "weekly").map((e) => e.id));
    } catch { states = {}; }
    const out = events.map((e) => toPublicEvent(e, states[e.id]?.state ?? null)).filter((e): e is PublicEvent => !!e);
    cache = { at: Date.now(), events: out };
    return out;
  } catch {
    return cache?.events ?? [];
  }
}
/** One public event the public page shows now, or null. */
export async function findPublicEvent(id: string): Promise<PublicEvent | null> {
  return (await getPublicEvents()).find((e) => e.id === id) ?? null;
}
