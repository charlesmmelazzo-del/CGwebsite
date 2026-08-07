import type { CalendarEvent } from "@/types";

export const WEEKDAY_NAMES = [
  "Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday",
] as const;

/** Max occurrences we'll ever surface for one series — keeps the list sane. */
export const MAX_OCCURRENCES = 12;
export const DEFAULT_OCCURRENCES = 2;

/**
 * Parse a "YYYY-MM-DD" string as local noon. Matches the rest of the app —
 * avoids the off-by-one-day shift you get from UTC-parsed date-only strings.
 */
function parseDate(iso: string): Date {
  return new Date(iso + "T12:00:00");
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Format a Date as local "YYYY-MM-DD". */
function toISODate(d: Date): string {
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

export function isRecurring(event: CalendarEvent): boolean {
  return event.recurrence === "weekly";
}

export function clampCount(n: number | undefined): number {
  if (!n || !Number.isFinite(n)) return DEFAULT_OCCURRENCES;
  return Math.max(1, Math.min(Math.floor(n), MAX_OCCURRENCES));
}

/** The weekday a series lands on — explicit if set, otherwise inferred from its start date. */
export function recurrenceWeekday(event: CalendarEvent): number {
  if (typeof event.recurrenceDay === "number") return event.recurrenceDay;
  return parseDate(event.start).getDay();
}

/**
 * Expand one stored event into the occurrences that should be displayed.
 *
 * Non-recurring events pass through unchanged. A weekly event becomes up to
 * `recurrenceCount` future occurrences (today counts as upcoming), each with a
 * synthetic id so React keys and calendar UIDs stay unique. `visibleUntil`
 * doubles as the series end date — occurrences never run past it.
 */
export function expandEvent(event: CalendarEvent, now: Date = new Date()): CalendarEvent[] {
  if (!isRecurring(event)) return [event];

  const count = clampCount(event.recurrenceCount);
  const weekday = recurrenceWeekday(event);
  const seriesStart = startOfDay(parseDate(event.start));
  const until = event.visibleUntil ? startOfDay(parseDate(event.visibleUntil)) : null;

  // Start scanning at today, or at the series start if it hasn't begun yet.
  const today = startOfDay(now);
  let cursor = today > seriesStart ? today : seriesStart;
  // Jump forward to the next matching weekday (0 days if it already matches).
  cursor.setDate(cursor.getDate() + ((weekday - cursor.getDay() + 7) % 7));

  const out: CalendarEvent[] = [];
  for (let i = 0; i < count; i++) {
    if (until && cursor > until) break;
    const iso = toISODate(cursor);
    out.push({
      ...event,
      id: `${event.id}::${iso}`,
      seriesId: event.id,
      start: iso,
      end: undefined, // a weekly occurrence is a single day
    });
    cursor = new Date(cursor);
    cursor.setDate(cursor.getDate() + 7);
  }
  return out;
}

/** Expand a whole list and sort the result by date. */
export function expandEvents(events: CalendarEvent[], now: Date = new Date()): CalendarEvent[] {
  return events
    .flatMap((e) => expandEvent(e, now))
    .sort((a, b) => a.start.localeCompare(b.start));
}

/** Human-readable summary for the admin list, e.g. "Every Tuesday · next 2 shown". */
export function describeRecurrence(event: CalendarEvent): string {
  const count = clampCount(event.recurrenceCount);
  return `Every ${WEEKDAY_NAMES[recurrenceWeekday(event)]} · next ${count} shown`;
}
