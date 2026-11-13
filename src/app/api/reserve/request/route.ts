import { NextResponse, type NextRequest } from "next/server";
import { createRequest } from "@/lib/reserve/bible";
import { guard, fromError, readJson, bad, looksLikeBot, silentOk, intParam, DATE_RE, TIME_RE } from "@/lib/reserve/route";
import { isEmail, isUsPhone, phoneDigits } from "@/lib/reserve/format";
import type { CreateRequestBody } from "@/lib/reserve/types";

export const dynamic = "force-dynamic";

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest) {
  const stop = guard(req, "request");
  if (stop) return stop;
  const body = await readJson(req);
  if (looksLikeBot(body)) return silentOk();

  const date = s(body.date, 10);
  const start_time = s(body.start_time, 5);
  const start_min = intParam(body.start_min, 0, 2879);
  const minutes = intParam(body.minutes, 15, 1440);
  const party_size = intParam(body.party_size, 1, 500);
  const room_id = intParam(body.room_id, 1, Number.MAX_SAFE_INTEGER);
  const table_id = body.table_id == null ? null : intParam(body.table_id, 1, Number.MAX_SAFE_INTEGER);
  const event_id = body.event_id == null ? null : intParam(body.event_id, 1, Number.MAX_SAFE_INTEGER);

  if (!DATE_RE.test(date) || !TIME_RE.test(start_time) || start_min === null || minutes === null) {
    return bad("Pick a date, time and length.");
  }
  if (party_size === null) return bad("Pick a party size.");
  if (room_id === null || (body.table_id != null && table_id === null)) return bad("Pick a space.");
  if (body.policy_ack !== true) return bad("Please read and accept the policies before sending your request.");

  const payload: CreateRequestBody = {
    date, start_time, start_min, minutes, party_size, room_id, table_id,
    ...(event_id ? { event_id } : {}),
    occasion_note: s(body.occasion_note, 500),
    policy_ack: true,
  };

  const lookup = s(body.lookup_token, 2000);
  if (lookup) {
    payload.lookup_token = lookup;
  } else {
    const g = (body.guest && typeof body.guest === "object" ? body.guest : {}) as Record<string, unknown>;
    const guest = {
      first_name: s(g.first_name, 100),
      last_name: s(g.last_name, 100),
      email: s(g.email, 200),
      phone: phoneDigits(s(g.phone, 40)),
    };
    if (!guest.first_name || !guest.last_name || !guest.email || !guest.phone) {
      return bad("Please enter your first name, last name, email and phone.");
    }
    if (!isEmail(guest.email)) return bad("That email address doesn't look right.");
    if (!isUsPhone(guest.phone)) return bad("Please enter a 10-digit phone number.");
    payload.guest = guest;
  }

  try {
    const out = await createRequest(payload);
    // The token goes to the guest by email only; the page needs just the status
    // ('approved' for event bookings, which skip staff review).
    return NextResponse.json({ ok: true, status: out.status });
  } catch (e) {
    return fromError(e);
  }
}
