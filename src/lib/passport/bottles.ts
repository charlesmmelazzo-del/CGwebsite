/**
 * File 05: bottle requests, shared by the website's routes and screens (no server-only code, so the tests can use it).
 * The Bible checks everything again; these only stop bad input before it leaves the website.
 */

export const MIN_QTY = 1;
export const MAX_QTY = 12;
export const NOTE_MAX = 500;
export const NAME_MAX = 120;
export const NO_PRICE_LINE = "We'll send you a price before anything is ordered.";

/** A whole number of bottles from 1 to 12, or null. */
export function quantity(v: unknown): number | null {
  const n = typeof v === "number" ? v : typeof v === "string" && /^\d{1,2}$/.test(v.trim()) ? Number(v.trim()) : NaN;
  return Number.isInteger(n) && n >= MIN_QTY && n <= MAX_QTY ? n : null;
}

/**
 * What the website sends the Bible for a new request: only these fields, whatever the browser sent
 * (a price, a status, a date or a member number never leave the website).
 */
export function requestBody(b: Record<string, unknown>):
  | { body: { bottle_id?: number; name?: string; quantity: number; note: string } }
  | { error: string } {
  const qty = quantity(b.quantity);
  if (!qty) return { error: `Choose a quantity from ${MIN_QTY} to ${MAX_QTY}` };
  const note = typeof b.note === "string" ? b.note.slice(0, NOTE_MAX + 1) : "";
  if (note.trim().length > NOTE_MAX) return { error: `Keep the note under ${NOTE_MAX} characters` };
  const raw = b.bottle_id;
  const bottleId = typeof raw === "number" ? raw : typeof raw === "string" && /^\d{1,9}$/.test(raw) ? Number(raw) : null;
  if (raw !== undefined && raw !== null && raw !== "") {
    if (!bottleId || !Number.isInteger(bottleId) || bottleId <= 0) return { error: "Not found" };
    return { body: { bottle_id: bottleId, quantity: qty, note } };
  }
  const name = typeof b.name === "string" ? b.name.replace(/\s+/g, " ").trim() : "";
  if (!name) return { error: "Tell us the bottle you'd like" };
  if (name.length > NAME_MAX) return { error: `Keep the name under ${NAME_MAX} characters` };
  return { body: { name, quantity: qty, note } };
}

/** The only answers a member can give about their own request. */
export const ACTIONS = ["accept", "decline", "cancel"] as const;
export type Action = (typeof ACTIONS)[number];
export const isAction = (v: unknown): v is Action => typeof v === "string" && (ACTIONS as readonly string[]).includes(v);

/** Whole cents → "$52" or "$51.99". */
export function money(cents: number): string {
  return `$${(cents / 100).toFixed(cents % 100 ? 2 : 0)}`;
}

/** "2026-12-04" → "Friday, December 4". */
export function longDay(d: string | null): string {
  if (!d) return "";
  const [y, m, day] = d.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, day, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/** Requests still in motion first (newest first), then closed ones. */
const OPEN = new Set(["submitted", "quoted", "accepted", "ordered", "ready"]);
export function sortRequests<T extends { status: string; id: number }>(list: T[]): T[] {
  return [...list].sort((a, b) => Number(OPEN.has(b.status)) - Number(OPEN.has(a.status)) || b.id - a.id);
}
