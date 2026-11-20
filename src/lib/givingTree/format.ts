// ─── Date and time wording (safe in the browser and on the server) ───────────

/** "Saturday, December 19" from a YYYY-MM-DD date. */
export function longDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });
}

/** "Sat, Dec 19" from a YYYY-MM-DD date. */
export function shortDate(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d, 12)).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", timeZone: "UTC" });
}

/** "9am", "12:30pm" from "HH:MM". */
export function time12(t: string): string {
  const [h, m] = t.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  const hh = h % 12 || 12;
  return m ? `${hh}:${String(m).padStart(2, "0")}${suffix}` : `${hh}${suffix}`;
}

export function whenLine(o: { eventDate: string | null; startTime: string | null; endTime: string | null }): string | null {
  if (!o.eventDate) return null;
  const t = o.startTime ? `, ${time12(o.startTime)}${o.endTime ? `–${time12(o.endTime)}` : ""}` : "";
  return `${longDate(o.eventDate)}${t}`;
}
