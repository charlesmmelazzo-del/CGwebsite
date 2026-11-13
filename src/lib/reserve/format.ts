/**
 * Formatting helpers shared by the Reserve page and the guest page.
 * Dates are business-local YYYY-MM-DD strings; times are minutes from the
 * business day's midnight (they may run past 1440 after midnight).
 */

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** Parse YYYY-MM-DD as a calendar date (UTC noon so no timezone can shift the day). */
export function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, (m || 1) - 1, d || 1, 12));
}

export function weekdayIndex(date: string): number {
  return parseDate(date).getUTCDay();
}

/** "Friday, November 20" */
export function dateLong(date: string): string {
  const d = parseDate(date);
  return `${WEEKDAYS[d.getUTCDay()]}, ${MONTHS[d.getUTCMonth()]} ${d.getUTCDate()}`;
}

/** "Fri Nov 20" */
export function dateShort(date: string): string {
  const d = parseDate(date);
  return `${WEEKDAYS[d.getUTCDay()].slice(0, 3)} ${MONTHS[d.getUTCMonth()].slice(0, 3)} ${d.getUTCDate()}`;
}

export function monthShort(date: string): string {
  return MONTHS[parseDate(date).getUTCMonth()].slice(0, 3);
}

export function dayOfMonth(date: string): number {
  return parseDate(date).getUTCDate();
}

/** 1110 → "6:30 PM" */
export function time12(min: number): string {
  const m = ((min % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mm = m % 60;
  const suffix = h >= 12 ? "PM" : "AM";
  const h12 = h % 12 === 0 ? 12 : h % 12;
  return `${h12}:${String(mm).padStart(2, "0")} ${suffix}`;
}

/** 1080, 1200 → "6:00–8:00 PM" (drops the first AM/PM when both match). */
export function timeRange(startMin: number, endMin: number): string {
  const a = time12(startMin);
  const b = time12(endMin);
  if (a.slice(-2) === b.slice(-2)) return `${a.slice(0, -3)}–${b}`;
  return `${a}–${b}`;
}

/** "Coffee" → "Coffee service"; "Brunch Service" stays as is; "" → "". */
export function serviceName(label: string): string {
  const l = label.trim();
  if (!l) return "";
  return /service$/i.test(l) ? l : `${l} service`;
}

/** Hours for a service heading: "7:00 AM – 12:00 PM", "5:00 – 11:00 PM". */
export function serviceHours(openMin: number, closeMin: number): string {
  return timeRange(openMin, closeMin).replace("–", " – ");
}

/** "Coffee service · 7:00 AM – 12:00 PM", or just the hours when unnamed. */
export function serviceHeading(sv: { label: string; open_min: number; close_min: number }): string {
  const name = serviceName(sv.label);
  const hours = serviceHours(sv.open_min, sv.close_min);
  return name ? `${name} · ${hours}` : hours;
}

/** 90 → "1½ hours", 60 → "1 hour", 45 → "45 minutes", 135 → "2¼ hours" */
export function lengthLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} minutes`;
  const whole = Math.floor(minutes / 60);
  const rest = minutes % 60;
  const frac = rest === 0 ? "" : rest === 30 ? "½" : rest === 15 ? "¼" : rest === 45 ? "¾" : null;
  if (frac === null) return `${whole} hr ${rest} min`;
  const label = `${whole}${frac}`;
  return `${label} ${whole === 1 && !frac ? "hour" : "hours"}`;
}

/** 14 → "two weeks", 10 → "10 days", 1 → "1 day" */
export function daysPhrase(days: number): string {
  if (days > 0 && days % 7 === 0) {
    const w = days / 7;
    const words = ["", "one", "two", "three", "four", "five", "six", "seven", "eight"];
    return `${words[w] ?? w} week${w === 1 ? "" : "s"}`;
  }
  return `${days} day${days === 1 ? "" : "s"}`;
}

/** "630-474-0932" → "6304740932" for tel: links */
export function telHref(phone: string): string {
  return `tel:${phone.replace(/[^\d+]/g, "")}`;
}

/** Digits only, dropping a leading US country code. */
export function phoneDigits(v: string): string {
  const d = v.replace(/\D/g, "");
  return d.length === 11 && d.startsWith("1") ? d.slice(1) : d;
}

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function isEmail(v: string): boolean {
  return EMAIL_RE.test(v.trim());
}

export function isUsPhone(v: string): boolean {
  return phoneDigits(v).length === 10;
}

/** Base64url, 43 characters (32 random bytes) — the Bible's reservation token shape. */
export const TOKEN_RE = /^[A-Za-z0-9_-]{43}$/;
export function isToken(v: string): boolean {
  return TOKEN_RE.test(v);
}

export const BAR_TIME_ZONE = "America/Chicago";

/**
 * The Bible's opens_at (ISO with offset) in the bar's time zone, whatever the
 * visitor's: "Tue, Dec 1 at 12:00 AM" (or "Dec 1 at 12:00 AM" without weekday).
 */
export function opensAtLabel(iso: string, { weekday = true }: { weekday?: boolean } = {}): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const date = new Intl.DateTimeFormat("en-US", {
    timeZone: BAR_TIME_ZONE,
    ...(weekday ? { weekday: "short" as const } : {}),
    month: "short",
    day: "numeric",
  }).format(d);
  const time = new Intl.DateTimeFormat("en-US", { timeZone: BAR_TIME_ZONE, hour: "numeric", minute: "2-digit" }).format(d);
  return `${date} at ${time}`;
}

/** Website event ids are free text; keep what the Bible accepts (≤ 100 chars, no slashes or control characters). */
export function isWebsiteEventId(v: string): boolean {
  return v.length > 0 && v.length <= 100 && /^[^\s/\\?#%]+$/.test(v);
}
