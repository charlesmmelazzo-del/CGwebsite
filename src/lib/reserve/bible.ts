import "server-only";
import { headers } from "next/headers";
import type {
  BibleConfig,
  CalendarDay,
  SpaceSlots,
  LookupResult,
  CreateRequestBody,
  GuestReservation,
  PartyChangeResult,
  SpaceSummary,
  EventStatus,
  EventBooking,
} from "./types";

/**
 * Server-to-server client for the CG Bible's public reservations API.
 *
 * The website stores no reservation data; everything goes through here. The
 * shared secret (RESERVATIONS_SYNC_KEY) lives only on the server — this module
 * is marked server-only so it can never be pulled into a browser bundle.
 */

const TIMEOUT_MS = 10_000;

export const UNAVAILABLE_MESSAGE = "Reservations are temporarily unavailable. Please call us.";

export class BibleError extends Error {
  status: number;
  /** Extra fields the Bible sent with the error (e.g. `options` for party changes). */
  extra: Record<string, unknown>;
  constructor(status: number, message: string, extra: Record<string, unknown> = {}) {
    super(message);
    this.name = "BibleError";
    this.status = status;
    this.extra = extra;
  }
}

function baseUrl(): string {
  return (process.env.BIBLE_API_URL || "https://cgbible.com").replace(/\/+$/, "");
}

/**
 * The origin of the incoming request, so the Bible links guest emails back to
 * the copy of the site the guest used (staging tests → staging, live → live).
 * Railway sits behind a proxy, so prefer the forwarded headers.
 */
export function siteOrigin(): string {
  try {
    const h = headers();
    const host = (h.get("x-forwarded-host") || h.get("host") || "").split(",")[0].trim();
    if (!host) return "";
    const fwdProto = (h.get("x-forwarded-proto") || "").split(",")[0].trim();
    const proto = fwdProto || (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
    return `${proto}://${host}`;
  } catch {
    return "";
  }
}

type Method = "GET" | "POST" | "PUT" | "DELETE";

export async function bible<T>(method: Method, path: string, body?: Record<string, unknown>): Promise<T> {
  const key = process.env.RESERVATIONS_SYNC_KEY;
  if (!key) throw new BibleError(503, UNAVAILABLE_MESSAGE);

  const origin = siteOrigin();
  let url = `${baseUrl()}/api/reservations-public${path}`;
  let payload: string | undefined;
  if (method === "GET" || method === "DELETE") {
    if (origin) url += `${url.includes("?") ? "&" : "?"}site_origin=${encodeURIComponent(origin)}`;
  }
  if (method !== "GET") {
    payload = JSON.stringify({ ...(body ?? {}), ...(origin ? { site_origin: origin } : {}) });
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${key}`,
        Accept: "application/json",
        ...(payload ? { "Content-Type": "application/json" } : {}),
      },
      body: payload,
      cache: "no-store",
      signal: AbortSignal.timeout(TIMEOUT_MS),
    });
  } catch {
    throw new BibleError(503, UNAVAILABLE_MESSAGE);
  }

  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok) {
    const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const { error, ...extra } = obj;
    // A 401 means the shared key is wrong or missing on one side — not the guest's problem.
    if (res.status === 401 || res.status >= 500) {
      console.error(`[reserve] Bible ${method} ${path.replace(/\/r\/[^/?]+/, "/r/…")} → ${res.status}`);
      throw new BibleError(res.status === 401 ? 503 : res.status, UNAVAILABLE_MESSAGE);
    }
    throw new BibleError(res.status, typeof error === "string" && error ? error : "Something went wrong.", extra);
  }
  return data as T;
}

const q = (params: Record<string, string | number | null | undefined>) => {
  const s = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null && v !== "") s.set(k, String(v));
  const str = s.toString();
  return str ? `?${str}` : "";
};
const t = (token: string) => `/r/${encodeURIComponent(token)}`;

// ── Typed wrappers ────────────────────────────────────────────────────────────

export const getConfig = () => bible<BibleConfig>("GET", "/config");

export const getCalendar = (partySize?: number | null) =>
  bible<CalendarDay[]>("GET", `/calendar${q({ party_size: partySize })}`);

export const getSlots = (date: string, partySize: number, eventId?: number | null) =>
  bible<SpaceSlots[]>("GET", `/slots${q({ date, party_size: partySize, event_id: eventId })}`);

export const lookupGuest = (by: { email: string } | { phone: string }) =>
  bible<LookupResult>("POST", "/lookup", by);

export const reportNotMe = (body: { lookup_token: string; email?: string; phone?: string }) =>
  bible<{ ok: true }>("POST", "/not-me", body);

export const createRequest = (body: CreateRequestBody) =>
  bible<{ token: string; status: string }>("POST", "/requests", body as unknown as Record<string, unknown>);

export const getReservation = (token: string) => bible<GuestReservation>("GET", t(token));

export const confirm = (token: string) => bible<GuestReservation>("POST", `${t(token)}/confirm`);

export const cancel = (token: string, reason?: string) =>
  bible<GuestReservation>("POST", `${t(token)}/cancel`, { reason: reason ?? "" });

export const late = (token: string, minutes: number) =>
  bible<{ ok: true }>("POST", `${t(token)}/late`, { minutes });

export const sendMessage = (token: string, body: string) =>
  bible<GuestReservation>("POST", `${t(token)}/messages`, { body });

export const saveNotes = (token: string, notes: string) =>
  bible<GuestReservation>("PUT", `${t(token)}/notes`, { guest_notes: notes });

export const changeParty = (token: string, size: number, moveTo?: Pick<SpaceSummary, "room_id" | "table_id">) =>
  bible<PartyChangeResult>("PUT", `${t(token)}/party`, { party_size: size, ...(moveTo ? { move_to: moveTo } : {}) });

export const requestChange = (token: string, change: { date: string; start_time: string; start_min: number; minutes: number }) =>
  bible<GuestReservation>("POST", `${t(token)}/change-request`, change);

export const withdrawChange = (token: string) => bible<GuestReservation>("DELETE", `${t(token)}/change-request`);

export const getReservationSlots = (token: string, date: string) =>
  bible<SpaceSlots[]>("GET", `${t(token)}/slots${q({ date })}`);

// ── Event reservations (Bible file 06) ────────────────────────────────────────

const ev = (id: string) => `/events/${encodeURIComponent(id)}`;

/** Turn reservations on (creates a pending setup) or off for a website event. Dates only; staff set hours in the Bible. */
export const upsertEventReservations = (
  websiteEventId: string,
  body: { title: string; date: string; start_time?: string; end_time?: string; enabled: boolean },
) => bible<EventStatus>("PUT", ev(websiteEventId), body);

/** Stop taking reservations (the Bible keeps the event and its bookings). */
export const removeEventReservations = (websiteEventId: string) => bible<EventStatus>("DELETE", ev(websiteEventId));

/** Status per website event id; ids the Bible doesn't know are simply absent. */
export async function getEventStatuses(ids: string[]): Promise<Record<string, EventStatus>> {
  const unique = Array.from(new Set(ids.filter(Boolean)));
  if (!unique.length) return {};
  const out: Record<string, EventStatus> = {};
  for (let i = 0; i < unique.length; i += 50) {
    const chunk = unique.slice(i, i + 50);
    Object.assign(out, await bible<Record<string, EventStatus>>("GET", `/events/status${q({ ids: chunk.join(",") })}`));
  }
  return out;
}

export const getEventBooking = (websiteEventId: string) => bible<EventBooking>("GET", ev(websiteEventId));
