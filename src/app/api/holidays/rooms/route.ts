import { NextRequest, NextResponse } from "next/server";
import { checkRateLimit, getIp } from "@/lib/popup/access";
import { getGame } from "@/lib/holidays/games";
import { cleanName, viewFor } from "@/lib/holidays/rooms";
import { createRoom } from "@/lib/holidays/roomStore";
import { failure } from "@/lib/holidays/http";

export const dynamic = "force-dynamic";

/**
 * POST — host a new game. No account: the reply carries a player token the
 * phone keeps for this room, and a 4-digit code to hand to friends.
 */
export async function POST(req: NextRequest) {
  // Generous: the whole bar may share one Wi-Fi address. This only stops a runaway script.
  const limit = checkRateLimit(`holiday-host:${getIp(req)}`, 400, 60 * 60 * 1000);
  if (limit.blocked) {
    return NextResponse.json({ error: "Too many games hosted from here. Try again later." }, { status: 429 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }

  const game = getGame(String(body.gameKey ?? ""));
  if (!game) return NextResponse.json({ error: "Pick a game first." }, { status: 400 });

  try {
    const { room, playerId, token } = await createRoom({
      gameKey: game.key,
      hostName: cleanName(body.name),
      menuId: typeof body.menuId === "string" ? body.menuId : undefined,
      sandbox: body.sandbox === true,
    });
    return NextResponse.json({ token, room: viewFor(room, playerId, Date.now()) });
  } catch (e) {
    return failure(e);
  }
}
