import { NextResponse, type NextRequest } from "next/server";
import * as B from "@/lib/reserve/bible";
import { guard, fromError, badToken, readJson, bad, intParam, notFound, DATE_RE, TIME_RE } from "@/lib/reserve/route";
import type { BucketName } from "@/lib/rateLimit";

export const dynamic = "force-dynamic";

const ACTIONS = ["confirm", "cancel", "late", "message", "notes", "party", "change", "withdraw-change"] as const;
type Action = (typeof ACTIONS)[number];

const s = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

export async function POST(req: NextRequest, { params }: { params: { token: string; action: string } }) {
  const action = params.action as Action;
  if (!ACTIONS.includes(action)) return notFound();
  // Confirm, notes, and withdrawing are low-risk; the rest count toward the guest-action limit.
  const bucket: BucketName = action === "confirm" || action === "notes" || action === "withdraw-change" ? "read" : "guest-action";
  const stop = guard(req, bucket) ?? badToken(params.token);
  if (stop) return stop;

  const token = params.token;
  const body = await readJson(req);

  try {
    switch (action) {
      case "confirm":
        return NextResponse.json(await B.confirm(token));
      case "cancel":
        return NextResponse.json(await B.cancel(token, s(body.reason, 500)));
      case "late": {
        const minutes = intParam(body.minutes, 5, 60);
        if (minutes === null) return bad("Pick how late you'll be.");
        await B.late(token, minutes);
        return NextResponse.json(await B.getReservation(token));
      }
      case "message": {
        const text = s(body.body, 2000);
        if (!text) return bad("Write a message first.");
        return NextResponse.json(await B.sendMessage(token, text));
      }
      case "notes":
        return NextResponse.json(await B.saveNotes(token, s(body.notes, 2000)));
      case "party": {
        const size = intParam(body.party_size, 1, 500);
        if (size === null) return bad("Pick a party size.");
        const mt = body.move_to && typeof body.move_to === "object" ? (body.move_to as Record<string, unknown>) : null;
        let moveTo: { room_id: number; table_id: number | null } | undefined;
        if (mt) {
          const room_id = intParam(mt.room_id, 1, Number.MAX_SAFE_INTEGER);
          const table_id = mt.table_id == null ? null : intParam(mt.table_id, 1, Number.MAX_SAFE_INTEGER);
          if (room_id === null || (mt.table_id != null && table_id === null)) return bad("Pick a space.");
          moveTo = { room_id, table_id };
        }
        const out = await B.changeParty(token, size, moveTo);
        return NextResponse.json(out.view ?? (await B.getReservation(token)));
      }
      case "change": {
        const date = s(body.date, 10);
        const start_time = s(body.start_time, 5);
        const start_min = intParam(body.start_min, 0, 2879);
        const minutes = intParam(body.minutes, 15, 1440);
        if (!DATE_RE.test(date) || !TIME_RE.test(start_time) || start_min === null || minutes === null) {
          return bad("Pick a date, time and length.");
        }
        return NextResponse.json(await B.requestChange(token, { date, start_time, start_min, minutes }));
      }
      case "withdraw-change":
        return NextResponse.json(await B.withdrawChange(token));
    }
  } catch (e) {
    return fromError(e);
  }
}
