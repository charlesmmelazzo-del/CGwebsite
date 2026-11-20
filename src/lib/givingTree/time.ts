// ─── Central time helpers ────────────────────────────────────────────────────
//
// Every date and time in the Giving Tree is Central (America/Chicago). Plain
// dates are "YYYY-MM-DD" strings, compared as strings (they sort correctly).
// Pure and dependency-free so the rules can be tested in isolation.

export const TZ = "America/Chicago";

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function wallParts(ms: number) {
  const out: Record<string, number> = {};
  for (const p of partsFmt.formatToParts(new Date(ms))) {
    if (p.type !== "literal") out[p.type] = Number(p.value);
  }
  return out as { year: number; month: number; day: number; hour: number; minute: number; second: number };
}

const pad = (n: number) => String(n).padStart(2, "0");

/** The Central calendar date of an instant. */
export function centralDate(at: number | string | Date): string {
  const ms = typeof at === "number" ? at : new Date(at).getTime();
  const p = wallParts(ms);
  return `${p.year}-${pad(p.month)}-${pad(p.day)}`;
}

/** Minutes Central is ahead of UTC at this instant (negative: -360 or -300). */
function offsetMinutes(ms: number): number {
  const p = wallParts(ms);
  const asUtc = Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second);
  return Math.round((asUtc - Math.floor(ms / 1000) * 1000) / 60000);
}

/** The instant of a Central wall-clock time on a Central date. */
export function centralInstant(date: string, time = "00:00"): number {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  let ms = guess - offsetMinutes(guess) * 60000;
  // Re-check across a daylight-saving change.
  const again = guess - offsetMinutes(ms) * 60000;
  if (again !== ms) ms = again;
  return ms;
}

/** Calendar arithmetic on a "YYYY-MM-DD" date. */
export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

/** Whole days from a to b (b - a). */
export function daysBetween(a: string, b: string): number {
  const [ay, am, ad] = a.split("-").map(Number);
  const [by, bm, bd] = b.split("-").map(Number);
  return Math.round((Date.UTC(by, bm - 1, bd) - Date.UTC(ay, am - 1, ad)) / 86400000);
}

/** The moment a Central date ends (midnight starting the next day). */
export function endOfDay(date: string): number {
  return centralInstant(addDays(date, 1), "00:00");
}

/** The earliest of some dates, ignoring blanks. */
export function minDate(...dates: (string | null | undefined)[]): string | null {
  const real = dates.filter((d): d is string => typeof d === "string" && d.length === 10);
  if (!real.length) return null;
  return real.reduce((a, b) => (b < a ? b : a));
}

export function isDate(v: unknown): v is string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v)) return false;
  const [y, m, d] = v.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d));
  return t.getUTCFullYear() === y && t.getUTCMonth() === m - 1 && t.getUTCDate() === d;
}

export function isTime(v: unknown): v is string {
  return typeof v === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(v);
}
