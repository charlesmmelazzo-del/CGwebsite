import "server-only";
import { headers } from "next/headers";
import { setDefaultResultOrder } from "node:dns";
import { createHash, randomUUID } from "node:crypto";
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

// Railway has no IPv6 egress; never wait on an AAAA address first.
try { setDefaultResultOrder("ipv4first"); } catch { /* older runtimes */ }

/**
 * Each attempt gets its own timeout, so a stalled connection fails fast enough
 * to retry once inside the guest's patience. Reads (GET) retry once on a
 * connect failure or a timeout; writes retry once only when the request
 * cannot have reached the Bible (connect failure), or when the Bible will
 * de-duplicate it (POST /requests carries an Idempotency-Key).
 */
const READ_TIMEOUT_MS = 4_000;
const WRITE_TIMEOUT_MS = 8_000;
const RETRY_DELAY_MS = 150;
/** A successful call slower than this is logged too, so slow spells show up in the deploy log. */
const SLOW_MS = 1_000;

export const UNAVAILABLE_MESSAGE = "Reservations are temporarily unavailable. Please call us.";

export class BibleError extends Error {
  status: number;
  /** Extra fields the Bible sent with the error (e.g. `options` for party changes). */
  extra: Record<string, unknown>;
  /** False when the request never got an answer from the Bible (connect failure or timeout). */
  reached: boolean;
  constructor(status: number, message: string, extra: Record<string, unknown> = {}, reached = true) {
    super(message);
    this.name = "BibleError";
    this.status = status;
    this.extra = extra;
    this.reached = reached;
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

/** Error codes that mean the connection was never made, so nothing was sent. */
const CONNECT_CODES = new Set([
  "ECONNREFUSED", "ENOTFOUND", "EAI_AGAIN", "EHOSTUNREACH", "ENETUNREACH",
  "UND_ERR_CONNECT_TIMEOUT", "UND_ERR_CONNECT",
]);

export type FailureKind = "connect" | "timeout" | "network";

/** Sort a fetch() rejection into where it failed. Exported for tests. */
export function classifyFailure(e: unknown): { kind: FailureKind; name: string; code: string } {
  const err = e as { name?: string; code?: string; cause?: { name?: string; code?: string; errors?: { code?: string }[] } };
  const name = err?.name || "Error";
  const cause = err?.cause;
  const code = cause?.code || err?.code || cause?.errors?.[0]?.code || cause?.name || "";
  if (name === "TimeoutError" || name === "AbortError" || code === "UND_ERR_HEADERS_TIMEOUT" || code === "UND_ERR_BODY_TIMEOUT") {
    return { kind: code === "UND_ERR_CONNECT_TIMEOUT" ? "connect" : "timeout", name, code: code || name };
  }
  if (CONNECT_CODES.has(code)) return { kind: "connect", name, code };
  return { kind: "network", name, code };
}

/** Whether a failed attempt may be tried once more. Exported for tests. */
export function mayRetry(method: Method, kind: FailureKind, idempotent: boolean): boolean {
  if (kind === "connect") return true; // nothing reached the Bible
  if (kind === "timeout") return method === "GET" || idempotent;
  return method === "GET" || idempotent;
}

const pathForLog = (path: string) => path.replace(/\/r\/[^/?]+/, "/r/…").replace(/\?.*$/, "");

export async function bible<T>(
  method: Method,
  path: string,
  body?: Record<string, unknown>,
  opts: { idempotencyKey?: string } = {},
): Promise<T> {
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

  const idempotent = !!opts.idempotencyKey;
  const timeoutMs = method === "GET" ? READ_TIMEOUT_MS : WRITE_TIMEOUT_MS;
  const started = Date.now();
  let res: Response | null = null;
  for (let attempt = 1; attempt <= 2 && !res; attempt++) {
    const t0 = Date.now();
    try {
      res = await fetch(url, {
        method,
        headers: {
          Authorization: `Bearer ${key}`,
          Accept: "application/json",
          ...(payload ? { "Content-Type": "application/json" } : {}),
          ...(opts.idempotencyKey ? { "Idempotency-Key": opts.idempotencyKey } : {}),
        },
        body: payload,
        cache: "no-store",
        signal: AbortSignal.timeout(timeoutMs),
      });
    } catch (e) {
      const f = classifyFailure(e);
      const retry = attempt === 1 && mayRetry(method, f.kind, idempotent);
      console.error(
        `[reserve] Bible ${method} ${pathForLog(path)} failed: phase=${f.kind} error=${f.name}${f.code && f.code !== f.name ? `/${f.code}` : ""} ` +
          `elapsed=${Date.now() - t0}ms total=${Date.now() - started}ms attempt=${attempt}${retry ? " → retrying" : ""}`,
      );
      if (!retry) throw new BibleError(503, UNAVAILABLE_MESSAGE, {}, false);
      await new Promise((r) => setTimeout(r, RETRY_DELAY_MS));
    }
  }
  if (!res) throw new BibleError(503, UNAVAILABLE_MESSAGE, {}, false);
  const total = Date.now() - started;
  if (total > SLOW_MS) console.warn(`[reserve] Bible ${method} ${pathForLog(path)} slow: ${total}ms → ${res.status}`);

  let data: unknown = null;
  try { data = await res.json(); } catch { /* empty or non-JSON body */ }

  if (!res.ok) {
    const obj = (data && typeof data === "object" ? data : {}) as Record<string, unknown>;
    const { error, ...extra } = obj;
    // A 401 means the shared key is wrong or missing on one side — not the guest's problem.
    if (res.status === 401 || res.status >= 500) {
      console.error(`[reserve] Bible ${method} ${pathForLog(path)} → ${res.status}`);
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

/**
 * The Idempotency-Key sent to the Bible for a new request. The browser sends a
 * random submission_id per visit to the form; mixing in the request itself
 * means the same press of Send (or our own retry) maps to one reservation,
 * while a guest who changes the time and sends again gets a new one.
 */
export function idempotencyKeyFor(submissionId: string, payload: CreateRequestBody): string {
  const id = /^[A-Za-z0-9_-]{8,100}$/.test(submissionId) ? submissionId : randomUUID();
  return createHash("sha256").update(`${id}\n${JSON.stringify(payload)}`).digest("base64url");
}

/** idempotencyKey: the same key for a retried submission makes the Bible return the first reservation instead of a second one. */
export const createRequest = (body: CreateRequestBody, idempotencyKey: string) =>
  bible<{ token: string; status: string }>("POST", "/requests", body as unknown as Record<string, unknown>, { idempotencyKey });

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
