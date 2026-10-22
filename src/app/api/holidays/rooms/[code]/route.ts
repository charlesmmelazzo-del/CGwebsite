import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/lib/popup/access";
import { cleanName, normalizeCode, viewFor, type RoomOp } from "@/lib/holidays/rooms";
import { joinRoom, playerFor, pollRoom, runOp } from "@/lib/holidays/roomStore";
import { failure } from "@/lib/holidays/http";

export const dynamic = "force-dynamic";

const OPS = new Set(["rename", "team", "start", "act", "rematch", "end", "leave", "kick"]);

function token(req: NextRequest) {
  return req.headers.get("x-player-token");
}

/**
 * GET — every phone polls this about once a second. `?v=` is the version the
 * phone already has; if nothing changed the reply is tiny.
 */
export async function GET(req: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code);
  try {
    const room = await pollRoom(code);
    if (!room) return NextResponse.json({ error: "No game with that code." }, { status: 404 });
    const now = Date.now();
    if (req.nextUrl.searchParams.get("v") === String(room.version)) {
      return NextResponse.json({ same: true, serverNow: now });
    }
    const me = playerFor(room, token(req));
    return NextResponse.json({ room: viewFor(room, me?.id ?? null, now) });
  } catch (e) {
    return failure(e);
  }
}

/** POST — join with `{ op: "join", name }`, or any other move with the player token. */
export async function POST(req: NextRequest, { params }: { params: { code: string } }) {
  const code = normalizeCode(params.code);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  try {
    if (body.op === "join") {
      // Guessing codes: a few wrong ones are typos, dozens are a script.
      const limit = checkRateLimit(`holiday-join:${getIp(req)}`, 40, 10 * 60 * 1000);
      if (limit.blocked) return NextResponse.json({ error: "Too many tries. Wait a few minutes." }, { status: 429 });
      const name = cleanName(body.name);
      if (!name) return NextResponse.json({ error: "Enter your name." }, { status: 400 });
      const { room, playerId, token: t } = await joinRoom(code, name);
      return NextResponse.json({ token: t, room: viewFor(room, playerId, Date.now()) });
    }

    const t = token(req);
    if (!t) return NextResponse.json({ error: "You're not in this game." }, { status: 401 });
    if (!OPS.has(String(body.op))) return NextResponse.json({ error: "Unknown move." }, { status: 400 });
    const { room, playerId } = await runOp(code, t, body as unknown as RoomOp);
    return NextResponse.json({ room: viewFor(room, playerId, Date.now()) });
  } catch (e) {
    return failure(e);
  }
}
